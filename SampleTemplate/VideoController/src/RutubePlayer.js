// RutubePlayer.js
import { Log } from "../../src/logger.module.js?v={{{ PRODUCT_VERSION }}}";

export default class RutubePlayer {
  /**
   * Creates an instance of RutubePlayer.
   * @param {string} elementId - The DOM element id where the player will be created.
   * @param {boolean} autoPlayEnabled - Whether autoplay is enabled.
   * @param {boolean} videoPlaybackAllowed - Whether video playback is allowed.
   * @param {float} volume - Default volume.
   * @param {string} videoId - The Rutube video ID.
   * @param {boolean} loopEnabled - Whether looping is enabled.
   */
  constructor(
    elementId,
    autoPlayEnabled,
    videoPlaybackAllowed,
    volume,
    videoId = "",
    loopEnabled = false
  ) {
    this.elementId = elementId;
    this.autoPlayEnabled = autoPlayEnabled;
    this.videoId = videoId;
    this.loopEnabled = loopEnabled;
    this.player = null; // Will store the Rutube player instance.
    // Flag to indicate if pause was triggered by code.
    this.pauseTriggeredByCode = false;
    this.isPlayingNow = false;
    this.videoPlaybackAllowed = videoPlaybackAllowed;
    this.volume = volume;
  }

  /**
   * Static method to load the Rutube API.
   * Returns a Promise that resolves when the API is loaded.
   *
   * @returns {Promise<void>} A promise that resolves when the API is successfully loaded.
   */
  static loadAPI() {
    return new Promise((resolve, reject) => {
      // Resolve immediately if the Rutube API is already loaded.
      if (window.Rutube) {
        resolve();
        return;
      }

      window.videoPlayerApiPath = "./VideoController/src/rutube-lib.js?v={{{ PRODUCT_VERSION }}}";
      const script = document.createElement("script");
      script.src = window.videoPlayerApiPath;
      script.onload = () => {
        // If the API has loaded and window.Rutube is available, call the API ready callback and resolve.
        // if (window.Rutube) {
        window.onRutubeIframeAPIReady();
        resolve();
        // } else {
        //   reject(new Error("Rutube API did not initialize properly"));
        // }
      };
      script.onerror = () => {
        script.remove();
        reject(new Error("Failed to load Rutube API"));
      };

      // Append the script to the document head to start loading.
      document.head.appendChild(script);
    });
  }

  /**
   * Initializes the Rutube player.
   * Creates the player and attaches events similar to YouTubePlayer.
   */
  init() {
    Log.debug("init: " + this.videoId);
    // Assume the Rutube API is already loaded.
    // Create a new Rutube player instance.
    const player = new Rutube();
    player.Player(this.elementId, {
      width: 320,
      height: 180,
      videoId: this.videoId,
      events: {
        onReady: this.onPlayerReady.bind(this),
        onStateChange: this.onPlayerStateChange.bind(this),
        onError: this.onError.bind(this),
      },
      // Additional parameters (like loop) can be added if supported.
    });
    // Save the player reference in this.player.
    this.player = player;
  }

  /**
   * Event handler when the Rutube player is ready.
   * Sets the default volume.
   * @param {Object} event
   */
  onPlayerReady(event) {
    Log.always("Rutube player is ready.", event);
    this.setupSize();
    // Set default volume to 100% if setVolume is supported.
    if (this.player && typeof this.player.setVolume === "function") {
      this.setVolume(this.volume);
    }
    if (!this.videoId) {
      Log.debug("No initial video loaded.");
    } else {
      if (this.autoPlayEnabled) {
        setTimeout(() => this.playVideo(), 700);
      }
    }
  }

