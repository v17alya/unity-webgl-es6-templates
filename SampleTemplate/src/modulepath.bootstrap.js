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
