// src/analytics_events.module.js
// ---------------------------------------------------------------------------
// Central registry of Amplitude / GA event names
// ---------------------------------------------------------------------------

const PREFIX = "Games_";
const HTML_PREFIX = `${PREFIX}HTML-`;

/* ---------------------------------------------------------------------------
 * ❶  Bootstrap & Unity‑loader detailed stages  (NEW)
 *    – use these with EventTracker.trackStage(Events.<key>, …)
 * ------------------------------------------------------------------------ */
const BootstrapStages = {
  BOOTSTRAP_APP: `${PREFIX}Application_Bootstrap`, // already present
  BOOTSTRAP_DOM: `${PREFIX}Bootstrap_DOM`,
  BOOTSTRAP_FIREBASE_LOGS: `${PREFIX}Bootstrap_FirebaseLogs`,
  BOOTSTRAP_AMPLITUDE_MAIN: `${PREFIX}Bootstrap_Amplitude_Main`,
  BOOTSTRAP_GA4_GTAG: `${PREFIX}Bootstrap_GA4_gTag`,
  BOOTSTRAP_FOCUS_TRACKER: `${PREFIX}Bootstrap_FocusTracker`,
  BOOTSTRAP_SEO_INDEXER: `${PREFIX}Bootstrap_SEO_Indexer`,
  BOOTSTRAP_FETCH_PROGRESS: `${PREFIX}Bootstrap_FetchProgress`,
  BOOTSTRAP_AUDIO: `${PREFIX}Bootstrap_Audio`,
  BOOTSTRAP_VIDEO_CONTROLLER: `${PREFIX}Bootstrap_VideoController`,
  BOOTSTRAP_DIAGNOSTICS: `${PREFIX}Bootstrap_Diagnostics`,
  BOOTSTRAP_XSOLLA_PAYSTATION: `${PREFIX}Bootstrap_Xsolla_Paystation`,
  BOOTSTRAP_XSOLLA_METAFRAME: `${PREFIX}Bootstrap_Xsolla_Metaframe`,
  BOOTSTRAP_UNITY_LOADER: `${PREFIX}Bootstrap_UnityLoader`,
  BOOTSTRAP_ANALYTICS_INIT: `${PREFIX}Bootstrap_Analytics_Init`,
  BOOTSTRAP_HELPER: `${PREFIX}Bootstrap_Helper`,
  BOOTSTRAP_UNITY_MAIN_SCRIPT: `${PREFIX}Bootstrap_Unity_Main_Script`,
  BOOTSTRAP_WEB3_METAMASK: `${PREFIX}Bootstrap_Web3_MetaMask`,
  BOOTSTRAP_WEB3_METAMASK_LOGIN_BUTTON: `${PREFIX}Bootstrap_Web3_MetaMask_LoginButton`,
  BOOTSTRAP_WEB3_METAMASK_TOOLTIP: `${PREFIX}Bootstrap_Web3_MetaMask_Tooltip`,
};

/* ---------------------------------------------------------------------------
 * ❷  Main event catalogue
 * ------------------------------------------------------------------------ */