  /**
   * Event handler for Rutube player state changes.
   * If the video ended and looping is enabled, restarts playback.
   * If the video is paused and it was not triggered by code, auto-resumes playback.
   * If the pause was triggered by code, resets the flag.
   * @param {Object} event - Expected to contain a property `playerState` similar to:
   *                         { PLAYING: 0, PAUSED: 1, STOPPED: 0, ENDED: 0 }
   */
  onPlayerStateChange(event) {
    Log.debug(
      `onPlayerStateChange: [state=${JSON.stringify(
        event.playerState
      )}][duration=${this.player.currentDuration()}][videoPlaybackAllowed=${
        this.videoPlaybackAllowed
      }]`
    );
    if (event.playerState && event.playerState.ENDED) {
      window.onPlayerStateChange("ENDED");
      if (this.loopEnabled) {
        Log.debug(
          "Rutube: Video ended; looping is enabled, restarting playback."
        );
        this.playVideo();
      }
    } else if (event.playerState && event.playerState.PAUSED) {
      window.onPlayerStateChange("PAUSED");
      if (this.pauseTriggeredByCode) {
        this.pauseTriggeredByCode = false;
        Log.debug("Rutube: Pause triggered by code; auto-resume suppressed.");
      } else {
        Log.debug("Rutube: User paused video; auto-resuming.");
        this.playVideo();
      }
    } else if (event.playerState && event.playerState.PLAYING) {
      if (this.videoPlaybackAllowed) {
        window.onPlayerStateChange("PLAYING");
        window.onVideoStartPlaying();
        this.isPlayingNow = true;
        if (this.player.currentDuration() > 0.1 && this.videoPlaybackAllowed) {
          this.seekTo(0);
        }
        return;
      }
    } else if (event.playerState && event.playerState.STOPPED) {
      window.onPlayerStateChange("STOPPED");
    }
    this.isPlayingNow = false;
  }

  /**
   * Event handler for Rutube player error.
   * @param {Object} event
   */
  onError(event) {
    Log.error(`onError: [code=${event.code}][test=${event.text}]`);
    window.onVideoError(event.code, event.text);
  }

  /**
   * Plays the video using Rutube API.
   */
  playVideo() {
    Log.debug("Rutube playVideo()");

    if (!this.videoPlaybackAllowed) {
      Log.warn("Video playback is currently not allowed.");
      return;
    }

    if (this.player && typeof this.player.play === "function") {
      this.player.play();
    }
  }

  /**
   * Pauses the video using Rutube API.
   * Sets a flag so that auto-resume is suppressed.
   */
  pauseVideo() {
    if (this.player && typeof this.player.pause === "function") {
      this.pauseTriggeredByCode = true;
      this.player.pause();
    }
  }

  /**
   * Stops the video using Rutube API.
   */
  stopVideo() {
    if (this.player && typeof this.player.stop === "function") {
      this.player.stop();
    }
  }

  /**
   * Changes the current video to a new one.
   * @param {string} newVideoId - The new Rutube video ID.
   */
  changeVideo(newVideoId) {
    if (this.player && typeof this.player.changeVideo === "function") {
      Log.debug("Rutube changeVideo to " + newVideoId);
      this.player.changeVideo({ id: newVideoId });
      this.videoId = newVideoId;
    }
  }

  /**
   * Sets the volume of the player.
   * @param {number} volume - The volume level (0 to 100).
   */
  setVolume(volume) {
    this.volume = volume;
    if (this.player && typeof this.player.setVolume === "function") {
      this.player.setVolume({ volume: volume / 100 });
    } else {
      Log.warn("Rutube setVolume not implemented.");
    }
  }

  /**
   * Mutes the player.
   */
  muteVideo() {
    if (this.player && typeof this.player.mute === "function") {
      this.player.mute();
    } else {
      Log.warn("Rutube muteVideo not implemented.");
    }
  }

  /**
   * Unmutes the player.
   */
  unmuteVideo() {
    if (this.player && typeof this.player.unMute === "function") {
      this.player.unMute();
    } else {
      Log.warn("Rutube unmuteVideo not implemented.");
    }
  }

  /**
   * Returns true if the video is currently playing.
   * Note: Rutube API may not support checking the player state; this returns a stub value.
   * @returns {boolean}
   */
  isPlaying() {
    // Implement this method if Rutube API provides player state info.
    return this.isPlayingNow;
  }

  /**
   * Sets the current time of video.
   * @param {number} time - The current time in seconds.
   */
  seekTo(time) {
    if (this.player && typeof this.player.seekTo === "function") {
      Log.debug("seekTo: " + time);
      this.player.seekTo({ time: time });
    } else {
      Log.warn("Rutube seekTo not implemented.");
    }
  }

  setupSize() {
    const iframe = document.getElementById("rt-player");
    if (iframe) {
      iframe.style.width = 100 + "%";
      iframe.style.height = 100 + "%";
      Log.debug(`Rutube player size updated`);
    } else {
      Log.warn("Rutube iframe not found for resizing.");
    }
  }

  /**
   * Set video playback allowed state
   */
  setVideoPlaybackAllowed(allowed) {
    this.videoPlaybackAllowed = Boolean(allowed);
  }

  /**
   * Get video id
   */
  getVideoId() {
    return this.videoId;
  }
}
