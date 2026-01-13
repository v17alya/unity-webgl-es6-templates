/* ──────────────────────────────────────────────────────────────────────────
 *  helpers.module.js
 *  ------------------------------------------------------------------------
 *  Utility helpers for the Unity WebGL wrapper.
 *  ---------------------------------------------------------------------- */

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

let _initialized = false; // guards idempotent init

/* ════════════════════════════════════════════════════════════════════════
 *  1. BOOTSTRAP INITIALISATION
 * ═════════════════════════════════════════════════════════════════════ */

/**
 * Installs global event handlers exactly once.
 *
 * @param {HTMLCanvasElement|null} unityCanvas   – Canvas hosting the WebGL build.
 * @param {{retryCount?:number}}   [opts]        – Used only for optional logging.
 * @returns {Promise<{ok:true}|{ok:false,error:Error}>}
 */
export async function initHelper(unityCanvas = null, opts = {}) {
  if (_initialized) return { ok: true };
  const { retryCount = 0 } = opts;

  try {
    /* ── Pointer‑lock on right‑mouse‑button down ───────────────────────── */
    document.addEventListener(
      "mousedown",
      (event) => {
        if (event.button === 2 && unityCanvas) {
          try {
            unityCanvas.requestPointerLock?.();
          } catch {}
        }
      },
      false
    );

    /* ── Release pointer‑lock on mouse‑up ──────────────────────────────── */
    document.addEventListener(
      "mouseup",
      (event) => {
        if (event.button === 2) {
          try {
            document.exitPointerLock();
          } catch {}
        }
      },
      false
    );

    /* ── Notify Unity before the tab/window closes ────────────────────── */
    window.addEventListener(
      "beforeunload",
      (e) => {
        e.preventDefault(); // trigger dialog in some browsers
        e.returnValue = ""; // legacy browser support

        window.UnityWebGLApp?.myGameInstance?.SendMessage?.(
          "CloseEventHandler",
          "OnCloseButtonClicked"
        );
      },
      // { once: true }
    );

    _initialized = true;
    Log.debug(`[helpers] init OK (retry ${retryCount})`);
    return { ok: true };
  } catch (err) {
    Log.error("[helpers] init FAILED:", err);
    return { ok: false, error: err };
  }
}

/* ════════════════════════════════════════════════════════════════════════
 *  2. DEVICE / BROWSER / ENVIRONMENT HELPERS
 * ═════════════════════════════════════════════════════════════════════ */

/**
 * Rough mobile detection.
 * Uses UA‑Client‑Hints first, then classic UA regex fallbacks.
 *
 * @returns {boolean} True for phones / tablets, otherwise false.
 */
export function checkIfMobile() {
  const ua = navigator.userAgent;
  const hintMobile = navigator.userAgentData?.mobile;

  /* modern hint, or quick simple regex */
  if (
    hintMobile ||
    /\b(BlackBerry|webOS|iPhone|IEMobile|Android|Windows Phone|iPad|iPod)\b/i.test(
      ua
    ) ||
    (ua.includes("Mac") && "ontouchend" in document) // iPadOS 13+
  ) {
    return true;
  }

  /* legacy monster‑regexes to catch edge cases */
  return (
    /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(
      ua
    ) ||
    /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
      ua.slice(0, 4)
    )
  );
}

/**
 * Returns a human‑friendly device label (e.g., “iPhone”, “Mac”, “Xbox”…).
 * Tries UA‑Client‑Hints, then falls back to regex rules.
 *
 * @returns {string}
 */
