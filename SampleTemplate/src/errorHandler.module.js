// src/errorHandler.module.js
// Centralised error collection + reporting with WebGL‑info caching
// ---------------------------------------------------------------

import { sendEvent } from "./amplitude.module.js?v={{{ PRODUCT_VERSION }}}";
import { Events } from "./analytics_events.module.js?v={{{ PRODUCT_VERSION }}}";
import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

/* ------------------------------------------------------------------ *
 *  private util
 * ------------------------------------------------------------------ */
const safeJson = (v) => {
  if (typeof v !== "object") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "[Circular]";
  }
};

/* ------------------------------------------------------------------ *
 *  ErrorHandler singleton
 * ------------------------------------------------------------------ */
export class ErrorHandler {
  /* ------------------------------------------------ class‑level cache */
  static #instance;
  static #cachedWebGLInfo = null; // ← cached once

  constructor() {
    if (ErrorHandler.#instance) return ErrorHandler.#instance;

    Object.assign(this, {
      errorCount: 0,
      history: [],
      HISTORY_LIMIT: 50,
    });

    this.#installGlobalListeners();
    ErrorHandler.#instance = this;
  }

  /* ------------------------------------------------ public helpers */

  static initialize() {
    return new ErrorHandler();
  }

  static logError(msg, ctx = {}, err = null) {
    ErrorHandler.#instance.#handle({
      type: "manual_error",
      message: msg,
      context: ctx,
      error: err?.message,
      stack: err?.stack,
    });
  }

  static logModuleError(module, op, err, ctx = {}) {
    ErrorHandler.#instance.#handle({
      type: "module_error",
      message: `${module}: ${op} failed`,
      module,
      operation: op,
      error: err?.message || err,
      stack: err?.stack,
      context: ctx,
    });
  }

  /* ------------------------------------------------ internals */

  #installGlobalListeners() {
    if (this._installed) return;
    this._installed = true;

    window.addEventListener("error", (e) =>
      this.#handle({
        type: "javascript_error",
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        error: e.error,
        stack: e.error?.stack,
      })
    );

    window.addEventListener("unhandledrejection", (e) =>
      this.#handle({
        type: "unhandled_promise_rejection",
        message: e.reason?.message || "unhandled promise",
        reason: e.reason,
        stack: e.reason?.stack,
      })
    );

    /* -------- patch console.error (ONLY goes to Firebase) -------- */
    if (!console._patchedByErrorHandler) {
      const orig = console.error.bind(console);
      console.error = (...a) => {
        try {
          ErrorHandler.#instance.#handle({
            type: "console_error", // ← mark so we skip amplitude
            message: a.map(safeJson).join(" "),
          });
        } finally {
          orig(...a); // never swallow output
        }
      };
      console._patchedByErrorHandler = true;
    }
  }

  #handle(errData) {
    this.errorCount++;
    const enriched = this.#enrich(errData);
    this.#pushHistory(enriched);

    /*  console errors are *only* sent to Firebase  */
    if (enriched.type !== "console_error") this.#toAnalytics(enriched);
    this.#toFirebase(enriched);

    if (this.#isCritical(enriched)) this.#critical(enriched);
  }

  #enrich(ed) {
    return {
      ...ed,
      errorId: `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      errorCount: this.errorCount,

      // browser / env
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      url: location.href,
      referrer: document.referrer,
      title: document.title,
      onLine: navigator.onLine,

      // viewport
      screenW: screen.width,
      screenH: screen.height,
      winW: innerWidth,
      winH: innerHeight,

      memory: this.#getMem(),
      timing: this.#getTiming(),
      storageOk: this.#hasLocalStorage(),

      webglInfo: ErrorHandler.#getWebGLInfoCached(),
    };
  }

  #pushHistory(e) {
    this.history.push(e);
    if (this.history.length > this.HISTORY_LIMIT) this.history.shift();
  }

  #toAnalytics(e) {
    try {
      sendEvent(
        Events.HTML_Window_Error,
        {
          error_type: e.type,
          error_message: e.message,
          error_id: e.errorId,
          stack_trace: e.stack?.slice(0, 1000),
          url: e.url,
          webgl_supported: e.webglInfo?.supported,
          memory_used: e.memory?.usedJSHeapSize,
        },
        {},
        true
      );
    } catch {
      /* ignore analytics delivery failures */
    }
  }

  #toFirebase(e) {
    try {
      window.firebaseLogger?.log?.("error", e);
    } catch {
      /* ignore */
    }
  }

  #isCritical(e) {
    return /webgl|unity|out of memory|network error|script error/i.test(
      e.message + e.type
    );
  }

  #critical(e) {
    sendEvent(
      Events.HTML_Critical_Error,
      {
        error_id: e.errorId,
        error_type: e.type,
        error_message: e.message,
        total_errors: this.errorCount,
      },
      {},
      true
    );

    if (e.type === "webgl_context_lost") {
      if (confirm("WebGL error. Reload the page?")) location.reload();
    }
  }

  /* ---------- small env helpers ---------- */

  #getMem() {
    return performance.memory ?? null;
  }
  #getTiming() {
    const t = performance.timing;
    if (!t) return null;
    const n = t.navigationStart;
    return {
      domContentLoaded: t.domContentLoadedEventEnd - n,
      loadComplete: t.loadEventEnd - n,
      domInteractive: t.domInteractive - n,
    };
  }
  #hasLocalStorage() {
    try {
      localStorage.setItem("__ls__", "1");
      localStorage.removeItem("__ls__");
      return true;
    } catch {
      return false;
    }
  }

  /* ---------- WebGL info (cached once) ---------- */

  static #getWebGLInfoCached() {
    if (this.#cachedWebGLInfo) return this.#cachedWebGLInfo;

    try {
      const gl =
        document.createElement("canvas").getContext("webgl") ||
        document.createElement("canvas").getContext("experimental-webgl");
      if (!gl) return (this.#cachedWebGLInfo = { supported: false });

      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      this.#cachedWebGLInfo = {
        supported: true,
        version: gl.getParameter(gl.VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: dbg
          ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
          : "unknown",
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      };
    } catch (e) {
      this.#cachedWebGLInfo = { supported: false, error: e.message };
    }
    return this.#cachedWebGLInfo;
  }
}