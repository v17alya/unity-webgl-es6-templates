// unity.module.js
// Unity WebGL bootstrap & loader helpers

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";   // ← central logger

import { Events }                                from "./analytics_events.module.js?v={{{ PRODUCT_VERSION }}}";
import { AnalyticsState }      from "./analytics.module.js?v={{{ PRODUCT_VERSION }}}";
import { onWebGLError }                     from "./webgl_error_loader.module.js?v={{{ PRODUCT_VERSION }}}";
import { setUnityBuildLoadProgress, setUnityBuildBootProgress }                 from "./progress_ui.module.js?v={{{ PRODUCT_VERSION }}}";
import { sendEvent }                        from "./amplitude.module.js?v={{{ PRODUCT_VERSION }}}";
// import { stopChecking }                  from "./fetch_progress_checker.module.js?v={{{ PRODUCT_VERSION }}}"
import { Cookies }                     from "./cookies_constants.module.js?v={{{ PRODUCT_VERSION }}}";

/* ───── runtime flags ───────────────────────────────────────────── */
let loadFinished       = false;
let loadStarted        = false;
let hasEverLostFocus   = false;
let lastLoggedProgress = 0;
let fakeProgressInterval = null;

/* ===================================================================
 *  PUBLIC CALLBACKS
 * ==================================================================*/

export function onMainScriptLoaded(config) {
  Log.debug("onMainScriptLoaded");
  sendEvent(Events.Unity_WebGL_Hello_world);
  return startCreateUnityInstance(config);
}

export function showBuild() {
  Log.debug("showBuild");
  stopFakeProgress();
  setUnityBuildBootProgress(1);
  setTimeout(() => {
    sendEvent(Events.Hide_Loader);
    document.getElementById("loader_canvas_div")?.remove();
  }, 600);
}

export function helloBuild() {
  Log.debug("helloBuild");
  sendEvent(Events.Build_Hello_World);
}

export function loadMobileContent() {
  sendEvent(Events.Games_Mobile_Browser_Opened);

  const meta        = document.createElement("meta");
  meta.name         = "viewport";
  meta.content      = "initial-scale=1.0";
  document.head.appendChild(meta);

  const xhr = new XMLHttpRequest();
  xhr.open("GET", "html/mobile.html", true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      const tmp = document.createElement("div");
      tmp.innerHTML = xhr.responseText;

      tmp.querySelectorAll("style").forEach((s) => document.head.appendChild(s));

      const mobileDiv     = tmp.querySelector(".mobile-container");
      const mobileContent = document.getElementById("mobile-content");
      mobileContent.appendChild(mobileDiv);
      mobileContent.style.display = "block";
      mobileDiv.style.display     = "flex";
      window.UnityWebGLApp.unityContainer.style.display = "none";
    }
  };
  xhr.send();
}

/* ===================================================================
 *  CONFIG builder (unchanged logic)
 * ==================================================================*/

/**
 * Builds the Unity loader configuration.
 * @param {Object} payStationOptions
 * @param {string} payStationOptions.dataFilePcUrl - URL for PC data file
 * @param {string} payStationOptions.dataFileMobileUrl - URL for mobile data file
 * @param {string} payStationOptions.frameworkUrl - URL for Unity framework file
 * @param {string} payStationOptions.streamingAssetsUrl - URL for streaming assets folder
 * @param {string} payStationOptions.buildUrl - Base build folder URL for worker/memory/symbols
 * @param {string} payStationOptions.companyName
 * @param {string} payStationOptions.productName
 * @param {string} payStationOptions.productVersion
 * @param {boolean} payStationOptions.unityShowBanner - showBanner callback
 * @param {Object} [payStationOptions.extraUrls] - optional extra urls: { workerUrl, codeUrl, memoryUrl, symbolsUrl }
 * @returns {Object} Unity loader configuration
 */
export function getConfig(options) {
  let dataUrl = options.dataFilePcUrl;
  if (options.dataFileMobileUrl && !options.dataFileMobileUrl.startsWith("DATA_FILE_")) {
    const gl  = document.createElement("canvas").getContext("webgl");
    const gl2 = document.createElement("canvas").getContext("webgl2");
    const astcSupported =
      (gl && gl.getExtension("WEBGL_compressed_texture_astc")) ||
      (gl2 && gl2.getExtension("WEBGL_compressed_texture_astc"));
    if (astcSupported) dataUrl = options.dataFileMobileUrl;
  }
  Log.debug("dataFileUrl:", dataUrl);

  const config = {
    dataUrl,
    frameworkUrl:       options.frameworkUrl,
    streamingAssetsUrl: options.streamingAssetsUrl,
    companyName:        options.companyName,
    productName:        options.productName,
    productVersion:     options.productVersion,
    showBanner:         options.unityShowBanner ?? unityShowBanner,
    cacheControl: function (url) {
      // Caching enabled for .data and .bundle files.
      // Revalidate if file is up to date before loading from cache
      //if (url.match(/\.data/) || url.match(/\.bundle/) || url.match(/\.wasm/)) {
      if (url.match(/\.bundle/)) {
          return "must-revalidate";
          //return "immutable";
      }

      // // Caching enabled for .mp4 and .custom files
      // // Load file from cache without revalidation.
      if (url.match(/\.data/) || url.match(/\.wasm/)) {
          return "immutable";
      }
      // // Caching enabled for .mp4 and .custom files
      // // Load file from cache without revalidation.
      // if (url.match(/\.mp4/) || url.match(/\.custom/)) {
      //     return "immutable";
      // }

      // Disable explicit caching for all other files.
      // Note: the default browser cache may cache them anyway.
      return "no-store";
    },
  };
  if (options.workerUrl)  config.workerUrl  = options.workerUrl;
  if (options.codeUrl)    config.codeUrl    = options.codeUrl;
  if (options.memoryUrl)  config.memoryUrl  = options.memoryUrl;
  if (options.symbolsUrl) config.symbolsUrl = options.symbolsUrl;

  return config;
}

