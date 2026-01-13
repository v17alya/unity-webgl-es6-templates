// YouTubePlayer.js
import { Log } from "../../src/logger.module.js?v={{{ PRODUCT_VERSION }}}";

export default class YouTubePlayer {
  /**
   * Creates an instance of YouTubePlayer.
   * @param {string} elementId - The DOM element id where the player will be created.
   * @param {boolean} autoPlayEnabled - Whether autoplay is enabled.
   * @param {boolean} videoPlaybackAllowed - Whether video playback is allowed.
   * @param {float} volume - Default volume.
   * @param {string} videoId - The YouTube video ID (empty string if no video is loaded initially).
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
    this.player = null;
    // Flag to indicate if pause was triggered by code.
    this.pauseTriggeredByCode = false;
    this.playerState = -1;
    this.videoPausedOrStoppedByCode = false;
    this.videoPlaybackAllowed = videoPlaybackAllowed;
    this.volume = volume;
  }

  /**
   * Static method to load the YouTube IFrame API.
   * Returns a Promise that resolves when the API is loaded.
   *
   * @returns {Promise<void>} A promise that resolves when the API is successfully loaded.
   */
  static loadAPI() {
    return new Promise((resolve, reject) => {
      // Resolve immediately if the YouTube API is already loaded.
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }

      window.videoPlayerApiPath = "https://www.youtube.com/iframe_api";
      const tag = document.createElement("script");
      tag.src = window.videoPlayerApiPath;
      tag.onload = () => {
        // If the API has loaded and window.YT.Player is available, resolve.
        // if (window.YT && window.YT.Player) {
        resolve();
        // } else {
        //   reject(new Error("YouTube API did not initialize properly"));
        // }
      };
      tag.onerror = () => {
        tag.remove();
        reject(new Error("Failed to load YouTube API"));
      };

      // Insert the script before the first existing script tag.
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    });
  }

  /**
   * Initializes the YouTube player with the desired parameters.
   */
  init() {
    this.videoPausedOrStoppedByCode = false;
    this.player = new YT.Player(this.elementId, {
      videoId: this.videoId, // If empty, no video loads initially.
      playerVars: {
        controls: 0, // Hide native controls.
        disablekb: 1, // Disable keyboard interactions.
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        autoplay: this.autoPlayEnabled ? 1 : 0, // Do not autoplay.
        enablejsapi: 1,
        loop: this.loopEnabled ? 1 : 0, // Enable looping if loopEnabled is true.
        // For looping to work, playlist must be set to the video id.
        playlist: this.loopEnabled ? this.videoId : undefined,
      },
      events: {
        onReady: this.onPlayerReady.bind(this),
        onError: this.onPlayerError.bind(this),
        // onStateChange: this.onPlayerStateChange.bind(this),
      },
    });
  }

  /**
   * Event handler when the player is ready.
   * Sets the default volume.
   * @param {Object} event
   */
  onPlayerReady(event) {
    Log.always("YouTube player is ready. " + this.volume);
    if (this.player && typeof this.player.setVolume === "function") {
      this.setVolume(this.volume);
    }
    if (this.player) {
      // it's a cratch, because onPlayerStateChange not always triggered from YT.Player constructor (https://stackoverflow.com/questions/17078094/youtube-iframe-player-api-onstatechange-not-firing)
      setInterval(() => {
        const state = this.player.getPlayerState();
        if (this.playerState !== state) {
          this.onPlayerStateChange({ data: state });
        }
      }, 10);
    }
    if (!this.videoId) {
      Log.warn("No initial video loaded.");
    }
  }

  /**
   * Event handler for player state changes.
   * If the video ends and looping is enabled, restarts playback.
   * If the video is paused (and it wasn't triggered by code), auto-resumes playback.
   * If the pause was triggered by code, resets the flag.
   * @param {Object} event
   */
  onPlayerStateChange(event) {
    Log.debug("onPlayerStateChange: " + event.data);
    this.playerState = event.data;
    if (event.data === YT.PlayerState.ENDED) {
      window.onPlayerStateChange("ENDED");
      if (this.loopEnabled) {
        Log.debug("Video ended; looping is enabled, restarting playback.");
        this.playVideo();
      }
    } else if (event.data === YT.PlayerState.PAUSED) {
      window.onPlayerStateChange("PAUSED");
      if (this.pauseTriggeredByCode) {
        this.pauseTriggeredByCode = false;
        Log.debug("Pause triggered by code; auto-resume suppressed.");
      } else {
        Log.debug("User paused video; auto-resuming.");
        this.playVideo();
      }
    } else if (event.data === YT.PlayerState.PLAYING) {
      window.onPlayerStateChange("PLAYING");
      this.videoPausedOrStoppedByCode = false;
      window.onVideoStartPlaying();
    } else if (event.data === YT.PlayerState.CUED) {
      window.onPlayerStateChange("CUED");
      Log.debug(
        `onPlayerStateChange: cued [autoPlayEnabled=${this.autoPlayEnabled}]`
      );
      if (this.autoPlayEnabled && !this.videoPausedOrStoppedByCode) {
        this.playVideo();
      }
    } else if (event.data === YT.PlayerState.STOPPED) {
      window.onPlayerStateChange("STOPPED");
    } else {
      // window.onPlayerStateChange("?");
    }
  }

  /**
   * Event handler for player errors.
   * Logs error details based on the error code.
   *
   * Error codes:
   *  - 2: Invalid video ID.
   *  - 5: Unsupported HTML5 player request.
   *  - 100: Video deleted or private.
   *  - 101 / 150: Video does not allow embedding.
   *
   * @param {Object} event - The error event object.
   */
  onPlayerError(event) {
    Log.error("onPlayerError: " + event.data);
    let text = "?";
    switch (event.data) {
      case 2:
        text = "❌ Invalid video ID.";
        break;
      case 5:
        text = "❌ Unsupported HTML5 player request.";
        break;
      case 100:
        text = "❌ Video has been deleted or is private.";
        break;
      case 101:
      case 150:
        text = "❌ Video embedding is not allowed.";
        break;
      default:
        text = "❌ Unknown error occurred: " + event.data;
    }

    Log.error(text);
    window.onVideoError(event.data, text);
  }

  /**
   * Plays the video.
   */
  playVideo() {
    Log.debug("YouTube playVideo()");

    if (!this.videoPlaybackAllowed) {
      Log.warn("Video playback is currently not allowed.");
      return;
    }

    if (this.player && typeof this.player.playVideo === "function") {
      this.videoPausedOrStoppedByCode = false;
      this.player.playVideo();
    }
  }

  /**
   * Pauses the video.
   * Sets a flag so that auto-resume is suppressed.
   */
  pauseVideo() {
    if (this.player && typeof this.player.pauseVideo === "function") {
      this.pauseTriggeredByCode = true;
      this.videoPausedOrStoppedByCode = true;
      this.player.pauseVideo();
    }
  }

  /**
   * Stops the video.
   */
  stopVideo() {
    if (this.player && typeof this.player.stopVideo === "function") {
      this.videoPausedOrStoppedByCode = true;
      this.player.stopVideo();
    }
  }

  /**
   * Changes the current video to a new one without autoplay.
   * Uses loadVideoById so that the new video is loaded but not automatically played or use cueVideoById to autoplay.
   * @param {string} newVideoId - The new YouTube video ID.
   */
  changeVideo(newVideoId) {
    if (this.player && typeof this.player.loadVideoById === "function") {
      Log.debug("YouTube changeVideo to " + newVideoId);
      this.videoPausedOrStoppedByCode = false;
      if (!this.autoPlayEnabled) this.player.cueVideoById(newVideoId);
      else this.player.loadVideoById(newVideoId);
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
      this.player.setVolume(volume);
    }
  }

  /**
   * Mutes the player.
   */
  muteVideo() {
    if (this.player && typeof this.player.mute === "function") {
      this.player.mute();
    }
  }

  /**
   * Unmutes the player.
   */
  unmuteVideo() {
    if (this.player && typeof this.player.unMute === "function") {
      this.player.unMute();
    }
  }

  /**
   * Returns true if the video is currently playing.
   * @returns {boolean}
   */
  isPlaying() {
    if (this.player && typeof this.player.getPlayerState === "function") {
      return this.player.getPlayerState() === YT.PlayerState.PLAYING;
    }
    return false;
  }

  /**
   * Seeks to a specified time in the video. If the player is paused when the function is called, it will remain paused. If the function is called from another state (playing, video cued, etc.), the player will play the video.
   * @param {number} time - The current time in seconds.
   * @param {boolean} allowSeekAhead - The allowSeekAhead parameter determines whether the player will make a new request to the server if the seconds parameter specifies a time outside of the currently buffered video data. We recommend that you set this parameter to false while the user drags the mouse along a video progress bar and then set it to true when the user releases the mouse. This approach lets a user scroll to different points of a video without requesting new video streams by scrolling past unbuffered points in the video. When the user releases the mouse button, the player advances to the desired point in the video and requests a new video stream if necessary.
   */
  seekTo(time, allowSeekAhead = true) {
    if (this.player && typeof this.player.seekTo === "function") {
      this.player.seekTo(time, allowSeekAhead);
    } else {
      Log.warn("YouTube seekTo not implemented.");
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
