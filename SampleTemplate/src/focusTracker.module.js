// focusTracker.module.js
// Lightweight class that watches `visibilitychange`, `blur`, `focus`
// and notifies the supplied callback whenever page focus changes.

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

export class FocusTracker {
  /**
   * @param {(hasFocus: boolean) => void} onChange – callback fired on focus ↔ blur
   */
  constructor(onChange) {
    Log.debug("[FocusTracker] ctor");
    /** user‑supplied callback */
    this.onChange = onChange;
    /** @private {boolean|undefined} last known state */
    this._focused = undefined;

    /* bind once so we can remove listeners later */
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onFocus = this._onFocus.bind(this);

    /* attach listeners */
    document.addEventListener("visibilitychange", this._onVisibilityChange);
    window.addEventListener("blur", this._onBlur);
    window.addEventListener("focus", this._onFocus);

    /* initial state */
    this._setFocused(!document.hidden);
  }

  /** Returns the current focus flag. */
  get focused() {
    return this._focused;
  }

  /* ---------- private handlers ---------- */

  /** Fired when the tab becomes hidden / visible. */
  _onVisibilityChange() {
    Log.debug("[FocusTracker] visibilitychange → hidden?", document.hidden);
    this._setFocused(!document.hidden);
  }

  /** Fired when the window loses focus (but tab is still visible). */
  _onBlur() {
    this._setFocused(false);
  }

  /** Fired when the window regains focus. */
  _onFocus() {
    this._setFocused(true);
  }

  /**
   * Updates internal flag and notifies the callback (if changed).
   * @param {boolean} value
   * @private
   */
  _setFocused(value) {
    const old = this._focused;
    Log.debug("[FocusTracker] setFocused:", old, "→", value);
    if (old === value) return;

    this._focused = value;
    try {
      this.onChange(value);
    } catch (err) {
      Log.error("[FocusTracker] callback threw:", err);
    }
  }

  /**
   * Detaches all listeners – must be called to avoid memory leaks.
   */
  dispose() {
    Log.debug("[FocusTracker] dispose");
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    window.removeEventListener("blur", this._onBlur);
    window.removeEventListener("focus", this._onFocus);
  }
}