/* ===================================================================
 *  FOCUS tracking
 * ==================================================================*/

export function onFocusChanged(hasFocus) {
  if (hasFocus) {
    if (!hasEverLostFocus) return;
    sendEvent(Events.HTML_FocusLost_Ended);
    Log.debug("Focus restored");
  } else {
    hasEverLostFocus = true;
    sendEvent(Events.HTML_FocusLost_Started);
    Log.debug("Focus lost");
  }
}

/* ===================================================================
 *  AUTH helper
 * ==================================================================*/

/**
 * Checks if the user is authorized via Xsolla or Firebase by looking
 * for stored tokens in localStorage.
 * @returns {boolean} True if an access token or metaframe token exists, false otherwise.
 */
export function isUserAuthorized() {
  const at  = localStorage.getItem(Cookies.ACCESS_TOKEN_PREFS_KEY);
  const mat = localStorage.getItem(Cookies.XSOLLA_METAFRAME_TOKEN_PREFS_KEY);
  return (!!at && at.trim()) || (!!mat && mat.trim());
}

/* ===================================================================
 *  INTERNAL helpers
 * ==================================================================*/

function updateProgress(p) {
  if (loadFinished) return;
  trackProgress(p);
  setUnityBuildLoadProgress(p);
  if (loadFinished) {
    startFakeProgress();
  }
}

/**
 * Boots the Unity build and returns the same Promise that
 * `createUnityInstance()` returns.  Rejects if WebGL‑2 is absent.
 *
 * @param {object} config – object produced by getConfig()
 * @returns {Promise<UnityInstance>}
 */
function startCreateUnityInstance(config) {
  Log.debug("startCreateUnityInstance");

  /* 1. capability check ------------------------------------------------ */
  if (!checkWebglSupport(AnalyticsState.basedEventProperty)) {
    const err = new Error("WebGL 2.0 is not supported.");
    Log.error(err.message);
    handleInitializationError({ Error: err.message, IsWebglError: true });
    return Promise.reject(err);
  }

  /* 2. fire analytics marker ------------------------------------------ */
  sendEvent(Events.Client_Build_Load_Started);

  /* 3. call Unity’s loader, track progress, forward the promise -------- */
  return createUnityInstance(window.UnityWebGLApp.unityCanvas, config, updateProgress)
    .then((instance) => {
      onBuildLoaded(instance);          // finish UI / analytics
      return instance;                  // propagate to caller
    })
    .catch((err) => {
      Log.error("Unity init error:", err);
      handleInitializationError({
        Error: err.message || err,
        IsWebglError: String(err).includes("WebGL"),
      });
      throw err;                        // keep rejection chain
    });
}

/**
 * Checks WebGL support, using props if valid, or falling back to direct detection.
 * If WebGL is unavailable or only WebGL1 is supported, triggers the error overlay.
 *
 * @param {Object} props - Optional properties object.
 * @param {boolean} props.WebGL_Available - Whether WebGL is reported available.
 * @param {string}  props.WebGL_Version   - Reported WebGL version ("WebGL1" or "WebGL2").
 * @returns {boolean} True if WebGL2 is supported; false otherwise.
 */
function checkWebglSupport(props) {
  const hasProps =
    props && typeof props.WebGL_Available === "boolean" && typeof props.WebGL_Version === "string";

  const available = hasProps
    ? props.WebGL_Available
    : !!(
        window.WebGLRenderingContext &&
        (document.createElement("canvas").getContext("webgl") ||
          document.createElement("canvas").getContext("experimental-webgl"))
      );

  const version = hasProps
    ? props.WebGL_Version
    : document.createElement("canvas").getContext("webgl2")
    ? "WebGL2"
    : "WebGL1";

  return available && version === "WebGL2";
}

/**
 * Centralized error handler for Unity initialization failures.
 * @param {Object} errorObj
 * @param {string} errorObj.Error       – descriptive error message
 * @param {boolean} errorObj.IsWebglError – whether this error is WebGL‑related
 */
