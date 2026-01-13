import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

// audio_controller.module.js
export const AudioPlayer = (function () {
  // Default/fallback audio list (bundled asset)
  const defaultAudioUrls = ["audio/CrazyGames.mp3"];
  const defaultVolume = 0.05;
  const maxVolume = 1;
  const allowZeroVolume = true;
  // Active playlist (can be replaced at runtime from Unity)
  let audioUrls = [...defaultAudioUrls];
  let currentAudioIndex = 0;
  let bgAudio;
  let currentUrl;
  let playAudioTimeoutId = null; // Variable to store the timeout ID
  let audioPlaybackAllowed = true; // Flag indicating whether audio playback is allowed.
  let onEndedHandlerAttached = false;
  let playlistOverridden = false; // true if a custom playlist was applied

  // Capability detection: expose simple format support to C# via jslib
  function detectAudioSupport(probeAudio) {
    try {
      const audio = probeAudio || bgAudio || new Audio();
      const canPlay = (mime) => {
        if (!audio || !audio.canPlayType) return false;
        const res = audio.canPlayType(mime);
        return !!res && res !== "";
      };
      return {
        mp3: canPlay("audio/mpeg"),
        ogg: canPlay('audio/ogg; codecs="vorbis"'),
        ogg_opus: canPlay('audio/ogg; codecs="opus"'),
        webm_opus: canPlay('audio/webm; codecs="opus"'),
        aac: canPlay('audio/aac'),
        m4a: canPlay('audio/mp4; codecs="mp4a.40.2"') || canPlay('audio/x-m4a'),
        wav: canPlay('audio/wav; codecs="1"') || canPlay('audio/wav'),
        flac: canPlay('audio/flac') || canPlay('audio/x-flac'),
      };
    } catch {
      return { mp3: true };
    }
  }

  function detectPreferredFormats(supportedFormats) {
    try {
      const ua = navigator.userAgent || "";
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const isSafari = (/Safari\//.test(ua) && !/Chrome\//.test(ua)) || isIOS;

      // Base orders
      const safariOrder = ["m4a", "aac", "mp3", "ogg", "flac", "wav"]; // opus/webm often not reliable on Safari
      const defaultOrder = ["ogg_opus", "webm_opus", "ogg", "mp3", "m4a", "aac", "flac", "wav"];
      const order = isSafari ? safariOrder : defaultOrder;

      // Filter by support, but keep order
      const preferred = order.filter(fmt => {
        switch (fmt) {
          case "ogg_opus": return supportedFormats.includes("ogg_opus");
          case "webm_opus": return supportedFormats.includes("webm_opus");
          case "m4a": return supportedFormats.includes("m4a");
          case "aac": return supportedFormats.includes("aac");
          case "mp3": return supportedFormats.includes("mp3");
          case "ogg": return supportedFormats.includes("ogg");
          case "flac": return supportedFormats.includes("flac");
          case "wav": return supportedFormats.includes("wav");
          default: return false;
        }
      });
      return preferred;
    } catch {
      return ["mp3"]; // safe fallback
    }
  }

  function initAudioSupport(probeAudio) {
    try {
      window.UnityWebGLApp = window.UnityWebGLApp || {};
      window.UnityWebGLApp.AudioSupportedFormats = detectAudioSupport(probeAudio);
      window.UnityWebGLApp.AudioPreferredFormats = detectPreferredFormats(window.UnityWebGLApp.AudioSupportedFormats);
    } catch {}
  }

  function getSupportedFormats(probeAudio) {
    return window.UnityWebGLApp?.AudioSupportedFormats || detectAudioSupport(probeAudio);
  }

  function getPreferredFormats() {
    return window.UnityWebGLApp?.AudioPreferredFormats || detectPreferredFormats(getSupportedFormats());
  }

  // Helper function for consistent error messages
  function checkAudioExists(audioObject) {
    if (!audioObject) {
      Log.warn("Audio object does not exist.");
      return false;
    }
    return true;
  }

  // Function to create an Audio object without a source
  function createAudio() {
    return new Audio();
  }

  // Function to set the URL source for the audio
  function setAudioSource(audioObject, audioUrl) {
    if (!checkAudioExists(audioObject)) return;

    if (currentUrl !== audioUrl) {
      currentUrl = audioUrl;
      audioObject.src = audioUrl;
      audioObject.load(); // Reloads the new audio source only if it's different
    } else {
      Log.debug("Audio source is already set to this URL. Skipping reload.");
    }
  }

  // Function to play the audio with readiness check
  function playAudio(audioObject) {
    Log.debug("playAudio");
    audioPlaybackAllowed = true;
    if (!checkAudioExists(audioObject)) return;
    attemptPlayAudio(audioObject);
  }

  // Function to resume the audio
  function resumeAudio(audioObject) {
    Log.debug("resumeAudio");
    audioPlaybackAllowed = true;
    if (!checkAudioExists(audioObject)) return;
    attemptPlayAudio(audioObject);
    // audioObject.play();
  }

  // Function to pause the audio
  function pauseAudio(audioObject) {
    Log.debug("pauseAudio");
    stopScheduleAttemptPlayAudio();
    audioPlaybackAllowed = false;
    if (!checkAudioExists(audioObject)) return;
    audioObject.pause();
  }

  // Function to set the audio volume
  function setVolume(audioObject, volumeLevel) {
    if (!checkAudioExists(audioObject)) return;

    if (volumeLevel <= 0) volumeLevel = allowZeroVolume ? 0 : 0.01;
    else if (volumeLevel >= 1) volumeLevel = 1;

    if (volumeLevel > maxVolume) volumeLevel = maxVolume;
    audioObject.volume = volumeLevel;
  }

  // Function to get the current audio volume
  function getVolume(audioObject) {
    return checkAudioExists(audioObject) ? audioObject.volume : 0;
  }

  // Function to set looping for the audio
  function setLoop(audioObject, loop) {
    if (!checkAudioExists(audioObject)) return;
    audioObject.loop = loop;
  }

  // Function to set muting for the audio
  function setMute(audioObject, mute) {
    if (!checkAudioExists(audioObject)) return;
    audioObject.muted = mute;
  }

  // Function to check if the audio is currently playing
  function isAudioPlaying(audioObject) {
    return audioObject && !audioObject.paused;
  }

  // Function to check if the audio is ready to play
  function isAudioReady(audioObject) {
    return audioObject && audioObject.readyState >= 3;
  }

  // Function to play the next audio clip in the list
  function playNextBgClip() {
    Log.debug("playNextBgClip");
    currentAudioIndex = (currentAudioIndex + 1) % audioUrls.length;
    setAudioSource(bgAudio, audioUrls[currentAudioIndex]);
    playAudio(bgAudio);
  }

  // Function to attempt to play audio with error handling and readiness check
  function attemptPlayAudio(audioObject) {
    Log.debug("attemptPlayAudio");
    if (!checkAudioExists(audioObject)) return;
    stopScheduleAttemptPlayAudio();
    if (!audioPlaybackAllowed) return;
    audioObject.removeEventListener("canplaythrough", canPlayThroughHandler);

    // Check if audio is ready to play
    if (isAudioReady(audioObject)) {
      Log.debug("Audio is ready. Attempting playback...");

      if (isAudioPlaying(audioObject)) {
        if (audioObject.muted) onMutedAudioPlaying();
        return;
      }

      // setMute(audioObject, true); // Mute temporarily to bypass restrictions
      audioObject
        .play()
        .then(() => {
          Log.debug(
            `Audio started playing successfully. playing? ${isAudioPlaying(
              audioObject
            )}`
          );
          if (audioObject.muted) {
            onMutedAudioPlaying();
            return;
          }

          if (!isAudioPlaying(audioObject)) {
            scheduleAttemptPlayAudio(audioObject);
          }
        })
        .catch((error) => {
          Log.warn(`Audio play was not allowed: ${error.message}`);
          scheduleAttemptPlayAudio(audioObject);

          // if (error.name === "NotAllowedError") {
          //   Log.warn(`Audio play was not allowed: ${error.message}`);
          //   unmuteAudioOnInteraction();
          // } else {
          //   Log.error("An unexpected error occurred:", error);
          //   unmuteAudioOnInteraction();
          // }
        });
    } else {
      Log.debug("Audio is not ready. Waiting for canplaythrough...");
      audioObject.addEventListener("canplaythrough", canPlayThroughHandler, {
        once: true,
      });
    }

    function onMutedAudioPlaying() {
      Log.debug("onMutedAudioPlaying");
      setMute(audioObject, false); // Unmute after successful playback
      Log.debug(
        `Audio is muted now. playing? ${isAudioPlaying(audioObject)}`
      );

      if (!isAudioPlaying(audioObject)) {
        scheduleAttemptPlayAudio(audioObject);
      } else restartAudio(audioObject);
    }
  }

  function stopScheduleAttemptPlayAudio() {
    // Clear the previous timeout if it exists, stopping the previous attempt
    if (playAudioTimeoutId) {
      clearTimeout(playAudioTimeoutId);
      playAudioTimeoutId = null;
    }
  }

  function scheduleAttemptPlayAudio(audioObject) {
    // Clear the previous timeout if it exists, stopping the previous attempt
    stopScheduleAttemptPlayAudio();

    // Schedule a new timeout and store its ID
    playAudioTimeoutId = setTimeout(() => {
      attemptPlayAudio(audioObject);
      playAudioTimeoutId = null; // Reset the ID after the function executes
    }, 1000);
  }

  // Function to restart audio
  function restartAudio(audioObject) {
    Log.debug("restartAudio");
    if (!checkAudioExists(audioObject)) return;
    audioObject.currentTime = 0;
    if (!isAudioPlaying(audioObject)) attemptPlayAudio(audioObject);
  }

  // Function to add a click event listener to unmute and play audio on user interaction
  function unmuteAudioOnInteraction() {
    document.removeEventListener("click", audioClickHandler);
    document.addEventListener("click", audioClickHandler, {
      once: true,
    });
  }

  // Event handler for unmuting and playing the audio
  function audioClickHandler() {
    if (!checkAudioExists(bgAudio)) return;
    if (bgAudio.muted) {
      setMute(bgAudio, false); // Unmute after successful playback
      bgAudio.currentTime = 0;
      attemptPlayAudio(bgAudio);
    } else if (!isAudioPlaying(bgAudio)) {
      attemptPlayAudio(bgAudio);
    }
  }

  // Handler for canplaythrough event
  function canPlayThroughHandler() {
    Log.debug("Audio has been loaded.");
    attemptPlayAudio(bgAudio); // Try to play the audio
  }

  // Function to get currentAudioIndex
  function getCurrentAudioIndex() {
    return currentAudioIndex;
  }

  // Function to set currentAudioIndex
  function setCurrentAudioIndex(index) {
    if (index >= 0 && index < audioUrls.length) {
      currentAudioIndex = index;
    } else {
      Log.warn("Invalid audio index.");
    }
  }

  // Initialize audio with source URL, volume, and loop settings
  function initializeAudio(loop = false) {
    if (checkAudioExists(bgAudio)) return bgAudio;
    audioPlaybackAllowed = true;
    bgAudio = createAudio();
    setAudioSource(bgAudio, audioUrls[0]); // Set the URL for the audio
    setVolume(bgAudio, defaultVolume); // Set volume
    setLoop(bgAudio, loop); // Enable looping
    setMute(bgAudio, true); // Mute temporarily to bypass restrictions
    playAudio(bgAudio); // Try to play the audio
    initAudioSupport(bgAudio);
    unmuteAudioOnInteraction();

    if (!loop) {
      attachOnEnded();
    }

    return bgAudio;
  }

  function detachOnEnded() {
    if (!bgAudio || !onEndedHandlerAttached) return;
    try { bgAudio.removeEventListener("ended", playNextBgClip); } catch {}
    onEndedHandlerAttached = false;
  }

  function attachOnEnded() {
    if (!bgAudio || onEndedHandlerAttached) return;
    try { bgAudio.addEventListener("ended", playNextBgClip); onEndedHandlerAttached = true; } catch {}
  }

  // Allows Unity to set a new playlist at runtime.
  // urls: string[] absolute URLs. If length === 0 -> resets to default.
  function setPlaylist(urls) {
    try {
      if (!Array.isArray(urls)) {
        Log.warn("setPlaylist: invalid payload");
        return;
      }
      if (urls.length === 0) {
        resetToDefault();
        return;
      }
      // Replace playlist and restart from first track
      playlistOverridden = true;
      audioUrls = urls.slice();
      currentAudioIndex = 0;
      if (!bgAudio) initializeAudio(urls.length === 1);
      setLoop(bgAudio, urls.length === 1);
      if (urls.length > 1) attachOnEnded(); else detachOnEnded();
      setAudioSource(bgAudio, audioUrls[0]);
      playAudio(bgAudio);
    } catch (e) {
      Log.error("setPlaylist error:", e);
    }
  }

  // Resets playlist to default bundled audio and loops it.
  function resetToDefault() {
    // No-op if a custom playlist was never applied
    if (!playlistOverridden) return;
    playlistOverridden = false;
    audioUrls = [...defaultAudioUrls];
    currentAudioIndex = 0;
    if (!bgAudio) initializeAudio(true);
    setLoop(bgAudio, true);
    detachOnEnded();
    setAudioSource(bgAudio, audioUrls[0]);
    playAudio(bgAudio);
  }

  // Public API for the AudioPlayer module
  return {
    initializeAudio,
    playAudio,
    resumeAudio,
    pauseAudio,
    setVolume,
    getVolume,
    setLoop,
    restartAudio,
    playNextBgClip,
    getCurrentAudioIndex,
    setCurrentAudioIndex,
    setPlaylist,
    resetToDefault,
    getPreferredFormats,
    getSupportedFormats,
  };
})();
