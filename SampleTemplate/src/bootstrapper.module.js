/* =========================================================
 * Master bootstrapper
 * =======================================================*/
import { ErrorHandler } from "./errorHandler.module.js?v={{{ PRODUCT_VERSION }}}";
ErrorHandler.initialize();

/* ───── central config ────────────────────────────────── */
import {
  IS_PRODUCTION,
  ASSETS,
  DEBUG,
  GOOGLE,
  FIREBASE_LOGS,
  ANALYTICS,
  XSOLLA_METAFRAME,
  LOG_LEVEL,
  WEB3_METAMASK,
  SHOW_DIAGNOSTICS,
  IS_VIDEO_STREAMING_ENABLED,
} from "./config.module.js?v={{{ PRODUCT_VERSION }}}";
import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";
import { app_version } from "./app_version.js?v={{{ PRODUCT_VERSION }}}";
import { setBootstrapProgress } from "./progress_ui.module.js?v={{{ PRODUCT_VERSION }}}";
import { createStageProgress } from "./stage_progress.module.js?v={{{ PRODUCT_VERSION }}}";

/* ───── helpers used early ────────────────────────────── */
import {
  checkIfMobile,
  checkIndexer,
  parseSegment,
  getSystemInfo,
  getDeviceName,
  getBrowserName,
  initHelper,
} from "./helpers.module.js?v={{{ PRODUCT_VERSION }}}";

/* ───── splash rendering ────────────────────── */
import { initRender } from "./render.module.js?v={{{ PRODUCT_VERSION }}}";

/* ───── EventTracker & analytics events IDs ───────────── */
import { EventTracker } from "./eventTracker.module.js?v={{{ PRODUCT_VERSION }}}";
import { Events } from "./analytics_events.module.js?v={{{ PRODUCT_VERSION }}}";
import * as Amplitude from "./amplitude.module.js?v={{{ PRODUCT_VERSION }}}";

// Fire Hello-World as the very first ordered event. It will reserve slot #1
// and wait internally until Amplitude is initialized and clientId is ready.
Amplitude.sendEvent(
  Events.Hello_World,
  { Game_ID: "none", Session_ActivePlayTime: 0 },
  { Game_ID: "none", Session_ActivePlayTime: 0 }
);

/* ========================================================
 * Methods (single section): initialization + staged tasks
 * ======================================================*/
const bootstrapCtx = {
  isMobile: false,
  unityCanvas: undefined,
  unityContainer: undefined,
  focusTracker: undefined,
  bgAudio: undefined,
  audioApi: {},
  videoApi: {},
  xsollaApi: {},
  analyticsApi: {},
  amplitudeApi: {},
  firebaseApi: {},
  unityApi: {},
  web3Api: {},
};

/* ───── readiness gate for startUnity ─────────────────── */
let resolveBootstrapReady;
const bootstrapReady = new Promise((resolve) => {
  resolveBootstrapReady = resolve;
});
let globalAlertShown = false;
let bootstrapSettled = false;

function safeResolveBootstrapReady(payload) {
  if (!bootstrapSettled && typeof resolveBootstrapReady === "function") {
    bootstrapSettled = true;
    resolveBootstrapReady(payload);
    Log.always("[BOOTSTRAP] bootstrapReady resolved");
  }
}

function showInitErrorAlert(message) {
  if (!globalAlertShown) {
    globalAlertShown = true;
    alert(message);
  }
}

/** Initializes the logging subsystem using centralized configuration. */
function initLogger() {
  Log.setLogLevel(LOG_LEVEL);
  Log.setShowStackTrace(DEBUG);
}

/** Prints one compact line with runtime configuration for quick diagnostics. */
function printAppInfoBanner() {
  Log.always(
    "%c[APP INFO]%c IS_PRODUCTION:%c " + IS_PRODUCTION +
      " %c| DEBUG:%c " + DEBUG +
      " %c| LOG_LEVEL:%c " + LOG_LEVEL +
      " %c| VERSION:%c " + app_version,
    "background:#4CAF50;color:white;padding:2px 6px;border-radius:3px;",
    "color:#2196F3;font-weight:bold;",
    "color:#FFD700;",
    "color:#2196F3;font-weight:bold;",
    "color:#FFD700;",
    "color:#2196F3;font-weight:bold;",
    "color:#FFD700;",
    "color:#2196F3;font-weight:bold;",
    "color:#FFD700;"
  );
}

