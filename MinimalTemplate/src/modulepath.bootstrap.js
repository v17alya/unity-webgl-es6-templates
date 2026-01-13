/**
 * Sets up the module path for ES6 module imports.
 * This is executed synchronously before any module imports.
 */
(function () {
  try {
    var script = document.currentScript && document.currentScript.src;
    window.modulePath = script
      ? script.substring(0, script.lastIndexOf("/") + 1)
      : location.origin +
        location.pathname.substring(0, location.pathname.lastIndexOf("/") + 1);
  } catch (e) {
    window.modulePath = location.origin + "/";
  }
})();
