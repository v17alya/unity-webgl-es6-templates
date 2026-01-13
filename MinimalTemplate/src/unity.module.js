/**
 * Unity WebGL bootstrap & loader helpers.
 * Handles Unity instance creation and progress tracking.
 */

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";
import { setUnityBuildLoadProgress } from "./progress_ui.module.js?v={{{ PRODUCT_VERSION }}}";

let loadFinished = false;
let loadStarted = false;

/**
 * Callback when Unity main script is loaded.
 * @param {Object} config - Unity loader configuration
 * @returns {Promise<void>}
 */
export function onMainScriptLoaded(config) {
  Log.debug("[unity] onMainScriptLoaded");
  return startCreateUnityInstance(config);
}

/**
 * Shows the Unity build (hides loader).
 */
export function showBuild() {
  Log.debug("[unity] showBuild");
  setUnityBuildLoadProgress(1);
  setTimeout(() => {
    const loaderDiv = document.getElementById("loader_canvas_div");
    if (loaderDiv) {
      loaderDiv.style.display = "none";
    }
    const unityContainer = document.getElementById("unity-container");
    if (unityContainer) {
      unityContainer.style.display = "block";
    }
  }, 300);
}

/**
 * Builds the Unity loader configuration.
 * @param {Object} options - Configuration options
 * @returns {Object} Unity loader configuration
 */
export function getConfig(options) {
  let dataUrl = options.dataFilePcUrl;
  
  // Use mobile data file if available and ASTC is supported
  if (options.dataFileMobileUrl && !options.dataFileMobileUrl.startsWith("DATA_FILE_")) {
    const gl = document.createElement("canvas").getContext("webgl");
    const gl2 = document.createElement("canvas").getContext("webgl2");
    const astcSupported =
      (gl && gl.getExtension("WEBGL_compressed_texture_astc")) ||
      (gl2 && gl2.getExtension("WEBGL_compressed_texture_astc"));
    if (astcSupported) {
      dataUrl = options.dataFileMobileUrl;
      Log.debug("[unity] Using mobile data file (ASTC supported)");
    }
  }
  
  Log.debug("[unity] dataFileUrl:", dataUrl);

  const config = {
    dataUrl,
    frameworkUrl: options.frameworkUrl,
    streamingAssetsUrl: options.streamingAssetsUrl,
    companyName: options.companyName,
    productName: options.productName,
    productVersion: options.productVersion,
    showBanner: unityShowBanner,
    cacheControl: function (url) {
      // Enable caching for .data and .bundle files
      if (url.match(/\.bundle/)) {
        return "must-revalidate";
      }
      if (url.match(/\.data/) || url.match(/\.wasm/)) {
        return "immutable";
      }
      // Disable explicit caching for other files
      return "no-store";
    },
  };

  if (options.workerUrl) config.workerUrl = options.workerUrl;
  if (options.codeUrl) config.codeUrl = options.codeUrl;
  if (options.memoryUrl) config.memoryUrl = options.memoryUrl;
  if (options.symbolsUrl) config.symbolsUrl = options.symbolsUrl;

  return config;
}

/**
 * Creates the Unity instance with progress tracking.
 * @param {Object} config - Unity loader configuration
 * @returns {Promise<void>}
 */
function startCreateUnityInstance(config) {
  return new Promise((resolve, reject) => {
    if (loadStarted) {
      Log.warn("[unity] Load already started");
      return;
    }
    loadStarted = true;

    Log.debug("[unity] Creating Unity instance with config:", config);

    if (typeof createUnityInstance === "undefined") {
      const err = new Error("createUnityInstance is not defined. Make sure Unity loader is loaded.");
      Log.error("[unity]", err);
      return reject(err);
    }

    createUnityInstance(config, (progress) => {
      const pct = Math.min(progress, 1.0);
      setUnityBuildLoadProgress(pct);
      Log.debug(`[unity] Load progress: ${Math.round(pct * 100)}%`);
    })
      .then((instance) => {
        loadFinished = true;
        Log.always("[unity] Unity instance created successfully");
        
        // Store instance globally for access from Unity
        window.GameTemplate = window.GameTemplate || {};
        window.GameTemplate.myGameInstance = instance;
        
        if (typeof Module !== "undefined") {
          Module.GameTemplate = Module.GameTemplate || {};
          Module.GameTemplate.myGameInstance = instance;
        }

        // Show the build
        showBuild();
        resolve();
      })
      .catch((error) => {
        loadFinished = false;
        loadStarted = false;
        Log.error("[unity] Failed to create Unity instance:", error);
        reject(error);
      });
  });
}

/**
 * Unity show banner callback (can be overridden).
 */
function unityShowBanner(msg, type) {
  Log.debug(`[unity] Banner: ${type} - ${msg}`);
}

/**
 * Initializes diagnostics UI: loads CSS, JS, creates icon, and sets up event handlers.
 * This is Unity's default diagnostics tool for monitoring memory usage.
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
      const unityInstance = window.GameTemplate?.myGameInstance;
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