/**
 * Grabs and stores DOM references used by Unity build.
 */
function initDomRefs() {
  bootstrapCtx.unityCanvas = document.querySelector("#unity-canvas");
  bootstrapCtx.unityContainer = document.querySelector("#unity-container");
}

/**
 * Detects and stores the mobile flag.
 */
function initIsMobileFlag() {
  bootstrapCtx.isMobile = checkIfMobile();
}

/**
 * Ensures a public UnityWebGLApp object exists and extends it with provided props.
 * @param {Record<string, any>} extra
 */
function extendUnityWebGLApp(extra) {
  window.UnityWebGLApp = window.UnityWebGLApp || {};
  Object.assign(window.UnityWebGLApp, extra);
  if (typeof Module !== "undefined") {
    Module.UnityWebGLApp = Module.UnityWebGLApp || {};
    Object.assign(Module.UnityWebGLApp, extra);
  }
}

/**
 * Initializes the splash render.
 */
function taskSplash() {
  // const splashStage = EventTracker.trackStage(Events.BOOTSTRAP_SPLASH, "init_render");
  const res = initRender(bootstrapCtx.isMobile, ASSETS);
  // res.ok ? splashStage.success() : splashStage.error(res.error);
}

/** Stage: initialize logger */
function taskInitLogger() {
  initLogger();
  printAppInfoBanner();
}

/** Stage: query and store DOM references */
function taskDomRefs() {
  initDomRefs();
}

/** Stage: detect and store mobile flag */
function taskIsMobileStage() {
  initIsMobileFlag();
}

/** Stage: expose minimal runtime basics */
function taskExposeBasics() {
  extendUnityWebGLApp({
    app_version,
    unityCanvas: bootstrapCtx.unityCanvas,
    unityContainer: bootstrapCtx.unityContainer,
  });
}

/**
 * Initializes Firebase logs.
 */
async function taskFirebaseLogs() {
  const logsStage = EventTracker.trackStage(Events.BOOTSTRAP_FIREBASE_LOGS);
  try {
    const mod = await import("./firebaseLogs.module.js?v={{{ PRODUCT_VERSION }}} ");
    const res = await mod.firebaseLogsInit(FIREBASE_LOGS.config, FIREBASE_LOGS.pathPrefix);
    if (!res || res.ok !== true) {
      throw (res && res.error) || new Error("firebaseLogsInit: returned not ok");
    }
    bootstrapCtx.firebaseApi = { setNickname: mod.setNickname, setUserId: mod.setUserId };
    logsStage.success();
  } catch (e) {
    logsStage.error(e);
    throw e;
  }
}

/**
 * Initializes Amplitude analytics SDK.
 */
async function taskAmplitudeInit() {
  const amplitudeStage = EventTracker.trackStage(Events.BOOTSTRAP_AMPLITUDE_MAIN);
  try {
    const mod = await import("./amplitude.module.js?v={{{ PRODUCT_VERSION }}} ");
    await mod.initAmplitude(ANALYTICS.BUILD_NAME);
    bootstrapCtx.amplitudeApi = {
      sendEvent: mod.sendEvent,
      sendRawEvent: mod.sendRawEvent,
      getLastAmplitudeRequestNumber: mod.getLastAmplitudeRequestNumber,
      setLastAmplitudeRequestNumber: mod.setLastAmplitudeRequestNumber,
      incrementLastAmplitudeRequestNumber: mod.incrementLastAmplitudeRequestNumber,
      getCurrentAmplitudeRequestNumber: mod.getCurrentAmplitudeRequestNumber,
      setCurrentAmplitudeRequestNumber: mod.setCurrentAmplitudeRequestNumber,
      incrementCurrentAmplitudeRequestNumber: mod.incrementCurrentAmplitudeRequestNumber,
    };
    amplitudeStage.success();
  } catch (e) {
    amplitudeStage.error(e);
    throw e;
  }
}

/**
 * Initializes Google Analytics and sets the user id.
 */
async function taskAnalyticsInit() {
  const analyticsStage = EventTracker.trackStage(Events.BOOTSTRAP_ANALYTICS_INIT);
  try {
    const mod = await import("./analytics.module.js?v={{{ PRODUCT_VERSION }}} ");
    await mod.initAnalytics(GOOGLE.GTAG_ID);
    const cid = mod.getSavedClientId();
    bootstrapCtx.firebaseApi.setUserId?.(cid);
    bootstrapCtx.analyticsApi = {
      getSavedClientId: mod.getSavedClientId,
      getCurrentSessionId: mod.getCurrentSessionId,
    };
    analyticsStage.success({ cid });
  } catch (e) {
    analyticsStage.error(e);
    throw e;
  }
}

