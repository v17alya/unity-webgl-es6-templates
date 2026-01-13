/**
 * Master bootstrapper for Unity WebGL template.
 * Initializes all subsystems in a staged, sequential manner.
 */

import { ErrorHandler } from "./errorHandler.module.js?v={{{ PRODUCT_VERSION }}}";
ErrorHandler.initialize();

import {
  IS_PRODUCTION,
  DEBUG,
  LOG_LEVEL,
  SHOW_DIAGNOSTICS,
} from "./config.module.js?v={{{ PRODUCT_VERSION }}}";
import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";
import { setBootstrapProgress } from "./progress_ui.module.js?v={{{ PRODUCT_VERSION }}}";

import {
  checkIfMobile,
  getSystemInfo,
  getDeviceName,
  getBrowserName,
  initHelper,
} from "./helpers.module.js?v={{{ PRODUCT_VERSION }}}";

const bootstrapCtx = {
  isMobile: false,
  unityCanvas: undefined,
  unityContainer: undefined,
  unityApi: {},
};

let resolveBootstrapReady;
const bootstrapReady = new Promise((resolve) => {
  resolveBootstrapReady = resolve;
});
let bootstrapSettled = false;

function safeResolveBootstrapReady(payload) {
  if (!bootstrapSettled && typeof resolveBootstrapReady === "function") {
    bootstrapSettled = true;
    resolveBootstrapReady(payload);
    Log.always("[BOOTSTRAP] bootstrapReady resolved");
  }
}

function showInitErrorAlert(message) {
  alert(message);
}

function initLogger() {
  Log.setLogLevel(LOG_LEVEL);
  Log.setShowStackTrace(DEBUG);
}

function printAppInfoBanner() {
  Log.always(
    "%c[APP INFO]%c IS_PRODUCTION:%c " + IS_PRODUCTION +
      " %c| DEBUG:%c " + DEBUG +
      " %c| LOG_LEVEL:%c " + LOG_LEVEL,
    "background:#4CAF50;color:white;padding:2px 6px;border-radius:3px;",
    "color:#2196F3;font-weight:bold;",
    "color:#FFD700;",
    "color:#2196F3;font-weight:bold;",
    "color:#FFD700;",
    "color:#2196F3;font-weight:bold;",
    "color:#FFD700;"
  );
}

function initDomRefs() {
  bootstrapCtx.unityCanvas = document.querySelector("#unity-canvas");
  bootstrapCtx.unityContainer = document.querySelector("#unity-container");
}

function initIsMobileFlag() {
  bootstrapCtx.isMobile = checkIfMobile();
  if (bootstrapCtx.isMobile && bootstrapCtx.unityContainer) {
    bootstrapCtx.unityContainer.classList.add("unity-mobile");
  }
}

function extendGameTemplate(extra) {
  window.GameTemplate = window.GameTemplate || {};
  Object.assign(window.GameTemplate, extra);
  if (typeof Module !== "undefined") {
    Module.GameTemplate = Module.GameTemplate || {};
    Object.assign(Module.GameTemplate, extra);
  }
}

function taskInitLogger() {
  initLogger();
  printAppInfoBanner();
  setBootstrapProgress(0.1);
}

function taskDomRefs() {
  initDomRefs();
  setBootstrapProgress(0.2);
}

function taskIsMobileStage() {
  initIsMobileFlag();
  setBootstrapProgress(0.3);
}

function taskExposeBasics() {
  extendGameTemplate({
    unityCanvas: bootstrapCtx.unityCanvas,
    unityContainer: bootstrapCtx.unityContainer,
    isMobile: bootstrapCtx.isMobile,
    getSystemInfo,
    getDeviceName,
    getBrowserName,
  });
  setBootstrapProgress(0.4);
}

async function taskFocusTracker() {
  try {
    const unityMod = await import("./unity.module.js?v={{{ PRODUCT_VERSION }}}");
    bootstrapCtx.unityApi = {
      showBuild: unityMod.showBuild,
      onMainScriptLoaded: unityMod.onMainScriptLoaded,
      getConfig: unityMod.getConfig,
      initDiagnostics: unityMod.initDiagnostics,
    };
    setBootstrapProgress(0.6);
  } catch (e) {
    Log.error("[BOOTSTRAP] Failed to load unity module:", e);
    throw e;
  }
}

