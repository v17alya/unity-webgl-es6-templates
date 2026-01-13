// webgl_error_loader.module.js
// Loader script: attaches error handler and dynamically imports overlay module on demand

import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";

/**
 * Handles WebGL context loss or manual invocation.
 * Dynamically loads the overlay module only when needed.
 * @param {Event} e - Optional event object.
 */
export function onWebGLError(e, isMobile) {
  if (e && e.preventDefault) e.preventDefault();

  // Dynamically import the overlay module only when showing the overlay
  import("./webgl_problems_overlay.module.js?v={{{ PRODUCT_VERSION }}}")
    .then((mod) => mod.showWebGLProblems(isMobile))
    .catch((err) => Log.error("Failed to load overlay module:", err));
}