/**
 * Initializes the focus tracker service.
 */
async function taskFocusTracker() {
  const focusStage = EventTracker.trackStage(Events.BOOTSTRAP_FOCUS_TRACKER);
  try {
    const [{ FocusTracker }, unityMod] = await Promise.all([
      import("./focusTracker.module.js?v={{{ PRODUCT_VERSION }}} "),
      import("./unity.module.js?v={{{ PRODUCT_VERSION }}} "),
    ]);
    bootstrapCtx.focusTracker = new FocusTracker(unityMod.onFocusChanged);
    bootstrapCtx.unityApi = {
      showBuild: unityMod.showBuild,
      helloBuild: unityMod.helloBuild,
      isUserAuthorized: unityMod.isUserAuthorized,
      getConfig: unityMod.getConfig,
      onMainScriptLoaded: unityMod.onMainScriptLoaded,
      onFocusChanged: unityMod.onFocusChanged,
    };
    focusStage.success();
  } catch (e) {
    focusStage.error(e);
    throw e;
  }
}

/**
 * Applies SEO indexer rules.
 */
function taskIndexer() {
  const indexerStage = EventTracker.trackStage(Events.BOOTSTRAP_SEO_INDEXER);
  try {
    checkIndexer(IS_PRODUCTION);
    indexerStage.success();
  } catch (e) {
    indexerStage.error(e);
    throw e;
  }
}

/**
 * Initializes DOM-bound helpers.
 */
function taskHelper() {
  const helperStage = EventTracker.trackStage(Events.BOOTSTRAP_HELPER);
  try {
    initHelper(bootstrapCtx.unityCanvas);
    helperStage.success();
  } catch (e) {
    helperStage.error(e);
    throw e;
  }
}

/**
 * Loads the Web3 MetaMask bridge and initializes it.
 */
async function taskWeb3MetaMask() {
  const web3Stage = EventTracker.trackStage(Events.BOOTSTRAP_WEB3_METAMASK);
  try {
    // Import once; the module sets window.MetaMaskBridge
    await import("./lib/MetaMask/web3-metamask-bridge.js?v={{{ PRODUCT_VERSION }}} ");
    if (!window.MetaMaskBridge) {
      throw new Error("Web3 MetaMask bridge loaded but MetaMaskBridge missing");
    }

    const options = {
      sdkOptions: {
        dappMetadata: { name: WEB3_METAMASK.dappName, url: WEB3_METAMASK.dappUrl },
        infuraAPIKey: WEB3_METAMASK.infuraApiKey,
      },
      debug: DEBUG,
      unity: { gameObjectName: "Web3MetaMaskBridge" },
      events: {
        connected: ({ address }) => {
          try { Amplitude.sendEvent(Events.Web3_MetaMask_Connected, { address }); } catch { }
          try { bootstrapCtx.web3Api?.LoginButton?.setConnected?.(true); } catch { Log.error("setConnected failed"); }
        },
        disconnected: () => {
          try { Amplitude.sendEvent(Events.Web3_MetaMask_Disconnected); } catch { }
          try { bootstrapCtx.web3Api?.LoginButton?.setConnected?.(false); } catch { Log.error("setConnected failed"); }
        },
        connectError: ({ error }) => {
          try { Amplitude.sendEvent(Events.Web3_MetaMask_Connect_Error, { error }); } catch { }
        },
        disconnectError: ({ error }) => {
          try { Amplitude.sendEvent(Events.Web3_MetaMask_Disconnect_Error, { error }); } catch { }
        },
      },
    };

    Log.debug('taskWeb3MetaMask: bootstrapCtx.isMobile', bootstrapCtx.isMobile);
    if (bootstrapCtx.isMobile) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      Log.debug('taskWeb3MetaMask: isIOS', isIOS);
      if (!isIOS) {
        options.sdkOptions.openDeeplink = (link) => {
            Log.debug('taskWeb3MetaMask: openDeeplink called with:', link);
            // Open the deeplink
            try {
              window.open(link, '_blank');
            } catch (e) {
              Log.error('taskWeb3MetaMask: Failed to open deeplink:', e);
            }
          };
      }
    }

    Log.debug('taskWeb3MetaMask: options', options);

    // Initialize SDK
    Amplitude.sendEvent(Events.Web3_MetaMask_Init_Started);
    const initRes = window.MetaMaskBridge.init(options);
    if (!initRes || initRes.success !== true) {
      Amplitude.sendEvent(Events.Web3_MetaMask_Init_Error, { error: initRes && initRes.error ? String(initRes.error) : "unknown" });
      throw new Error("MetaMask init failed: " + (initRes && initRes.error ? String(initRes.error) : "unknown"));
    }
    Amplitude.sendEvent(Events.Web3_MetaMask_Init_Success);

    // Expose bridge-only controls
    bootstrapCtx.web3Api = {
      ...bootstrapCtx.web3Api,
      connect: () => window.MetaMaskBridge?.connect?.(),
      disconnect: () => window.MetaMaskBridge?.disconnect?.(),
      isConnected: () => window.MetaMaskBridge?.isConnected?.(),
    };

    // Wait for 150ms to ensure the bridge is initialized
    await new Promise(resolve => setTimeout(resolve, 150));

    web3Stage.success();
  } catch (e) {
    web3Stage.error(e);
    // not throwing error here because it's not critical for the game to work
  }
}

