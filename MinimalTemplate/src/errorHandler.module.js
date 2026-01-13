/**
 * Centralized error collection and reporting.
 * Handles global JavaScript errors, unhandled promise rejections, and manual error logging.
 */

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

const safeJson = (v) => {
  if (typeof v !== "object") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "[Circular]";
  }
};

export class ErrorHandler {
  static #instance;
  static #cachedWebGLInfo = null;

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
  }

  #handle(errData) {
    this.errorCount++;
    const enriched = this.#enrich(errData);
    this.#pushHistory(enriched);
    
    // Log to console
    Log.error("[ErrorHandler]", enriched);

    if (this.#isCritical(enriched)) {
      this.#critical(enriched);
    }
  }

  #enrich(ed) {
    return {
      ...ed,
      errorId: `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      errorCount: this.errorCount,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      url: location.href,
      referrer: document.referrer,
      title: document.title,
      onLine: navigator.onLine,
      screenW: screen.width,
      screenH: screen.height,
      winW: innerWidth,
      winH: innerHeight,
      memory: this.#getMem(),
      webglInfo: ErrorHandler.#getWebGLInfoCached(),
    };
  }

  #pushHistory(e) {
    this.history.push(e);
    if (this.history.length > this.HISTORY_LIMIT) this.history.shift();
  }

  #isCritical(e) {
    return /webgl|unity|out of memory|network error|script error/i.test(
      e.message + e.type
    );
  }

  #critical(e) {
    if (e.type === "webgl_context_lost") {
      if (confirm("WebGL error. Reload the page?")) location.reload();
    }
  }

  #getMem() {
    return performance.memory ?? null;
  }

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
