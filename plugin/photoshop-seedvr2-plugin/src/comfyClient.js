(function () {
  const { storage } = require("uxp");
  const fs = storage.localFileSystem;
  const formats = storage.formats;

  function normalizeBaseUrl(url) {
    const trimmed = String(url || "").trim().replace(/\/+$/, "");
    if (!trimmed) {
      throw new Error("ComfyUI URL is empty.");
    }
    return trimmed;
  }

  function asWsUrl(baseUrl, clientId) {
    const wsBase = baseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    return `${wsBase}/ws?clientId=${encodeURIComponent(clientId)}`;
  }

  function makeClientId() {
    return `ps-seedvr2-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function guessMimeType(fileName) {
    const lower = String(fileName || "").toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".jpe") || lower.endsWith(".jfif")) {
      return "image/jpeg";
    }
    if (lower.endsWith(".webp")) {
      return "image/webp";
    }
    if (lower.endsWith(".gif")) {
      return "image/gif";
    }
    if (lower.endsWith(".bmp")) {
      return "image/bmp";
    }
    return "image/png";
  }

  async function readFileBytes(file) {
    return file.read({ format: formats.binary });
  }

  function extensionFor(fileName, mimeType) {
    const match = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    if (match && ["png", "jpg", "jpeg", "jpe", "jfif", "webp", "gif", "bmp"].includes(match[1])) {
      return ["jpeg", "jpe", "jfif"].includes(match[1]) ? "jpg" : match[1];
    }
    if (mimeType === "image/jpeg") {
      return "jpg";
    }
    if (mimeType === "image/webp") {
      return "webp";
    }
    return "png";
  }

  function sanitizeUploadPart(value) {
    return String(value || "")
      .trim()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  }

  function makeUploadName(file, role, mimeType) {
    const base = sanitizeUploadPart(file && file.name) || role || "image";
    const safeRole = sanitizeUploadPart(role) || "image";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const extension = extensionFor(file && file.name, mimeType);
    return `seedvr2-${safeRole}-${unique}-${base}.${extension}`;
  }

  function makeUploadPart(bytes, fileName, mimeType) {
    if (typeof File === "function") {
      try {
        return new File([bytes], fileName, { type: mimeType });
      } catch (error) {
        // Некоторые сборки UXP поддерживают Blob, но не браузерный конструктор File.
      }
    }

    return new Blob([bytes], { type: mimeType });
  }

  async function readFileAsBlob(file, mimeType) {
    const bytes = await file.read({ format: formats.binary });
    return new Blob([bytes], { type: mimeType });
  }

  async function responseJson(response, label) {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${label} failed (${response.status}): ${text || response.statusText}`);
    }
    return response.json();
  }

  async function responseOptionalJson(response, label) {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${label} failed (${response.status}): ${text || response.statusText}`);
    }

    const text = await response.text().catch(() => "");
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  }

  function isCancelled(cancelToken) {
    return Boolean(cancelToken && cancelToken.cancelled);
  }

  function cancelledError() {
    const error = new Error("Generation cancelled.");
    error.kind = "cancelled";
    return error;
  }

  function getImageName(uploadResponse) {
    const name = uploadResponse.name || uploadResponse.filename;
    const subfolder = uploadResponse.subfolder || "";
    if (!name) {
      return "";
    }
    return subfolder ? `${subfolder}/${name}` : name;
  }

  function findOutputImage(historyEntry, preferredNodeId) {
    const outputs = historyEntry && historyEntry.outputs;
    if (!outputs) {
      return null;
    }

    const preferred = outputs[String(preferredNodeId)];
    if (preferred && preferred.images && preferred.images.length) {
      return preferred.images[0];
    }

    for (const nodeId of Object.keys(outputs)) {
      const out = outputs[nodeId];
      if (out && out.images && out.images.length) {
        return out.images[0];
      }
    }

    return null;
  }

  class ComfyClient {
    constructor(baseUrl, logger) {
      this.baseUrl = normalizeBaseUrl(baseUrl);
      this.logger = logger;
    }

    async testConnection() {
      const data = await responseJson(
        await fetch(`${this.baseUrl}/system_stats`),
        "ComfyUI connection test"
      );
      return data;
    }

    async uploadImage(file, role) {
      const formData = new FormData();
      const sourceName = file && file.name ? file.name : "";
      const mimeType = guessMimeType(sourceName);
      const safeName = makeUploadName(file, role || "input", mimeType);
      const bytes = await readFileBytes(file);
      const uploadPart = makeUploadPart(bytes, safeName, mimeType);

      formData.append("image", uploadPart, safeName);
      formData.append("type", "input");
      formData.append("overwrite", "false");

      const data = await responseJson(
        await fetch(`${this.baseUrl}/upload/image`, {
          method: "POST",
          body: formData
        }),
        "ComfyUI image upload"
      );

      const imageName = getImageName(data);
      if (!imageName) {
        throw new Error("ComfyUI upload response did not contain an image name.");
      }

      return { ...data, imageName };
    }

    async openSocket(clientId, onEvent) {
      const ws = new WebSocket(asWsUrl(this.baseUrl, clientId));
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          try {
            ws.close();
          } catch (error) {
            // Игнорируем ошибки закрытия сокета, чтобы сообщить реальную причину тайм-аута.
          }
          reject(new Error("Timed out while connecting to ComfyUI WebSocket."));
        }, 8000);

        ws.onopen = () => {
          clearTimeout(timeout);
          resolve(ws);
        };
        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Could not open ComfyUI WebSocket."));
        };
        ws.onmessage = (event) => {
          if (typeof event.data !== "string") {
            return;
          }
          try {
            onEvent(JSON.parse(event.data));
          } catch (error) {
            // ComfyUI может отправлять бинарные кадры превью не в JSON-формате, здесь их игнорируем.
          }
        };
      });
    }

    async queuePrompt(prompt, clientId) {
      const data = await responseJson(
        await fetch(`${this.baseUrl}/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, client_id: clientId })
        }),
        "ComfyUI prompt queue"
      );

      if (!data.prompt_id) {
        throw new Error("ComfyUI did not return a prompt_id.");
      }
      return data.prompt_id;
    }

    async getHistory(promptId) {
      return responseJson(
        await fetch(`${this.baseUrl}/history/${encodeURIComponent(promptId)}`),
        "ComfyUI history request"
      );
    }

    async interrupt() {
      return responseOptionalJson(
        await fetch(`${this.baseUrl}/interrupt`, {
          method: "POST"
        }),
        "ComfyUI interrupt"
      );
    }

    async deletePrompt(promptId) {
      if (!promptId) {
        return null;
      }

      return responseOptionalJson(
        await fetch(`${this.baseUrl}/queue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delete: [promptId] })
        }),
        "ComfyUI queue delete"
      );
    }

    waitForSocketDone(ws, promptId, onProgress, cancelToken, bufferedEvents, deadline) {
      return new Promise((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          clearTimeout(timeout);
          clearInterval(cancelCheck);
          ws.onclose = null;
        };

        const closeSocket = () => {
          try {
            ws.close();
          } catch (error) {
            // Игнорируем ошибки закрытия: вызывающая сторона получает фактический результат.
          }
        };

        const rejectOnce = (error) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          closeSocket();
          reject(error);
        };

        const resolveOnce = () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          closeSocket();
          resolve();
        };

        const timeout = setTimeout(() => {
          const error = new Error("Generation timed out after 30 minutes.");
          error.kind = "timeout";
          rejectOnce(error);
        }, Math.max(1, (deadline || Date.now() + 30 * 60 * 1000) - Date.now()));

        const cancelCheck = setInterval(() => {
          if (isCancelled(cancelToken)) {
            rejectOnce(cancelledError());
          }
        }, 250);

        const processMessage = (message) => {
          if (settled) {
            return;
          }
          if (isCancelled(cancelToken)) {
            rejectOnce(cancelledError());
            return;
          }
          if (message.type === "progress" && message.data &&
              (!message.data.prompt_id || message.data.prompt_id === promptId)) {
            onProgress && onProgress(message.data);
          }

          if (message.type === "execution_error" && message.data && message.data.prompt_id === promptId) {
            const error = new Error(message.data.exception_message || "ComfyUI generation failed.");
            error.kind = "execution_error";
            rejectOnce(error);
          }

          if (message.type === "execution_interrupted" && message.data && message.data.prompt_id === promptId) {
            if (isCancelled(cancelToken)) {
              rejectOnce(cancelledError());
              return;
            }
            const error = new Error("ComfyUI generation was interrupted.");
            error.kind = "execution_interrupted";
            rejectOnce(error);
          }

          if (message.type === "executing" && message.data && message.data.prompt_id === promptId && message.data.node === null) {
            resolveOnce();
          }
        };
        ws.onmessage = (event) => {
          if (typeof event.data !== "string") { return; }
          let message;
          try { message = JSON.parse(event.data); } catch (error) { return; }
          processMessage(message);
        };
        ws.onclose = () => rejectOnce(new Error("ComfyUI WebSocket closed. Continuing with history polling."));
        ws.onerror = () => rejectOnce(new Error("ComfyUI WebSocket failed. Continuing with history polling."));
        for (const message of bufferedEvents || []) { processMessage(message); }
        if (!settled && ws.readyState === 3) { ws.onclose(); }
      });
    }

    async waitForHistoryImage(promptId, preferredNodeId, cancelToken, deadline) {
      const end = deadline || Date.now() + 30 * 60 * 1000;
      while (Date.now() < end) {
        if (isCancelled(cancelToken)) {
          throw cancelledError();
        }
        const history = await this.getHistory(promptId);
        const entry = history[promptId];
        const messages = entry && entry.status && entry.status.messages || [];
        const failure = messages.find((message) => message[0] === "execution_error" || message[0] === "execution_interrupted");
        if (failure || (entry && entry.status && entry.status.status_str === "error")) {
          const error = new Error(failure && failure[1] && failure[1].exception_message || "ComfyUI generation failed or was interrupted.");
          error.kind = failure ? failure[0] : "execution_error";
          throw error;
        }
        const image = findOutputImage(entry, preferredNodeId);
        if (image) {
          return image;
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      const error = new Error("Generation timed out after 30 minutes.");
      error.kind = "timeout";
      throw error;
    }

    async runPrompt(prompt, preferredOutputNodeId, onProgress, options) {
      const cancelToken = options && options.cancelToken;
      const clientId = makeClientId();
      let lastEvent = null;
      let ws = null;
      const bufferedEvents = [];

      if (isCancelled(cancelToken)) {
        throw cancelledError();
      }

      try {
        ws = await this.openSocket(clientId, (message) => {
          lastEvent = message;
          bufferedEvents.push(message);
          if (bufferedEvents.length > 64) { bufferedEvents.shift(); }
        });
      } catch (error) {
        this.logger && this.logger.warn(`${error.message} Continuing with history polling.`);
      }

      try {
      if (isCancelled(cancelToken)) {
        throw cancelledError();
      }

      const promptId = await this.queuePrompt(prompt, clientId);
      const deadline = Date.now() + 30 * 60 * 1000;
      if (options && typeof options.onPromptQueued === "function") {
        options.onPromptQueued(promptId);
      }
      this.logger && this.logger.info(`Queued ComfyUI prompt ${promptId}.`);

      if (isCancelled(cancelToken)) {
        await this.deletePrompt(promptId).catch(() => null);
        await this.interrupt().catch(() => null);
        throw cancelledError();
      }

      if (ws) {
        try {
          await this.waitForSocketDone(ws, promptId, onProgress, cancelToken, bufferedEvents, deadline);
        } catch (error) {
          if (error.kind === "execution_error" || error.kind === "execution_interrupted" || error.kind === "cancelled" || error.kind === "timeout") {
            throw error;
          }
          this.logger && this.logger.warn(`${error.message} Falling back to history polling.`);
        }
      }

      const image = await this.waitForHistoryImage(promptId, preferredOutputNodeId, cancelToken, deadline);
      return { promptId, image, lastEvent };
      } finally {
        if (ws) { try { ws.close(); } catch (error) { /* Already closed. */ } }
      }
    }

    async downloadImage(image) {
      const params = new URLSearchParams({
        filename: image.filename,
        subfolder: image.subfolder || "",
        type: image.type || "output"
      });
      const response = await fetch(`${this.baseUrl}/view?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`ComfyUI image download failed (${response.status}).`);
      }

      const blob = await response.blob();
      const bytes = await blob.arrayBuffer();
      const tempFolder = await fs.getTemporaryFolder();
      const fileName = `seedvr2-result-${Date.now()}-${image.filename || "output.png"}`.replace(/[\\/:*?"<>|]/g, "-");
      const file = await tempFolder.createFile(fileName, { overwrite: true });
      await file.write(bytes, { format: formats.binary });

      return {
        file,
        blob,
        objectUrl: URL.createObjectURL(blob),
        image
      };
    }
  }

  globalThis.SeedVR2ComfyClient = {
    ComfyClient,
    normalizeBaseUrl
  };
})();