/**
 * Loads and wires the Web3 Login Button separately.
 */
async function taskWeb3LoginButton() {
  const web3BtnStage = EventTracker.trackStage(Events.BOOTSTRAP_WEB3_METAMASK_LOGIN_BUTTON);
  try {
    const { LoginButton } = await import("./lib/MetaMask/loginButton.js?v={{{ PRODUCT_VERSION }}} ");
    const btn = LoginButton.init({
      onClick: ({ connected }) => {
        try {
          if (connected) {
            Amplitude.sendEvent(Events.Web3_MetaMask_Disconnect_Click);
            window.MetaMaskBridge.disconnect();
            // Close tooltip if it's open
            if (window.MetaMaskTooltip) {
              window.MetaMaskTooltip.close();
            }
          } else {
            Amplitude.sendEvent(Events.Web3_MetaMask_Connect_Click);
            window.MetaMaskBridge.connect();
            // Close tooltip if it's open
            if (window.MetaMaskTooltip) {
              window.MetaMaskTooltip.close();
              window.MetaMaskTooltip.saveHasShown(true);
            }
          }
        } catch { }
      },
      onLogoClick: (opened) => {
        try {
          // On mobile, show MetaMask tooltip when logo is clicked
          if (bootstrapCtx.isMobile && window.MetaMaskTooltip && !window.MetaMaskBridge?.isConnected?.()) {
            if (opened) {
              window.MetaMaskTooltip.showIfNeeded();
            } else {
              window.MetaMaskTooltip.close();
            }
          }
        } catch { }
      },
      onInstallClick: () => installMetaMask(),
      onClosed: () => {
        try {
          if (window.MetaMaskTooltip) {
            window.MetaMaskTooltip.close();
          }
        } catch { }
      },
      topPx: 88,
      connected: window.MetaMaskBridge?.isConnected?.()
    });
    btn.hide();
    btn.setInstallButtonEnabled(bootstrapCtx.isMobile);

    bootstrapCtx.web3Api = {
      ...bootstrapCtx.web3Api,
      LoginButton: btn,
      showWeb3Login: () => { try { btn.show(); } catch { Log.error("showWeb3Login failed"); } },
      hideWeb3Login: () => { try { btn.hide(); } catch { Log.error("hideWeb3Login failed"); } },
    };
    web3BtnStage.success();
  } catch (e) {
    web3BtnStage.error(e);
    // not critical for the game
  }
}

/**
 * Initializes audio and stores a reference to background audio.
 */
async function taskAudio() {
  const audioStage = EventTracker.trackStage(Events.BOOTSTRAP_AUDIO);
  try {
    const { AudioPlayer } = await import("./audio_controller.module.js?v={{{ PRODUCT_VERSION }}} ");
    bootstrapCtx.bgAudio = AudioPlayer.initializeAudio(true);
    bootstrapCtx.audioApi = { AudioPlayer };
    audioStage.success();
  } catch (e) {
    audioStage.error(e);
    throw e;
  }
}

/**
 * Initializes the video controller.
 */