/**
 * Initializes diagnostics UI if enabled.
 */
async function taskDiagnostics() {
  if (!SHOW_DIAGNOSTICS) {
    setBootstrapProgress(0.85);
    return;
  }
  
  try {
    const res = await bootstrapCtx.unityApi.initDiagnostics(bootstrapCtx.isMobile);
    if (!res || res.ok !== true) {
      throw (res && res.error) || new Error("initDiagnostics: returned not ok");
    }
    setBootstrapProgress(0.85);
  } catch (e) {
    Log.warn("[BOOTSTRAP] Diagnostics initialization failed, continuing anyway:", e);
    setBootstrapProgress(0.85);
    // Not critical, don't throw
  }
}

function taskHelper() {
  try {
    initHelper(bootstrapCtx.unityCanvas);
    setBootstrapProgress(0.8);
  } catch (e) {
    Log.error("[BOOTSTRAP] Helper init failed:", e);
    throw e;
  }
}

function taskExposeRuntime() {
  extendGameTemplate({
    IS_PRODUCTION,
    DEBUG,
    isMobile: bootstrapCtx.isMobile,
    showBuild: bootstrapCtx.unityApi.showBuild,
    Log,
    SHOW_DIAGNOSTICS,
  });
  setBootstrapProgress(1.0);
}

/**
 * Creates and runs bootstrap stages sequentially.
 */
async function runBootstrapStages() {
  try {
    taskInitLogger();
    taskDomRefs();
    taskIsMobileStage();
    taskExposeBasics();
    await taskFocusTracker();
    taskHelper();
    await taskDiagnostics();
    taskExposeRuntime();
    
    Log.always("[BOOTSTRAP] All stages completed successfully");
    return { ok: true };
  } catch (e) {
    Log.error("[BOOTSTRAP] Bootstrap failed:", e);
    const msg = "Initialization error: " + (e?.message || String(e || "Unknown error")) + "\nPlease reload the page.";
    showInitErrorAlert(msg);
    return { ok: false, error: e };
  }
}

// Run bootstrap immediately
(function bootstrapAsync() {
  (async () => {
    try {
      const result = await runBootstrapStages();
      safeResolveBootstrapReady(result);
    } catch (e) {
      Log.error("[BOOTSTRAP] Bootstrap exception:", e);
      safeResolveBootstrapReady({ ok: false, error: e });
    }
  })();
})();

/**
 * Entry point: starts Unity loader.
 * @param {Object} options - Unity loader options
 * @returns {Promise<void>}
 */
export async function startUnity(options) {
  Log.always("[BOOTSTRAP] startUnity: waiting for bootstrapReady...");
  await bootstrapReady;
  Log.always("[BOOTSTRAP] startUnity: bootstrapReady resolved, proceeding to load Unity");

  const ready = await bootstrapReady;
  if (!ready?.ok) {
    const err = new Error("Unity start blocked: bootstrap failed");
    return Promise.reject(err);
  }

  return new Promise(async (resolve, reject) => {
    const s = document.createElement("script");
    s.src = options.loaderUrl;

    s.onload = async () => {
      Log.always("[BOOTSTRAP] Unity loader script loaded");
      
      try {
        const config = bootstrapCtx.unityApi.getConfig(options);
        await bootstrapCtx.unityApi.onMainScriptLoaded(config);
        resolve();
      } catch (e) {
        Log.error("[BOOTSTRAP] Failed to create Unity instance:", e);
        const msg = "Initialization error: failed to create Unity instance.\n" + (e?.message || String(e || "Unknown error")) + "\nPlease reload the page.";
        showInitErrorAlert(msg);
        reject(e);
      }
    };

    s.onerror = () => {
      const err = new Error("Unity loader script failed: " + s.src);
      Log.error("[BOOTSTRAP]", err);
      const msg = "Initialization error: failed to load Unity loader.\n" + (err?.message || String(err || "Unknown error")) + "\nPlease reload the page.";
      showInitErrorAlert(msg);
      reject(err);
    };

    document.body.appendChild(s);
  });
}