export function getDeviceName() {
  if (navigator.userAgentData) {
    const { platform, mobile } = navigator.userAgentData;
    return mobile ? `Mobile (${platform})` : platform;
  }

  const ua = navigator.userAgent || navigator.vendor || window.opera;
  const rules = [
    { re: /iPhone/i, name: "iPhone" },
    {
      re: /iPad|Macintosh/i,
      name: "iPad",
      extra: () => "ontouchend" in document,
    },
    { re: /iPod/i, name: "iPod" },
    { re: /Android/i, name: "Android" },
    { re: /Windows Phone|IEMobile|WPDesktop/i, name: "Windows Phone" },
    { re: /BlackBerry|BB10|PlayBook/i, name: "BlackBerry" },
    { re: /Kindle|Silk/i, name: "Kindle" },
    { re: /webOS|hpwOS/i, name: "webOS" },
    { re: /Tizen/i, name: "Tizen" },
    { re: /CrOS/i, name: "Chrome OS" },
    { re: /PlayStation/i, name: "PlayStation" },
    { re: /Nintendo/i, name: "Nintendo" },
    { re: /Xbox/i, name: "Xbox" },
    { re: /Macintosh/i, name: "Mac" },
    { re: /Windows NT/i, name: "Windows" },
    { re: /Linux/i, name: "Linux" },
  ];
  for (const r of rules)
    if (r.re.test(ua) && (r.extra ? r.extra() : true)) return r.name;

  return "Unknown device";
}

/**
 * Very lightweight browser identification.
 * First prefers UA‑Client‑Hints (`navigator.userAgentData.brands`),
 * otherwise falls back to parsing the classical User‑Agent string.
 *
 * @returns {string}
 */
export function getBrowserName() {
  const hints = navigator.userAgentData?.brands;
  if (hints?.length) {
    const known = hints.find((b) =>
      /chrome|edge|opera|firefox|safari/i.test(b.brand)
    );
    if (known) return known.brand;
  }

  const agent = navigator.userAgent.toLowerCase();
  switch (true) {
    case agent.includes("edg/"):
      return "Edge (Chromium)";
    case agent.includes("edge"):
      return "MS Edge (Legacy)";
    case agent.includes("opr") && !!window.opr:
      return "Opera";
    case agent.includes("chrome") && !!window.chrome:
      return "Google Chrome";
    case agent.includes("trident"):
      return "MS IE";
    case agent.includes("firefox"):
      return "Mozilla Firefox";
    case agent.includes("safari"):
      return "Safari";
    default:
      return "Other";
  }
}

/**
 * Injects `<meta name="robots">` so that ONLY production build is indexed.
 */
export function checkIndexer(isProduction) {
  document.addEventListener("DOMContentLoaded", () => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = isProduction ? "index,follow" : "noindex,nofollow";
    Log.info(
      `Robots meta = "${meta.content}"`
    );
    document.head.appendChild(meta);
  });
}

/**
 * Returns the N‑th path segment of a URL in UPPERCASE, or undefined.
 *
 * @param {string} url     – Full URL string to analyse.
 * @param {number} index   – Zero‑based segment index.
 * @returns {string|undefined}
 */
export function parseSegment(url, index) {
  try {
    return new URL(url).pathname
      .split("/")
      .filter(Boolean)
      [index]?.toUpperCase();
  } catch {
    return undefined;
  }
}

/**
 * Collects minimal system info useful for troubleshooting:
 *   • RAM (deviceMemory)
 *   • CPU threads
 *   • GPU vendor + renderer (if WEBGL_debug_renderer_info available)
 *
 * @returns {string} JSON string with {minRam, hardwareConcurrency, renderer, vendor}
 */
export function getSystemInfo() {
  let renderer, vendor;

  try {
    const gl =
      document.createElement("canvas").getContext("webgl2") ||
      document.createElement("canvas").getContext("webgl") ||
      document.createElement("canvas").getContext("experimental-webgl");

    if (gl) ({ renderer, vendor } = getUnmaskedInfo(gl));
  } catch {
    /* ignore */
  }

  return JSON.stringify({
    minRam: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    renderer,
    vendor,
  });
}

/**
 * Helper: tries to retrieve unmasked GPU information via WEBGL_debug_renderer_info.
 *
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
 * @returns {{renderer:string, vendor:string}}
 */
function getUnmaskedInfo(gl) {
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  return dbg
    ? {
        renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL),
        vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL),
      }
    : { renderer: "", vendor: "" };
}