async function taskVideo() {
  const videoStage = EventTracker.trackStage(Events.BOOTSTRAP_VIDEO_CONTROLLER);
  try {
    const { VideoController } = await import("../VideoController/src/videoController.module.js?v={{{ PRODUCT_VERSION }}} ");
    VideoController.init();
    bootstrapCtx.videoApi = { VideoController };
    videoStage.success();
  } catch (e) {
    videoStage.error(e);
    throw e;
  }
}

/**
 * Initializes Xsolla PayStation and Metaframe in parallel.
 */
async function taskXsollaParallel() {
  const payStage = EventTracker.trackStage(Events.BOOTSTRAP_XSOLLA_PAYSTATION);
  const metaStage = EventTracker.trackStage(Events.BOOTSTRAP_XSOLLA_METAFRAME);
  try {
    const [payMod, metaMod] = await Promise.all([
      import("./xsolla_paystation.module.js?v={{{ PRODUCT_VERSION }}}"),
      import("./xsolla_metaframe.module.js?v={{{ PRODUCT_VERSION }}}"),
    ]);

    const xsollaPayP = payMod
      .initXsollaPaystation({}, 3, 2000, 10_000)
      .then(() => payStage.success())
      .catch((e) => payStage.error(e));

    const xsollaMetaP = metaMod
      .initMetaframe({ ...XSOLLA_METAFRAME, isMobile: bootstrapCtx.isMobile }, 3, 2000, 10_000)
      .then(() => metaStage.success())
      .catch((e) => metaStage.error(e));

    bootstrapCtx.xsollaApi = {
      openXsollaPayStation: payMod.openXsollaPayStation,
      checkMetaframeReady: metaMod.checkMetaframeReady,
      openMetaframeLogin: metaMod.openMetaframeLogin,
      openMetaframeBackpack: metaMod.openMetaframeBackpack,
      pushMetaframeNotification: metaMod.pushMetaframeNotification,
      isAuthorized: metaMod.isAuthorized,
      showMetaframeUI: metaMod.showMetaframeUI,
      getAuthToken: metaMod.getAuthToken,
      getMetaframeOpenButton: metaMod.getMetaframeOpenButton,
    };

    const settled = await Promise.allSettled([xsollaPayP, xsollaMetaP]);
    const anyRejected = settled.some((r) => r.status === 'rejected');
    if (anyRejected) {
      throw new Error('Xsolla init failed');
    }
  } catch (e) {
    payStage.error(e);
    metaStage.error(e);
    throw e;
  }
}

/**
 * Open MetaMask download page on mobile devices.
 */
function installMetaMask() {
  try {
    // Generate deep link for mobile MetaMask app
    const deepLink = window.MetaMaskBridge.generateMetaMaskDeepLink();
    if (deepLink) {
      window.open(deepLink, '_blank');
    } else {
      // Fallback to regular download page
      window.open('https://metamask.io/download/', '_blank');
    }
  } catch (error) {
    console.error('Failed to generate MetaMask deep link:', error);
    // Fallback to regular download page
    window.open('https://metamask.io/download/', '_blank');
  }
}

/**
 * Initializes diagnostics UI if enabled.
 */
async function taskDiagnostics() {
  const diagnosticsStage = EventTracker.trackStage(Events.BOOTSTRAP_DIAGNOSTICS);
  try {
    const unityMod = await import("./unity.module.js?v={{{ PRODUCT_VERSION }}} ");
    const res = await unityMod.initDiagnostics(bootstrapCtx.isMobile);
    if (!res || res.ok !== true) {
      throw (res && res.error) || new Error("initDiagnostics: returned not ok");
    }
    diagnosticsStage.success();
  } catch (e) {
    diagnosticsStage.error(e);
    // Not critical, don't throw
    Log.warn("[BOOTSTRAP] Diagnostics initialization failed, continuing anyway:", e);
  }
}

/**
 * Exposes runtime helpers and services on the public UnityWebGLApp namespace.
 */
