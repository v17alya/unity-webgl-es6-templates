/**
 * Progress UI module.
 * Aggregates bootstrap and Unity load progress into a single UI bar.
 * Combined progress = 50% (bootstrap) + 50% (Unity loading)
 */

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

let progressBarFullEl = null;
let bootstrapProgress = 0; // [0..1]
let buildLoadProgress = 0; // [0..1]

/**
 * Lazily resolves and caches the loader progress bar element.
 * @returns {HTMLElement|null} The progress bar element or null if not present yet.
 */
function ensureElement() {
  if (!progressBarFullEl) {
    progressBarFullEl = document.getElementById("unity-progress-bar-full");
    const loadingBar = document.getElementById("unity-loading-bar");
    if (loadingBar) {
      loadingBar.style.display = "block";
    }
  }
  return progressBarFullEl;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Renders the combined progress (bootstrap + unity) to the UI element.
 */
function render() {
  const el = ensureElement();
  if (!el) return;
  const combined = 0.5 * clamp01(bootstrapProgress) + 0.5 * clamp01(buildLoadProgress);
  const pct = Math.round(combined * 100);
  el.style.width = pct + "%";
}

/**
 * Sets the bootstrap progress
 * @param {number} value01 Value in [0..1]
 */
export function setBootstrapProgress(value01) {
  bootstrapProgress = clamp01(Number(value01) || 0);
  render();
}

/**
 * Sets the Unity build loading progress.
 * @param {number} value01 Value in [0..1]
 */
export function setUnityBuildLoadProgress(value01) {
  buildLoadProgress = clamp01(Number(value01) || 0);
  render();
}
