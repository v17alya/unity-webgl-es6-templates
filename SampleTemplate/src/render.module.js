/* render.module.js
 * Short: prepares splash screen, logo, viewport meta and loading bar
 * for the Unity WebGL build.  Image URLs come from central config.
 */

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

let _initialized = false; // prevents double‑initialisation

/**
 * Initialize splash / loading UI.
 *
 * @param {boolean} isMobile              — `true` for mobile layout.
 * @param {{                                  // asset URLs are supplied here
 *   SPLASH_MOBILE:  string,
 *   SPLASH_DESKTOP: string,
 *   LOGO:           string
 * }} assets
 * @param {{ retry?: number }} [opts]     — optional settings.
 *
 * @returns {{ ok: true } | { ok: false, error: unknown }}
 */
export function initRender(isMobile, assets, opts = {}) {
  if (_initialized) return { ok: true };

  const { retry = 0 } = opts;

  try {
    /* ---------- DOM references ---------- */
    const { unityCanvas, unityContainer } = window.UnityWebGLApp ?? {};
    if (!unityCanvas || !unityContainer)
      throw new Error("UnityWebGLApp.unityCanvas / unityContainer missing");

    const SPLASH_SCREEN = document.querySelector("#SPLASH_SCREEN");
    const logo = document.querySelector("#logo");
    
    if (!SPLASH_SCREEN || !logo)
      throw new Error("Required DOM nodes #SPLASH_SCREEN or #logo missing");

    /* ---------- simple error logging ---------- */
    SPLASH_SCREEN.onerror = () =>
      Log.error(`[render] splash load error → ${SPLASH_SCREEN.src}`);
    logo.onerror = () => Log.error(`[render] logo load error → ${logo.src}`);

    /* ---------- show container ---------- */
    unityContainer.style.display = "block";

    if (isMobile) {
      SPLASH_SCREEN.src = assets.SPLASH_MOBILE;
      logo.src = assets.LOGO;
      logo.style.display = "block";
      unityContainer.className = "unity-mobile";
      unityCanvas.className = "unity-mobile";

      /* Mobile viewport meta */
      const meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content =
        "width=device-width, height=device-height, initial-scale=1.0, " +
        "user-scalable=no, shrink-to-fit=yes";
      document.head.appendChild(meta);

      // To lower canvas resolution on mobile devices for performance,
      // uncomment the next line:
      // config.devicePixelRatio = 1;
    } else {
      logo.style.display  = "none";
      SPLASH_SCREEN.src   = assets.SPLASH_DESKTOP;
      // unityCanvas.style.width  = "{{{ WIDTH }}}px";
      // unityCanvas.style.height = "{{{ HEIGHT }}}px";
    }

    setBackground(isMobile);
    showLoadingBar();

    _initialized = true;
    Log.debug(`[render] init OK (mobile=${isMobile}, retry=${retry})`);
    return { ok: true };
  } catch (err) {
    Log.error("[render] init FAILED:", err);
    return { ok: false, error: err };
  }
}

/* ───────────────────── helpers ───────────────────── */

function showLoadingBar() {
  document
    .getElementById("loading-text")
    ?.style.setProperty("display", "block");
  const loadingBar = document.getElementById("unity-loading-bar");
  // if (loadingBar.style.display === "none") {
  loadingBar && (loadingBar.style.display = "block");
  // }
}

/**
 * Applies a background image (currently disabled).
 * @param {boolean} isMobile
 */
function setBackground(isMobile) {
  if (isMobile) {
    // document.body.style.backgroundImage =
    //   "url('TemplateData/mobile_error/background-image.jpg')";
  } else {
    // document.body.style.backgroundImage =
    //   "url('YOUR_BACKGROUND_IMAGE_URL_HERE')";
  }
}

/* Reserved: start button flow */
function addStartButton() {
  // start button logic
  // document
  //   .getElementById("start-button")
  //   .addEventListener("click", function () {
  //     if (!(typeof mainScriptLoaded !== "undefined" && mainScriptLoaded))
  //       return;
  //     sendEvent(Events.HTML_Click_Start);
  //     document.getElementById("start-container").remove();
  //     document.getElementById("loading-text").style.display = "block";
  //     startCreateUnityInstance(config);
  //   });
  // sendEvent(Events.HTML_Button_Start_Showed);
}
