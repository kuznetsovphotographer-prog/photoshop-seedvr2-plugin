(function () {
  function timestamp() {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function createLogger() {
    function write(level, message) {
      const text = `[${timestamp()}] ${level}: ${message}`;
      if (level === "ERROR") {
        console.error(text);
        return;
      }
      if (level === "WARN") {
        console.warn(text);
        return;
      }
      console.log(text);
    }

    return {
      clear() {},
      info(message) {
        write("INFO", message);
      },
      warn(message) {
        write("WARN", message);
      },
      error(message) {
        write("ERROR", message);
      }
    };
  }

  function formatError(error) {
    if (!error) {
      return "Unknown error.";
    }
    return error.stack || error.message || String(error);
  }

  globalThis.SeedVR2Logger = { createLogger, formatError };
})();
