// videoController.module.js
import { Events } from "../../src/analytics_events.module.js?v={{{ PRODUCT_VERSION }}}";
import { sendEvent } from "../../src/amplitude.module.js?v={{{ PRODUCT_VERSION }}}";
import { Log } from "../../src/logger.module.js?v={{{ PRODUCT_VERSION }}}";

export const VideoController = (function () {

  // Global variables.
  let videoPlayerInstance = null; // Holds the current player instance (YouTubePlayer or RutubePlayer)
  let pendingVideoId = null; // Stores the video ID to load when requested.
  let isAPIReady = false; // Universal flag: true when the API is loaded for the chosen player.
  let videoPlaybackAllowed = false; // Flag indicating whether video playback is allowed.
  let useRutube = null; // Set to true to use Rutube, false to use YouTube.
  const draggableEnabled = true;
  const autoPlayEnabled = true;
  const defaultVolume = 5;

  let volumeSliderTimeout;
  let isSliderActive = false;
  let volumeIconElement = null;
  let isMuted = false;
  let previousVolume = defaultVolume;

  let playerModule = null; // This will hold the imported module (either YouTubePlayer or RutubePlayer).

  let ipDataPromise = null; // Cached promise to ensure that multiple calls return the same result
  let cachedIpData = null;
  let loadAPIPromise = null; // Cached promise for the API-loading operation.
  let currentVolume = defaultVolume;
  let _apiLoaded = false;
  let _isInitialized = false;
  let currentLoadRequestId = 0; // Monotonic token to cancel in-flight video load requests

  /* --------------------- Non-API (UI) Methods --------------------- */

  function cancelPendingVideoLoad() {
    // Invalidate any in-flight loadVideo sequence without touching API loading
    pendingVideoId = null;
    currentLoadRequestId++;
    Log.debug("Pending video load cancelled");
  }

  function setVideoPlaybackAllowed(allowed) {
    videoPlaybackAllowed = Boolean(allowed);
    sendVideoPlaybackStatusChangedEvent(videoPlaybackAllowed);
    if (videoPlayerInstance) {
      videoPlayerInstance.setVideoPlaybackAllowed(videoPlaybackAllowed);
    }
    Log.debug("Video playback allowed:", videoPlaybackAllowed);
  }

  function getVideoPlaybackAllowed() {
    return videoPlaybackAllowed;
  }

  function loadCSS(url) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }

  function injectVideoContainer() {
    const containerHTML = `
    <!-- Container for the video player -->
    <div id="video-container">
      <!-- Player will be injected here -->
      <div id="player"></div>
      <!-- Transparent overlay to block user interactions -->
      <div id="video-overlay"></div>
    </div>
  `;
    const temp = document.createElement("div");
    temp.innerHTML = containerHTML;
    document.body.insertAdjacentElement("afterbegin", temp.firstElementChild);

    if (draggableEnabled) {
      // Make the video container draggable.
      const container = document.getElementById("video-container");
      if (container) {
        import("./Draggable.js?v={{{ PRODUCT_VERSION }}}").then((module) => {
          new module.default(container);
        });
      }
    }
  }

  function injectDebugButtons() {
    const style = document.createElement("style");
    style.innerHTML = `
    /* Styling for control buttons */
    #video-buttons button {
      margin: 5px;
      padding: 8px 12px;
      font-size: 14px;
      cursor: pointer;
    }
  `;
    document.head.appendChild(style);

    const buttonsHTML = `
    <div id="video-buttons" style="margin: 10px;">
      <button id="loadButton">Load Video</button>
      <button id="playButton">Play Video</button>
      <button id="pauseButton">Pause Video</button>
      <button id="hideButton">Hide Video</button>
      <button id="showButton">Show Video</button>
      <button id="changeButton">Change Video</button>
    </div>
  `;
    const temp2 = document.createElement("div");
    temp2.innerHTML = buttonsHTML;
    document.body.insertAdjacentElement("beforeend", temp2.firstElementChild);

    document.getElementById("loadButton").addEventListener("click", () => {
      loadVideo("oIfBJ6aelZE", true); // Example video ID, looping enabled.
    });
    document.getElementById("playButton").addEventListener("click", playVideo);
    document
      .getElementById("pauseButton")
      .addEventListener("click", pauseVideo);
    document
      .getElementById("hideButton")
      .addEventListener("click", hideVideoContainer);
    document
      .getElementById("showButton")
      .addEventListener("click", showVideoContainer);
    document.getElementById("changeButton").addEventListener("click", () => {
      const newId = prompt("Enter new video ID:");
      if (newId) {
        changeVideo(newId);
      }
    });
  }

  /**
   * Injects custom CSS for the volume slider.
   * This removes default appearance and applies our custom background.
   */
  function injectSliderStyles() {
    const style = document.createElement("style");
    style.innerHTML = `
    #volume-slider-container,
    #volume-slider-container * {
      user-select: none !important;
      -webkit-user-select: none !important;
      -ms-user-select: none !important;
      -webkit-touch-callout: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }

    /* Base styling for the volume slider */
    #volume-slider {
      -webkit-appearance: none;
      appearance: none;
      height: 5px;
      border-radius: 3px;
      outline: none;
      padding: 0;
      margin: 0;
      /* Default background (will be overridden by JS) */
      background: #ccc;
      touch-action: pan-x;
    }
    /* Remove any default track styling (so our input background shows) */
    #volume-slider::-webkit-slider-runnable-track,
    #volume-slider::-moz-range-track {
      background: transparent;
    }
    /* Slider thumb styling for WebKit */
    #volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      background: #007aff;
      border-radius: 50%;
      // margin-top: -4.5px; /* Center the thumb on a 5px track */
    }
    /* Slider thumb styling for Firefox */
    #volume-slider::-moz-range-thumb {
      width: 14px;
      height: 14px;
      background: #007aff;
      border: none;
      border-radius: 50%;
    }
  `;
    document.head.appendChild(style);
  }

  /**
   * Updates the slider's background so that the blue portion (filled) reflects the current value.
   * This function uses a linear gradient and forces the style using !important.
   * @param {HTMLInputElement} slider - The slider element.
   * @param {number|string} value - The current value (0-100).
   */
  function updateSliderBackground(slider, value) {
    const percentage = parseInt(value, 10);
    slider.style.setProperty(
      "background",
      `linear-gradient(to right, #007aff ${percentage}%, #ccc ${percentage}%, #ccc 100%)`,
      "important"
    );
  }

  /**
   * Updates the width of the volume slider based on the video container's width.
   * Uses linear interpolation:
   *  - For container widths ≤ 200px: slider width = 50% of container.
   *  - For container widths ≥ 300px: slider width = 20% of container.
   *  - In between, it interpolates smoothly.
   */
  function updateVolumeSliderWidth() {
    const container = document.getElementById("video-container");
    const slider = document.getElementById("volume-slider");
    if (container && slider) {
      const containerWidth = container.offsetWidth;
      const minWidth = 200;
      const threshold = 300;
      let ratio;
      if (containerWidth <= minWidth) {
        ratio = 0.5;
      } else if (containerWidth >= threshold) {
        ratio = 0.2;
      } else {
        ratio =
          0.5 -
          ((containerWidth - minWidth) / (threshold - minWidth)) * (0.5 - 0.2);
      }
      const newWidth = containerWidth * ratio;
      slider.style.width = newWidth + "px";
    }
  }

  /**
   * Injects a volume slider into the video player's container.
   * A speaker icon is shown to the left. The slider is absolutely positioned.
   * Mousedown events are stopped so that interacting with the slider doesn’t trigger the draggable behavior.
   */
  function injectVolumeSlider() {
    const sliderHTML =
      `
    <div id="volume-slider-container" style="
      position: absolute;
      bottom: 10px;
      left: 10px;
      right: 10px;
      z-index: 1100;
      display: flex;
      align-items: center;
      opacity: 0;
      transition: opacity 0.5s ease-in-out;
      pointer-events: none;
      width: 50px;
    ">
      <span class="volume-icon" style="font-size: 16px; margin-right: 5px; cursor: pointer;">🔊</span>
      <input type="range" id="volume-slider" min="0" max="100" value="` +
      currentVolume +
      `" style="
        cursor: pointer;
        transition: width 0.3s ease;
      ">
    </div>
  `;

    const container = document.getElementById("video-container");
    if (container) {
      container.insertAdjacentHTML("beforeend", sliderHTML);
      const sliderContainer = document.getElementById(
        "volume-slider-container"
      );
      const slider = document.getElementById("volume-slider");
      const volumeIcon = sliderContainer.querySelector(".volume-icon");
      volumeIconElement = volumeIcon;

      if (sliderContainer) {
        sliderContainer.addEventListener("mousedown", (e) =>
          e.stopPropagation()
        );
      }
      if (slider) {
        slider.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          clearTimeout(volumeSliderTimeout);
          isSliderActive = true;
        });
        slider.addEventListener("mouseup", () => {
          isSliderActive = false;
          resetVolumeSliderTimeout();
        });
        slider.addEventListener("mouseleave", () => {
          if (isSliderActive) return;
          resetVolumeSliderTimeout();
        });

        slider.addEventListener(
          "touchstart",
          (e) => {
            e.stopPropagation();
            isSliderActive = true;
            clearTimeout(volumeSliderTimeout);
            showVolumeSlider();
          },
          { passive: false }
        );

        slider.addEventListener(
          "touchmove",
          (e) => {
            e.stopPropagation();
            showVolumeSlider();
          },
          { passive: false }
        );

        slider.addEventListener(
          "touchend",
          (e) => {
            e.stopPropagation();
            isSliderActive = false;
            resetVolumeSliderTimeout();
          },
          { passive: false }
        );

        slider.addEventListener("input", (e) => {
          const volume = parseInt(e.target.value, 10);
          setVolumeInternal(volume); // push into the player & fire callbacks
        });
        updateSliderBackground(slider, slider.value);
      }

      // Add click handler to the volume icon for mute/unmute.
      if (volumeIcon) {
        volumeIcon.addEventListener("click", () => {
          // toggle between 0 and the last non-zero volume
          const newVolume = isMuted ? previousVolume : 0;
          setVolumeInternal(newVolume, true, true); // updates slider, background, and icon
          showVolumeSlider();
        });
      }

      updateVolumeSliderWidth();
      setupVideoClickHandler();

      container.addEventListener("playerSizeChanged", (event) => {
        updateVolumeSliderWidth();
      });
    } else {
      Log.error("Video container not found. Cannot inject volume slider.");
    }
  }

  function showVolumeSlider() {
    const sliderContainer = document.getElementById("volume-slider-container");
    if (sliderContainer) {
      sliderContainer.style.opacity = "1";
      sliderContainer.style.pointerEvents = "all";
      resetVolumeSliderTimeout();
    }
  }

  function hideVolumeSlider() {
    if (isSliderActive) return;
    const sliderContainer = document.getElementById("volume-slider-container");
    if (sliderContainer) {
      sliderContainer.style.opacity = "0";
      sliderContainer.style.pointerEvents = "none";
    }
  }

  function resetVolumeSliderTimeout() {
    clearTimeout(volumeSliderTimeout);
    volumeSliderTimeout = setTimeout(hideVolumeSlider, 3000);
  }

  function setupVideoClickHandler() {
    const player = document.getElementById("video-overlay");
    if (player) {
      player.addEventListener("click", showVolumeSlider);
    }
  }

  function hideVideoContainer() {
    const container = document.getElementById("video-container");
    if (container) {
      container.style.opacity = 0;
      container.style.pointerEvents = "none";
      hideOverlay();
      // container.style.display = "none";
    }
  }

  function showVideoContainer() {
    const container = document.getElementById("video-container");
    if (container) {
      container.style.opacity = 1;
      container.style.pointerEvents = "all";
      showOverlay();
      // container.style.display = "block";
    }
  }

  function hideOverlay() {
    const overlay = document.getElementById("video-overlay");
    if (overlay) {
      overlay.style.display = "none";
      overlay.style.pointerEvents = "none";
    }
  }

  function showOverlay() {
    const overlay = document.getElementById("video-overlay");
    if (overlay) {
      overlay.style.display = "block";
      overlay.style.pointerEvents = "all";
    }
  }

  function isVideoContainerVisible() {
    const container = document.getElementById("video-container");
    if (container) {
      return container.style.opacity == 1;
    }
    return false;
  }

  function setupOverlay() {
    const overlay = document.getElementById("video-overlay");
    if (overlay) {
      overlay.addEventListener("click", () => {
        if (
          getVideoPlaybackAllowed() &&
          videoPlayerInstance &&
          !videoPlayerInstance.isPlaying()
        ) {
          Log.debug("on videoplayer overlay clicked");
          videoPlayerInstance.playVideo();
        }
      });
    }
  }

  /**
   * Fetches IP data from the ipapi service with automatic retries on failure.
   *
   * This function retrieves the user's IP data from "https://ipapi.co/json/" and determines
   * if Rutube should be used (i.e., if the user's country is "RU"). In case of an error,
   * it automatically retries the request after a short delay (1 second). The result is cached,
   * so if this function is called again while a request is in progress or after it has completed,
   * it returns the same promise.
   *
   * @param {number} [retries=5] - The number of times to retry the fetch in case of an error.
   * @param {number} [delay=1000] - The delay (in milliseconds) between retry attempts.
   * @returns {Promise<{data: Object, useRutube: boolean}>} A promise that resolves to an object containing:
   *  - data: The JSON data from the ipapi service.
   *  - useRutube: A boolean flag that is true if the country is "RU", false otherwise.
   */
  function fetchIpDataWithRetry(retries = 5, delay = 1000) {
    if (useRutube !== null) {
      return Promise.resolve(cachedIpData);
    }

    // Return the cached promise if it already exists
    if (ipDataPromise) {
      return ipDataPromise;
    }

    let attempt = 0;

    // Create a new promise and cache it
    ipDataPromise = new Promise((resolve, reject) => {
      // Function to attempt fetching the IP data
      function attemptFetch() {
        attempt++;
        sendGeoFetchStartedEvent();
        Log.debug("attemptFetch");
        // Replace with your API endpoint for geo settings
        fetch("YOUR_API_ENDPOINT_URL_HERE") // Replace this with your actual API endpoint
          // fetch("https://ipapi.co/json/") // #2
          .then((response) => response.json())
          .then((data) => {
            const geo = data.geo; // #1
            // const geo = data; // #2
            sendGeoFetchFinishedEvent(geo);
            Log.always("region: " + geo.country);
            const result = {
              data: geo,
              useRutube:
                new URLSearchParams(window.top.location.search).get("useRutube") ??
                geo.country === "RU",
            };

            cachedIpData = result;
            useRutube = result.useRutube;
            resolve(result);
          })
          .catch((error) => {
            Log.error("Error:", error);
            sendGeoFetchFailedEvent(error.message);
            // Retry the fetch after a delay of 1 second (1000 ms)
            if (attempt < retries) {
              setTimeout(attemptFetch, delay);
            } else {
              reject(error);
            }
          });
      }

      // Start the first attempt to fetch the data
      attemptFetch();
    });

    return ipDataPromise;
  }

  /* --------------------- API-Specific Methods --------------------- */

  /**
   * Helper function to dynamically import a module with retry logic.
   *
   * @param {string} modulePath - The path of the module to import.
   * @param {number} [retries=5] - The number of times to retry the import in case of an error.
   * @param {number} [delay=1000] - The delay (in milliseconds) between retry attempts.
   * @returns {Promise<Object>} - A promise that resolves to the imported module.
   * @throws Will throw an error if all retry attempts fail.
   */
  async function importWithRetry(modulePath, retries = 5, delay = 1000) {
    let attempts = 0;
    while (attempts < retries) {
      try {
        sendAPIFetchStartedEvent(modulePath);
        let module = await import(modulePath);
        sendAPIFetchFinishedEvent(modulePath);
        return module;
      } catch (error) {
        sendAPIFetchFailedEvent(modulePath, error);
        attempts++;
        Log.error(
          `Failed to import ${modulePath} (attempt ${attempts}/${retries}). Error: ${error}`
        );
        if (attempts < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Universal method to load the API for the chosen player.
   *
   * It first retrieves IP data to determine which player to use.
   * For Rutube, it calls RutubePlayer.loadAPI(); for YouTube, it calls YouTubePlayer.loadAPI().
   * If the API is already in the process of loading, the method waits for the ongoing operation to complete.
   *
   * @returns {Promise<*>} A promise that resolves when the player API is loaded.
   */
  async function loadAPI() {
    if (_apiLoaded) {
      return Promise.resolve();
    }

    // If a load operation is already in progress, return its promise.
    if (loadAPIPromise) {
      return loadAPIPromise;
    }

    loadAPIPromise = (async () => {
      try {
        // Fetch IP data with retry logic.
        const ipDataResult = await fetchIpDataWithRetry();

        // Determine the module path based on the country.
        const modulePath = ipDataResult.useRutube
          ? "./RutubePlayer.js?v={{{ PRODUCT_VERSION }}}"
          : "./YouTubePlayer.js?v={{{ PRODUCT_VERSION }}}";

        sendAPILoadStartedEvent(modulePath);

        // Dynamically import the appropriate player module.
        const module = await importWithRetry(modulePath);

        // Set the global player module.
        playerModule = module.default;
        if (ipDataResult.useRutube) {
          window.onRutubeIframeAPIReady = onYouTubeIframeAPIReady;
        } else {
          window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
        }
        window.onPlayerStateChange = onPlayerStateChange;

        sendAPILoadFinishedEvent(modulePath);

        // Use the retry wrapper to load the API.
        retryAsync(() => playerModule.loadAPI(), 5, 1000, {
          onAttemptStart: (attempt) => {
            sendAPILoadStartedEvent(window.videoPlayerApiPath);
          },
          onAttemptSuccess: (attempt) => {
            sendAPILoadFinishedEvent(window.videoPlayerApiPath);
            _apiLoaded = true;
          },
          onAttemptFailure: (attempt, error) => {
            sendAPILoadFailedEvent(window.videoPlayerApiPath, error.message);
          },
        });
      } catch (error) {
        sendAPILoadFailedEvent(modulePath, error.message);
        // Clear the cached promise to allow future attempts.
        loadAPIPromise = null;
        throw error;
      }
    })();

    return loadAPIPromise;
  }

  /**
   * retryAsync repeatedly executes an asynchronous function until it succeeds
   * or the maximum number of attempts is reached. It also calls optional callbacks
   * for start, success, and failure events of each attempt.
   *
   * @param {Function} fn - The asynchronous function to be executed.
   * @param {number} retries - The maximum number of attempts allowed.
   * @param {number} delay - The delay in milliseconds between successive attempts.
   * @param {Object} callbacks - An object containing optional callback functions:
   *    - onAttemptStart(attempt): called before each attempt.
   *    - onAttemptSuccess(attempt): called after a successful attempt.
   *    - onAttemptFailure(attempt, error): called after a failed attempt.
   *
   * @returns {Promise} - A promise that resolves with the result of the asynchronous function if it succeeds,
   * or rejects with the last error encountered after exhausting all retry attempts.
   */
  async function retryAsync(fn, retries = 5, delay = 1000, callbacks = {}) {
    const {
      onAttemptStart = () => {},
      onAttemptSuccess = () => {},
      onAttemptFailure = () => {},
    } = callbacks;

    let attempt = 0;
    while (attempt < retries) {
      // Callback before each attempt.
      onAttemptStart(attempt + 1);
      try {
        const result = await fn();
        // Callback after a successful attempt.
        onAttemptSuccess(attempt + 1);
        return result;
      } catch (error) {
        attempt++;
        // Callback after a failed attempt.
        onAttemptFailure(attempt, error);
        Log.error(`Attempt ${attempt} failed: ${error.message}`);
        if (attempt >= retries) {
          throw error;
        }
        // Delay before the next attempt.
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  /**
   * Event handler for player state changes.
   */
  function onPlayerStateChange(state) {
    sendVideoPlayerStatusChangedEvent(state);
  }

  /**
   * Global callback for YouTube API.
   * If pendingVideoId is set and using YouTube, creates the player.
   */
  function onYouTubeIframeAPIReady() {
    Log.always("onYouTubeIframeAPIReady");
    sendVideoPlayerReadyEvent();
    isAPIReady = true;
    if (pendingVideoId && !videoPlayerInstance) {
      createPlayer(pendingVideoId);
    }
  }

  /**
   * Global callback when video start playing.
   */
  function onVideoStartPlaying() {
    Log.debug("onVideoStartPlaying");
    showVideoContainer();
  }

  function onVideoError(code, text) {
    Log.error("onVideoError: " + code + "\n" + text);
    sendErrorEvent(code, text);
    showVideoContainer();
  }

  /**
   * Creates a player (either YouTube or Rutube) using the provided videoId.
   * Uses the module already loaded in playerModule.
   * @param {string} videoId - The video ID.
   */
  function createPlayer(videoId) {
    Log.debug("videoController createPlayer(): " + videoId);
    if (!playerModule) {
      Log.error("API module is not loaded.");
      return;
    }
    sendVideoPlayerInitStartedEvent();
    // pendingVideoId = videoId;
    videoPlayerInstance = new playerModule(
      "player",
      autoPlayEnabled,
      getVideoPlaybackAllowed(),
      currentVolume,
      videoId,
      true
    );
    videoPlayerInstance.init();
    window.videoPlayerInstance = videoPlayerInstance;
  }

  /**
   * Loads the video player on demand.
   * Stores the provided videoId in pendingVideoId.
   * If the player already exists, changes the video.
   * Also shows the video container.
   * @param {string} youtubeVideoId - The youtube video ID to load.
   * @param {string} rutubeVideoId - The rutube video ID to load.
   */
  async function loadVideo(youtubeVideoId, rutubeVideoId) {
    Log.debug(
      "videoController playVideo(): " + youtubeVideoId + " " + rutubeVideoId
    );
    sendTryLoadVideoEvent(useRutube ? rutubeVideoId : youtubeVideoId);
    const loadId = currentLoadRequestId + 1;
    currentLoadRequestId = loadId;
    pendingVideoId = useRutube ? rutubeVideoId : youtubeVideoId;
    try {
      await loadAPI();
      // If a stop/cancel occurred while API was loading, abort further work
      if (loadId !== currentLoadRequestId || !pendingVideoId) {
        Log.warn("Video load aborted before player creation/change.");
        return;
      }
      if (!videoPlayerInstance) {
        Log.debug("videoController playVideo1(): " + pendingVideoId);
        if (isAPIReady) {
          createPlayer(pendingVideoId);
        } else {
          Log.warn("API not ready; player will be created when ready.");
        }
      } else {
        Log.debug(
          "videoController playVideo3(): " +
            videoPlayerInstance.getVideoId() +
            " " +
            pendingVideoId
        );
        // Guard again in case cancellation happened between checks
        if (loadId !== currentLoadRequestId || !pendingVideoId) {
          Log.warn("Video load aborted before changeVideo.");
          return;
        }
        if (videoPlayerInstance.getVideoId() == pendingVideoId) playVideo();
        else videoPlayerInstance.changeVideo(pendingVideoId);
      }
    } catch (err) {
      Log.error("Error loading API:", err);
    }
  }

  /**
   * Plays the video if playback is allowed.
   */
  function playVideo() {
    Log.debug("videoController playVideo()");
    sendTryPlayEvent(
      videoPlayerInstance ? videoPlayerInstance.getVideoId() : pendingVideoId
    );
    if (!getVideoPlaybackAllowed()) {
      Log.warn("Video playback is currently not allowed.");
      return;
    }
    showVideoContainer();
    if (videoPlayerInstance) {
      videoPlayerInstance.playVideo();
    }
  }

  /**
   * Pauses the video.
   */
  function pauseVideo() {
    sendTryPauseEvent();
    if (videoPlayerInstance) {
      videoPlayerInstance.pauseVideo();
    }
  }

  /**
   * Stop the video.
   */
  function stopVideo() {
    sendTryStopEvent();
    cancelPendingVideoLoad();
    if (videoPlayerInstance) {
      videoPlayerInstance.stopVideo();
    }
  }

  /**
   * Changes the current video to a new one.
   * @param {string} youtubeVideoId - The youtube video ID to load.
   * @param {string} rutubeVideoId - The rutube video ID to load.
   */
  function changeVideo(youtubeVideoId, rutubeVideoId) {
    sendTryChangeVideoEvent(useRutube ? rutubeVideoId : youtubeVideoId);
    if (videoPlayerInstance) {
      videoPlayerInstance.changeVideo(
        useRutube ? rutubeVideoId : youtubeVideoId
      );
    }
  }

  /**
   * Sets the player volume.
   * @param {number} volume - The volume level (0 to 100).
   */
  function setVolume(volume) {
    setVolumeInternal(volume, false, true);
  }

  /**
   * Sets the player volume.
   * @param {number} volume - The volume level (0 to 100).
   * @param {boolean} [invokeEvent=true] – Whether to fire onVideoVolumeChanged.
   */
  function setVolumeInternal(volume, invokeEvent = true, updateSlider = false) {
    currentVolume = parseInt(volume, 10);
    if (videoPlayerInstance) {
      videoPlayerInstance.setVolume(currentVolume);
    }
    const slider = document.getElementById("volume-slider");
    if (slider) {
      if (updateSlider) slider.value = volume;
      updateSliderBackground(slider, volume);
    }
    applyVolumeState(volume);
    if (invokeEvent) window.onVideoVolumeChanged(currentVolume);
  }

  /**
   * Mutes the video.
   */
  function muteVideo() {
    if (videoPlayerInstance) {
      videoPlayerInstance.muteVideo();
    }
  }

  /**
   * Unmutes the video.
   */
  function unmuteVideo() {
    if (videoPlayerInstance) {
      videoPlayerInstance.unmuteVideo();
    }
  }

  /**
   * Returns true if the video is currently playing.
   * @returns {boolean}
   */
  function isPlaying() {
    if (
      videoPlayerInstance &&
      typeof videoPlayerInstance.isPlaying === "function"
    ) {
      return videoPlayerInstance.isPlaying();
    }
    return false;
  }

  function isRutubePlayer() {
    return useRutube;
  }

  /**
   * Syncs UI ↔ state when volume changes.
   * Uses the cached volumeIconElement, so no DOM lookups per call.
   */
  function applyVolumeState(volume) {
    if (volume > 0) {
      if (volumeIconElement) volumeIconElement.textContent = "🔊";
      isMuted = false;
      previousVolume = volume;
    } else {
      if (volumeIconElement) volumeIconElement.textContent = "🔇";
      isMuted = true;
    }
  }

  function isInitialized() {
    return _isInitialized;
  }

  function init() {
    loadCSS("VideoController/css/video_styles.css");
    injectVideoContainer();
    injectSliderStyles();
    injectVolumeSlider();
    // Optionally, update slider width after a brief delay.
    setTimeout(updateVolumeSliderWidth, 1000);
    // Optionally inject debug buttons.
    // injectDebugButtons();
    setupOverlay();
    window.onVideoStartPlaying = onVideoStartPlaying;
    window.onVideoError = onVideoError;

    try {
      fetchIpDataWithRetry().then((result) => {
        Log.info("Use Rutube:", result.useRutube);
        useRutube = result.useRutube;
      }).catch((error) => {
        _isInitialized = false;
        throw error;
      });
      loadAPI().then(() => {
        _isInitialized = true;
      }).catch((error) => {
        _isInitialized = false;
        throw error;
      });
    } catch (error) {
      Log.error("Error initializing video controller:", error);
      _isInitialized = false;
    }
  }

  // analytics
  function combineWithBaseProperties(props = {}) {
    return {
      Instance:
        typeof videoPlayerInstance !== "undefined" && !!videoPlayerInstance,
      Video_Playback_Allowed: getVideoPlaybackAllowed(),
      Is_Playing_Now:
        (typeof videoPlayerInstance !== "undefined" &&
          !!videoPlayerInstance &&
          !videoPlayerInstance.isPlaying?.()) ||
        false,
      Use_Rutube: useRutube ?? "?",
      ...props,
    };
  }

  function sendErrorEvent(code, text) {
    sendEvent(
      Events.Games_Video_Error,
      combineWithBaseProperties({
        Code: code,
        Text: text,
      })
    );
  }

  function sendGeoFetchStartedEvent() {
    sendEvent(
      Events.Games_Video_Geo_Fetch_Started,
      combineWithBaseProperties()
    );
  }

  function sendGeoFetchFinishedEvent(geo) {
    sendEvent(
      Events.Games_Video_Geo_Fetch_Finished,
      combineWithBaseProperties({
        Geo: geo,
      })
    );
  }

  function sendGeoFetchFailedEvent(error) {
    sendEvent(
      Events.Games_Video_Geo_Fetch_Failed,
      combineWithBaseProperties({
        Error: error,
      })
    );
  }

  function sendAPILoadStartedEvent(path) {
    sendEvent(
      Events.Games_Video_Load_API_Started,
      combineWithBaseProperties({
        Path: path,
      })
    );
  }

  function sendAPILoadFinishedEvent(path) {
    sendEvent(
      Events.Games_Video_Load_API_Finished,
      combineWithBaseProperties({
        Path: path,
      })
    );
  }

  function sendAPILoadFailedEvent(path, error) {
    sendEvent(
      Events.Games_Video_Load_API_Error,
      combineWithBaseProperties({
        Path: path,
        Error: error,
      })
    );
  }

  function sendAPIFetchStartedEvent(path) {
    sendEvent(
      Events.Games_Video_API_Fetch_Started,
      combineWithBaseProperties({
        Path: path,
      })
    );
  }

  function sendAPIFetchFinishedEvent(path) {
    sendEvent(
      Events.Games_Video_API_Fetch_Finished,
      combineWithBaseProperties({
        Path: path,
      })
    );
  }

  function sendAPIFetchFailedEvent(path, error) {
    sendEvent(
      Events.Games_Video_API_Fetch_Failed,
      combineWithBaseProperties({
        Path: path,
        Error: error,
      })
    );
  }

  function sendVideoPlaybackStatusChangedEvent(status) {
    sendEvent(
      Events.Games_Video_Playback_Allow_Status_Changed,
      combineWithBaseProperties({
        Status: status,
      })
    );
  }

  function sendVideoPlayerStatusChangedEvent(state) {
    sendEvent(
      Events.Games_Video_Player_State_Changed,
      combineWithBaseProperties({
        State: state,
      })
    );
  }

  function sendTryLoadVideoEvent(videoId) {
    sendEvent(
      Events.Games_Video_Try_Load,
      combineWithBaseProperties({
        Video_Id: videoId,
      })
    );
  }

  function sendTryChangeVideoEvent(videoId) {
    sendEvent(
      Events.Games_Video_Try_Change,
      combineWithBaseProperties({
        Video_Id: videoId,
      })
    );
  }

  function sendTryPauseEvent() {
    sendEvent(Events.Games_Video_Try_Pause, combineWithBaseProperties());
  }

  function sendTryStopEvent() {
    sendEvent(Events.Games_Video_Try_Stop, combineWithBaseProperties());
  }

  function sendTryPlayEvent(videoId) {
    sendEvent(
      Events.Games_Video_Try_Play,
      combineWithBaseProperties({
        Video_Id: videoId,
      })
    );
  }

  function sendVideoPlayerReadyEvent() {
    sendEvent(Events.Games_Video_Player_Ready, combineWithBaseProperties());
  }

  function sendVideoPlayerInitStartedEvent() {
    sendEvent(Events.Games_Video_Init_Started, combineWithBaseProperties());
  }

  /* --------------------- Initialization --------------------- */

  document.addEventListener("DOMContentLoaded", () => {
    // init();

    // Update slider width on window resize.
    window.addEventListener("resize", updateVolumeSliderWidth);
  });

  // // Expose controller methods globally.
  // window.videoController = {
  //   load: loadVideo, // Load video on demand (with a provided video id)
  //   play: playVideo,
  //   pause: pauseVideo,
  //   stop: stopVideo,
  //   change: changeVideo,
  //   setVolume: setVolume,
  //   mute: muteVideo,
  //   unmute: unmuteVideo,
  //   hide: hideVideoContainer,
  //   show: showVideoContainer,
  //   hideOverlay: hideOverlay,
  //   showOverlay: showOverlay,
  //   isPlaying: isPlaying,
  //   setVideoPlaybackAllowed: setVideoPlaybackAllowed,
  //   getVideoPlaybackAllowed: getVideoPlaybackAllowed,
  //   init: init,
  //   isRutubePlayer: isRutubePlayer,
  // };

  // Public API for the AudioPlayer module
  return {
    load: loadVideo, // Load video on demand (with a provided video id)
    play: playVideo,
    pause: pauseVideo,
    stop: stopVideo,
    change: changeVideo,
    setVolume: setVolume,
    mute: muteVideo,
    unmute: unmuteVideo,
    hide: hideVideoContainer,
    show: showVideoContainer,
    hideOverlay: hideOverlay,
    showOverlay: showOverlay,
    isPlaying: isPlaying,
    setVideoPlaybackAllowed: setVideoPlaybackAllowed,
    getVideoPlaybackAllowed: getVideoPlaybackAllowed,
    init: init,
    isRutubePlayer: isRutubePlayer,
    isInitialized: isInitialized,
  };
})();