function taskExposeRuntime() {
  extendUnityWebGLApp({
    IS_PRODUCTION,
    DEBUG,

    /* env */
    isMobile: bootstrapCtx.isMobile,
    focusTracker: bootstrapCtx.focusTracker,
    parseSegment,
    getSystemInfo,
    getDeviceName,
    getBrowserName,
    checkIfMobile,

    /* media */
    bgAudio: bootstrapCtx.bgAudio,
    AudioPlayer: bootstrapCtx.audioApi.AudioPlayer,
    videoController: bootstrapCtx.videoApi.VideoController,

    /* unity helpers */
    showBuild: bootstrapCtx.unityApi.showBuild,
    helloBuild: bootstrapCtx.unityApi.helloBuild,
    isUserAuthorized: bootstrapCtx.unityApi.isUserAuthorized,

    /* xsolla */
    checkMetaframeReady: bootstrapCtx.xsollaApi.checkMetaframeReady,
    openMetaframeLogin: bootstrapCtx.xsollaApi.openMetaframeLogin,
    openMetaframeBackpack: bootstrapCtx.xsollaApi.openMetaframeBackpack,
    pushMetaframeNotification: bootstrapCtx.xsollaApi.pushMetaframeNotification,
    isAuthorized: bootstrapCtx.xsollaApi.isAuthorized,
    showMetaframeUI: bootstrapCtx.xsollaApi.showMetaframeUI,
    getAuthToken: bootstrapCtx.xsollaApi.getAuthToken,
    getMetaframeOpenButton: bootstrapCtx.xsollaApi.getMetaframeOpenButton,
    openXsollaPayStation: bootstrapCtx.xsollaApi.openXsollaPayStation,

    /* analytics */
    getSavedClientId: bootstrapCtx.analyticsApi.getSavedClientId,
    getCurrentSessionId: bootstrapCtx.analyticsApi.getCurrentSessionId,

    /* amplitude */
    sendEvent: bootstrapCtx.amplitudeApi.sendEvent,
    sendRawEvent: bootstrapCtx.amplitudeApi.sendRawEvent,
    getLastAmplitudeRequestNumber: bootstrapCtx.amplitudeApi.getLastAmplitudeRequestNumber,
    setLastAmplitudeRequestNumber: bootstrapCtx.amplitudeApi.setLastAmplitudeRequestNumber,
    incrementLastAmplitudeRequestNumber: bootstrapCtx.amplitudeApi.incrementLastAmplitudeRequestNumber,
    getCurrentAmplitudeRequestNumber: bootstrapCtx.amplitudeApi.getCurrentAmplitudeRequestNumber,
    setCurrentAmplitudeRequestNumber: bootstrapCtx.amplitudeApi.setCurrentAmplitudeRequestNumber,
    incrementCurrentAmplitudeRequestNumber: bootstrapCtx.amplitudeApi.incrementCurrentAmplitudeRequestNumber,

    /* firebase nick */
    setNickname: bootstrapCtx.firebaseApi.setNickname,

    /* web3 */
    showWeb3Login: () => bootstrapCtx.web3Api.showWeb3Login?.(),
    hideWeb3Login: () => bootstrapCtx.web3Api.hideWeb3Login?.(),
    web3Connect: () => bootstrapCtx.web3Api.connect?.(),
    web3Disconnect: () => bootstrapCtx.web3Api.disconnect?.(),
    web3IsConnected: () => bootstrapCtx.web3Api.isConnected?.(),
    isMetaMaskEnabled: () => WEB3_METAMASK.enabled,
    isVideoStreamingEnabled: () => IS_VIDEO_STREAMING_ENABLED,
  });
}

/**
 * Creates and registers the bootstrap stages, then freezes the plan.
 */
function createBootstrapStages() {
  const StageProgress = createStageProgress(setBootstrapProgress, {
    onStageError: (stage, err) => {
      const msg =
        "Initialization error at stage '" +
        stage +
        "'\n" + (err?.message || String(err || "Unknown error")) +
        "\nPlease reload the page.";
      showInitErrorAlert(msg);
    },
  });
  // Early bootstrap tasks
  StageProgress.registerTask("init_logger", taskInitLogger);
  StageProgress.registerTask("dom_refs", taskDomRefs);
  StageProgress.registerTask("is_mobile_flag", taskIsMobileStage);
  StageProgress.registerTask("expose_basics", taskExposeBasics);
  StageProgress.registerTask("splash", taskSplash);
  StageProgress.registerTask("firebase_logs", taskFirebaseLogs);
  StageProgress.registerTask("amplitude_init", taskAmplitudeInit);
  StageProgress.registerTask("analytics_init", taskAnalyticsInit);
  StageProgress.registerTask("focus_tracker", taskFocusTracker);
  StageProgress.registerTask("seo_indexer", taskIndexer);
  StageProgress.registerTask("helper_init", taskHelper);
  if (WEB3_METAMASK.enabled) StageProgress.registerTask("web3_metamask", taskWeb3MetaMask);
  if (WEB3_METAMASK.enabled) StageProgress.registerTask("web3_login_button", taskWeb3LoginButton);
  StageProgress.registerTask("audio_init", taskAudio);
  if (IS_VIDEO_STREAMING_ENABLED) StageProgress.registerTask("video_init", taskVideo);
  if (SHOW_DIAGNOSTICS) StageProgress.registerTask("diagnostics_init", taskDiagnostics);
  StageProgress.registerTask("xsolla_parallel", taskXsollaParallel);
  StageProgress.registerTask("expose_runtime", taskExposeRuntime);

  StageProgress.freeze();
  return StageProgress;
}