const Events = {
  /* merge the new stage constants in */
  ...BootstrapStages,

  /* ==============================================================
   * Browser / HTML events
   * ============================================================== */
  HTML_Window_Error: `${PREFIX}HTML_Window_Error`,
  HTML_Critical_Error: `${PREFIX}HTML_Critical_Error`,
  HTML_FocusLost_Started: `${HTML_PREFIX}FocusLost_Started`,
  HTML_FocusLost_Ended: `${HTML_PREFIX}FocusLost_Ended`,
  HTML_WebGL_Context_Lost: `${HTML_PREFIX}WebGL_Context_Lost`,
  HTML_WebGL_Context_Recovered: `${HTML_PREFIX}WebGL_Context_Recovered`,

  /* ==============================================================
   * Application lifecycle
   * ============================================================== */
  BOOTSTRAP_SPLASH: `${PREFIX}BOOTSTRAP_SPLASH`,
  Hello_World: `${PREFIX}Hello_World`,
  Build_Hello_World: `${PREFIX}Client_Initialization`,
  Unity_WebGL_Hello_world: `${PREFIX}Unity_WebGL-Hello_world`,
  Hide_Loader: `${PREFIX}Hide_Loader`,
  Page_Unload: `${PREFIX}Page_Unload`,
  Client_Build_Load_Started: `${PREFIX}Client_Build_Load_Started`,
  // Bootstrap_Cleanup: `${PREFIX}Bootstrap_Cleanup`,

  /* ==============================================================
   * Download / resource loading
   * ============================================================== */
  Client_Download: `${PREFIX}Client_Download`,
  Client_Download_Progress: `${PREFIX}Client_Download_Progress`,
  Client_Download_Error: `${PREFIX}Client_Download_Error`,
  Client_Download_Full: `${PREFIX}Client_Download_Full`,
  Client_Download_Full_All: `${PREFIX}Client_Download_Full_All`,

  /* ==============================================================
   * Unity‑specific
   * ============================================================== */
  Unity_Config_Creation: `${PREFIX}Unity_Config_Creation`,
  ASTC_Detection: `${PREFIX}ASTC_Detection`,
  Show_Build: `${PREFIX}Show_Build`,
  Unity_Initialization: `${PREFIX}Unity_Initialization`,
  Unity_Banner_Show: `${PREFIX}Unity_Banner_Show`,
  Mobile_Content_Load: `${PREFIX}Mobile_Content_Load`,
  Unity_Cleanup: `${PREFIX}Unity_Cleanup`,
  // Unity_Load: `${PREFIX}Unity_Load`,
  // Unity_Script_Load: `${PREFIX}Unity_Script_Load`,
  Game_Create_Unity_Instance: `${PREFIX}Create_Unity_Instance`,

  /* ==============================================================
   * WebGL / graphics
   * ============================================================== */
  WebGL_Check: `${PREFIX}WebGL_Check`,

  /* ==============================================================
   * Web3 / MetaMask
   * ============================================================== */
  Web3_MetaMask_Init_Started: `${PREFIX}Web3_MetaMask_Init_Started`,
  Web3_MetaMask_Init_Success: `${PREFIX}Web3_MetaMask_Init_Success`,
  Web3_MetaMask_Init_Error: `${PREFIX}Web3_MetaMask_Init_Error`,
  Web3_MetaMask_Connect_Click: `${PREFIX}Web3_MetaMask_Connect_Click`,
  Web3_MetaMask_Disconnect_Click: `${PREFIX}Web3_MetaMask_Disconnect_Click`,
  Web3_MetaMask_Connected: `${PREFIX}Web3_MetaMask_Connected`,
  Web3_MetaMask_Disconnected: `${PREFIX}Web3_MetaMask_Disconnected`,
  Web3_MetaMask_Connect_Error: `${PREFIX}Web3_MetaMask_Connect_Error`,
  Web3_MetaMask_Disconnect_Error: `${PREFIX}Web3_MetaMask_Disconnect_Error`,

  // /* ==============================================================
  //  * Audio / video
  //  * ============================================================== */
  // Audio_Init: `${PREFIX}Audio_Init`,
  // Audio_Play: `${PREFIX}Audio_Play`,
  // Audio_Load: `${PREFIX}Audio_Load`,

  Games_Video_Load_API: `${HTML_PREFIX}Video_Player_Load_API`,
  Games_Video_Init: `${HTML_PREFIX}Video_Player_Init`,
  Games_Video_Player_Ready: `${HTML_PREFIX}Video_Player_Ready`,
  Games_Video_Player_State_Changed: `${HTML_PREFIX}Video_State_Changed`,
  Games_Video_Playback_Allow_Status_Changed: `${HTML_PREFIX}Video_Playback_Allow_Status_Changed`,
  Games_Video_Try_Change: `${HTML_PREFIX}Video_Try_Change`,
  Games_Video_Try_Load: `${HTML_PREFIX}Video_Try_Load`,
  Games_Video_Try_Play: `${HTML_PREFIX}Video_Try_Play`,
  Games_Video_Try_Stop: `${HTML_PREFIX}Video_Try_Stop`,
  Games_Video_Try_Pause: `${HTML_PREFIX}Video_Try_Pause`,
  // Games_Video_Init_UI: `${HTML_PREFIX}Video_Init_UI`,
  // Games_Video_Controller_Init: `${HTML_PREFIX}Video_Controller_Init`,
  // Games_Video_Cleanup: `${HTML_PREFIX}Video_Controller_Cleanup`,
  Games_Video_Error: `${HTML_PREFIX}Video_Error`,

  /* ==============================================================
   * Xsolla / payment
   * ============================================================== */
  // … add Xsolla‑specific constants here if needed …

  /* ==============================================================
   * Performance & system
   * ============================================================== */
  Performance_Metrics_Collect: `${PREFIX}Performance_Metrics_Collect`,
  // Network_Analysis: `${PREFIX}Network_Analysis`,
  // System_Memory_Warning: `${PREFIX}System_Memory_Warning`,
  // System_Memory_Critical: `${PREFIX}System_Memory_Critical`,
  // System_Network_Status_Changed: `${PREFIX}System_Network_Status_Changed`,
  // System_Visibility_Changed: `${PREFIX}System_Visibility_Changed`,

  /* ==============================================================
   * Utility helpers
   * ============================================================== */
  GetAnalyticsEventStartKey: (base) => `${base}_Started`,
  GetAnalyticsEventProgressKey: (base) => `${base}_Progress`,
  GetAnalyticsEventSuccessKey: (base) => `${base}_Success`,
  GetAnalyticsEventErrorKey: (base) => `${base}_Error`,
  GetAnalyticsEventFinishKey: (base) => `${base}_Finished`,

  CreateLifecycleEvents: (base) => ({
    Started: `${PREFIX}${base}_Started`,
    Progress: `${PREFIX}${base}_Progress`,
    Success: `${PREFIX}${base}_Success`,
    Error: `${PREFIX}${base}_Error`,
    Finished: `${PREFIX}${base}_Finished`,
  }),

  IsCriticalEvent: (name) =>
    [
      /_Error$/,
      /_Critical$/,
      /HTML_Window_Error/,
      /HTML_Critical_Error/,
      /WebGL.*Error/,
      /Unity.*Error/,
      /System.*Critical/,
    ].some((p) => p.test(name)),

  GetEventCategory: (name) => {
    if (name.startsWith(HTML_PREFIX)) return "Browser";
    if (name.includes("Unity_")) return "Unity";
    if (name.includes("Video_")) return "Video";
    if (name.includes("Audio_")) return "Audio";
    if (name.includes("Xsolla_")) return "Payment";
    if (name.includes("Firebase_")) return "Analytics";
    if (name.includes("Performance_")) return "Performance";
    if (name.includes("System_")) return "System";
    if (name.includes("User_")) return "User";
    if (name.includes("Debug_")) return "Debug";
    return "General";
  },

  EnrichEvent: (name, data = {}) => ({
    event_name: name,
    event_category: Events.GetEventCategory(name),
    is_critical: Events.IsCriticalEvent(name),
    timestamp: Date.now(),
    session_time: performance.now(),
    ...data,
  }),
};

/* ---------------------------------------------------------------------------
 * Convenience enums
 * ------------------------------------------------------------------------ */
export const EVENT_CATEGORIES = {
  BROWSER: "Browser",
  UNITY: "Unity",
  VIDEO: "Video",
  AUDIO: "Audio",
  PAYMENT: "Payment",
  ANALYTICS: "Analytics",
  PERFORMANCE: "Performance",
  SYSTEM: "System",
  USER: "User",
  DEBUG: "Debug",
  GENERAL: "General",
};

export const EVENT_TYPES = {
  STARTED: "Started",
  PROGRESS: "Progress",
  SUCCESS: "Success",
  ERROR: "Error",
  FINISHED: "Finished",
};

export { Events };