function handleInitializationError(errorObj) {
  Log.error("handleInitializationError: " + errorObj.Error);
  sendEvent(Events.Game_Error_Initialization, { Error: errorObj.Error });

  if (errorObj.IsWebglError) {
    onWebGLError(null, window.UnityWebGLApp.isMobile);
  }
}

function onBuildLoaded(unityInstance) {
  Log.debug("build ready");

  if (window.UnityWebGLApp.focusTracker) {
    window.UnityWebGLApp.focusTracker.dispose();
    window.UnityWebGLApp.focusTracker = null;
  }
  // stopChecking();
  updateProgress(1);
  sendEvent(Events.Client_Build_Load_Finished);

  window.UnityWebGLApp.myGameInstance = unityInstance;
}

/**
 * Tracks loading progress and sends events at milestones.
 * @param {number} progress - Value between 0 and 1.
 */
function trackProgress(progress) {
  if (loadFinished) return;
  const pct = Math.floor(progress * 100);
  loadFinished = pct === 100;

  if (!loadStarted || pct >= lastLoggedProgress + 10 || loadFinished) {
    Log.debug(`Create_Unity_Instance_Progress: ${pct}%`);
    loadStarted = true;
    sendEvent(Events.Game_Create_Unity_Instance, {
      Progress: pct,
      IndexedDB_Available: AnalyticsState.indexedDB_Available,
    });
    lastLoggedProgress = pct;
  }
}

/**
 * Starts the fake progress interval.
 */
function startFakeProgress() {
  if (fakeProgressInterval) return;
  let fakeProgress = 0;
  fakeProgressInterval = setInterval(() => {
    fakeProgress += 0.01;
    setUnityBuildBootProgress(fakeProgress);
  }, 50);
}

/**
 * Stops the fake progress interval.
 */
function stopFakeProgress() {
  if (fakeProgressInterval) {
    clearInterval(fakeProgressInterval);
    fakeProgressInterval = null;
  }
}

/**
 * Initializes diagnostics UI: loads CSS, JS, creates icon, and sets up event handlers.
 * @param {boolean} isMobile - Whether the device is mobile.
 * @returns {Promise<{ ok: boolean, error?: unknown }>}
 */
export async function initDiagnostics(isMobile) {
  try {
    Log.debug("[diagnostics] Initializing diagnostics UI");

    // 1. Load CSS dynamically
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "TemplateData/diagnostics/diagnostics.css?v={{{ PRODUCT_VERSION }}}";
    document.head.appendChild(cssLink);

    // 2. Load diagnostics JS module
    const { unityDiagnostics } = await import("../TemplateData/diagnostics/diagnostics.js?v={{{ PRODUCT_VERSION }}}");

    // 3. Create diagnostics icon if it doesn't exist
    let diagnostics_icon = document.getElementById("diagnostics-icon");
    if (!diagnostics_icon) {
      diagnostics_icon = document.createElement("img");
      diagnostics_icon.id = "diagnostics-icon";
      diagnostics_icon.src = "TemplateData/diagnostics/webmemd-icon.png";
      
      // Position the icon based on device type
      if (isMobile) {
        diagnostics_icon.style.position = "fixed";
        diagnostics_icon.style.bottom = "10px";
        diagnostics_icon.style.right = "0px";
        const unityCanvas = document.getElementById("unity-canvas");
        if (unityCanvas) {
          unityCanvas.after(diagnostics_icon);
        } else {
          document.body.appendChild(diagnostics_icon);
        }
      } else {
        const unityFooter = document.getElementById("unity-footer");
        if (unityFooter) {
          unityFooter.appendChild(diagnostics_icon);
        } else {
          document.body.appendChild(diagnostics_icon);
        }
      }
    }

    // 4. Set up click handler
    diagnostics_icon.onclick = () => {
      const unityInstance = window.UnityWebGLApp?.myGameInstance;
      if (unityInstance && unityInstance.GetMemoryInfo) {
        unityDiagnostics.openDiagnosticsDiv(unityInstance.GetMemoryInfo);
      } else {
        Log.warn("[diagnostics] Unity instance or GetMemoryInfo not available yet");
      }
    };

    Log.debug("[diagnostics] Diagnostics UI initialized successfully");
    return { ok: true };
  } catch (err) {
    Log.error("[diagnostics] Failed to initialize diagnostics:", err);
    return { ok: false, error: err };
  }
}

function unityShowBanner(msg, type) {
  const warningBanner = document.querySelector("#unity-warning");

  function updateVisibility() {
    warningBanner.style.display = warningBanner.children.length ? "block" : "none";
  }

  const div = document.createElement("div");
  div.innerHTML = msg;
  warningBanner.appendChild(div);

  if (type === "error") div.style = "background: red; padding: 10px;";
  else {
    if (type === "warning") div.style = "background: yellow; padding: 10px;";
    setTimeout(() => {
      warningBanner.removeChild(div);
      updateVisibility();
    }, 5_000);
  }
  updateVisibility();
}
