// Runs in the page's own JavaScript world (manifest "world": "MAIN") so it
// can see the responses SKPORT's scripts receive. It wraps fetch and
// XMLHttpRequest, copies the bodies of read-only player data responses
// (filtered by EndfieldCapture.isTargetUrl) and posts them to relay.js.
// It sends no requests and reads no headers, cookies or tokens.
(function () {
  "use strict";

  const capture = globalThis.EndfieldCapture;
  if (!capture || globalThis.__endfieldCaptureHooked) return;
  globalThis.__endfieldCaptureHooked = true;

  const MESSAGE_SOURCE = "endfield-capture-page";

  function post(url, method, status, bodyText) {
    window.postMessage(
      { source: MESSAGE_SOURCE, url: String(url), method, status, bodyText, capturedAt: new Date().toISOString() },
      window.location.origin,
    );
  }

  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = input && typeof input === "object" && "url" in input ? input.url : input;
    const method = (init && init.method) || (input && typeof input === "object" && input.method) || "GET";
    const promise = originalFetch.apply(this, arguments);
    if (capture.isTargetUrl(url, window.location.href)) {
      promise
        .then((response) => response.clone().text().then((text) => post(response.url || url, method, response.status, text)))
        .catch(() => {});
    }
    return promise;
  };

  const urlKey = Symbol("endfieldCaptureUrl");
  const methodKey = Symbol("endfieldCaptureMethod");
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this[methodKey] = method;
    this[urlKey] = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    const xhr = this;
    if (capture.isTargetUrl(xhr[urlKey], window.location.href)) {
      xhr.addEventListener(
        "load",
        () => {
          let text = null;
          try {
            if (xhr.responseType === "" || xhr.responseType === "text") text = xhr.responseText;
            else if (xhr.responseType === "json") text = JSON.stringify(xhr.response);
          } catch {
            text = null;
          }
          if (text !== null) post(xhr.responseURL || xhr[urlKey], xhr[methodKey], xhr.status, text);
        },
        { once: true },
      );
    }
    return originalSend.apply(this, arguments);
  };
})();
