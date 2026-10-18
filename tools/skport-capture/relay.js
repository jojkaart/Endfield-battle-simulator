// Runs in the extension's isolated world. Collects the responses posted by
// page-hook.js for the lifetime of the page and, a few seconds after the
// last new one, sends them all to background.js, which validates them and
// saves one file per page visit (overwritten as more arrives).
//
// It can't use core.js: Chrome injects a file only once per page, and
// page-hook.js already loads it into the page's world.
(function () {
  "use strict";

  const MESSAGE_SOURCE = "endfield-capture-page";
  const SAVE_DELAY_MS = 4000;

  const startedAt = new Date().toISOString();
  const messages = new Map();
  let saveTimer = null;

  function save() {
    chrome.runtime.sendMessage({
      type: "endfield-capture-save",
      startedAt,
      pageUrl: window.location.href,
      messages: [...messages.values()],
    });
  }

  window.addEventListener("message", (event) => {
    // Only messages from this page's own window, tagged by page-hook.js.
    // background.js validates their content.
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== MESSAGE_SOURCE || typeof message.url !== "string") return;
    messages.set(message.url, message);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DELAY_MS);
  });
})();
