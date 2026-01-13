/**
 * Utility helpers for the Unity WebGL wrapper.
 */

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

let _initialized = false;

/**
 * Installs global event handlers exactly once.
 * @param {HTMLCanvasElement|null} unityCanvas - Canvas hosting the WebGL build.
 * @returns {Promise<{ok:true}|{ok:false,error:Error}>}
 */
export async function initHelper(unityCanvas = null) {
  if (_initialized) return { ok: true };

  try {
    // Pointer-lock on right-mouse-button down
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

    // Release pointer-lock on mouse-up
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

    // Notify Unity before the tab/window closes
    window.addEventListener(
      "beforeunload",
      (e) => {
        e.preventDefault();
        e.returnValue = "";

        // Call Unity cleanup if available
        if (window.GameTemplate?.myGameInstance?.SendMessage) {
          window.GameTemplate.myGameInstance.SendMessage(
            "CloseEventHandler",
            "OnCloseButtonClicked"
          );
        }
      }
    );

    _initialized = true;
    Log.debug(`[helpers] init OK`);
    return { ok: true };
  } catch (err) {
    Log.error("[helpers] init FAILED:", err);
    return { ok: false, error: err };
  }
}

/**
 * Rough mobile detection.
 * @returns {boolean} True for phones / tablets, otherwise false.
 */
export function checkIfMobile() {
  const ua = navigator.userAgent;
  const hintMobile = navigator.userAgentData?.mobile;

  if (
    hintMobile ||
    /\b(BlackBerry|webOS|iPhone|IEMobile|Android|Windows Phone|iPad|iPod)\b/i.test(ua) ||
    (ua.includes("Mac") && "ontouchend" in document)
  ) {
    return true;
  }
  return false;
}

/**
 * Gets basic system information.
 * @returns {Object} System info object
 */
export function getSystemInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    screenWidth: screen.width,
    screenHeight: screen.height,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

/**
 * Gets a human-readable device name.
 * @returns {string} Device name
 */
export function getDeviceName() {
  const ua = navigator.userAgent;
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("iPad")) return "iPad";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac")) return "Mac";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown";
}

/**
 * Gets a human-readable browser name.
 * @returns {string} Browser name
 */
export function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return "Unknown";
}