/* ========================================================
 * Async bootstrap wrapper to avoid top‑level await (Safari compatibility)
 * ======================================================*/
(function bootstrapAsync() {
  (async () => {
    try {
      const StageProgress = createBootstrapStages();
      const result = await StageProgress.runSequentially();
      if (!result?.ok) {
        Log.error("[BOOTSTRAP] Aborting after stage failure:", result);
        safeResolveBootstrapReady({ ok: false, stage: result.stage, error: result.error });
        return; // do not proceed to Unity start
      }
    } catch (e) {
      console.error(e);
    } finally {
      safeResolveBootstrapReady({ ok: true });
    }
  })();
})();

/* ========================================================
 * 1️⃣3️⃣  Exported entry‑point: startUnity(options)
 * ======================================================*/
/**
 * Dynamically injects Unity loader JS and boots the build.
 *
 * @param {object}  options
 * @param {string}  options.loaderUrl
 * @returns {Promise<void>}
 */
export async function startUnity(options) {
  Log.always("[BOOTSTRAP] startUnity: waiting for bootstrapReady...");
  await bootstrapReady;
  Log.always("[BOOTSTRAP] startUnity: bootstrapReady resolved, proceeding to load Unity");
  const unityStage = EventTracker.trackStage(
    Events.BOOTSTRAP_UNITY_MAIN_SCRIPT,
    "unity_build_init"
  );

  return new Promise(async (resolve, reject) => {
    Log.always("[BOOTSTRAP] startUnity: waiting for bootstrapReady...");
    const ready = await bootstrapReady;
    Log.always("[BOOTSTRAP] startUnity: bootstrapReady resolved, proceeding to load Unity", ready);
    if (!ready?.ok) {
      const err = new Error(
        "Unity start blocked: bootstrap failed at stage '" + (ready.stage || "unknown") + "'"
      );
      return reject(err);
    }

    if (globalAlertShown) {
      // A previous stage already failed; block Unity load
      const err = new Error("Unity start blocked: bootstrap failed earlier");
      return reject(err);
    }
    const s = document.createElement("script");
    s.src = options.loaderUrl;

    s.onload = () => {
      unityStage.success();
      const loaderStage = EventTracker.trackStage(Events.BOOTSTRAP_UNITY_LOADER);

      const p = bootstrapCtx.unityApi.onMainScriptLoaded
        ? bootstrapCtx.unityApi.onMainScriptLoaded(bootstrapCtx.unityApi.getConfig(options))
        : null;

      if (p && typeof p.then === "function") {
        p.then(() => {
          if (window.MetaMaskBridge && window.MetaMaskBridge.setUnityInstance) window.MetaMaskBridge.setUnityInstance(window.UnityWebGLApp.myGameInstance);
          loaderStage.success({ url: s.src });
          resolve();
        })
          .catch((e) => {
            loaderStage.error(e);
            const msg =
              "Initialization error: failed to create Unity instance.\n" +
              (e?.message || String(e || "Unknown error")) +
              "\nPlease reload the page.";
            showInitErrorAlert(msg);
            reject(e);
          });
      } else {
        // fallback
        loaderStage.success({ url: s.src });
        resolve();
      }
    };

    s.onerror = () => {
      const err = new Error("Unity loader script failed: " + s.src);
      sendEvent(Events.HTML_Critical_Error, { url: s.src });
      unityStage.error(err);
      const msg =
        "Initialization error: failed to load Unity loader.\n" +
        (err?.message || String(err || "Unknown error")) +
        "\nPlease reload the page.";
      showInitErrorAlert(msg);
      reject(err);
    };

    document.body.appendChild(s);
  });
}

