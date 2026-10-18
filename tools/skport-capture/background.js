// Validates the responses relay.js collected, saves them as one JSON file in
// the Downloads folder, and shows the number of captured responses on the
// toolbar icon. Keeps no state, since the service worker may be stopped at
// any time.
"use strict";

importScripts("core.js");
const capture = globalThis.EndfieldCapture;

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== "endfield-capture-save" || !Array.isArray(message.messages)) return;
  const pageUrl = String(message.pageUrl);

  let entries = {};
  for (const raw of message.messages) {
    entries = capture.addEntry(entries, capture.makeEntry(raw || {}, pageUrl));
  }
  const data = capture.buildExport({
    entries,
    startedAt: message.startedAt,
    savedAt: new Date().toISOString(),
    pageUrl,
    extensionVersion: chrome.runtime.getManifest().version,
  });
  if (data.responses.length === 0) return;

  chrome.downloads.download({
    url: "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2)),
    filename: capture.exportFilename(message.startedAt),
    conflictAction: "overwrite",
    saveAs: false,
  });

  if (sender.tab && sender.tab.id !== undefined) {
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: String(data.responses.length) });
  }
});
