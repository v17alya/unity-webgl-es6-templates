// not using now

(function () {
  let logs = [];
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  function captureLog(type, args) {
    const timestamp = new Date().toISOString();
    logs.push(
      `[${timestamp}] [${type.toUpperCase()}] ${args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg
        )
        .join(" ")}`
    );
    originalConsole[type].apply(console, args);
  }

  console.log = (...args) => captureLog("log", args);
  console.warn = (...args) => captureLog("warn", args);
  console.error = (...args) => captureLog("error", args);
  console.info = (...args) => captureLog("info", args);
  console.debug = (...args) => captureLog("debug", args);

  window.saveConsoleLogs = function (filename = "console_logs.txt") {
    const blob = new Blob([logs.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
})();
