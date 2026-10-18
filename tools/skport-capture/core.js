// Pure capture logic shared by the extension's scripts and the tests.
// Loaded as a classic script (content scripts can't be ES modules), so it
// exposes `EndfieldCapture` on the global object, or module.exports in Node.
(function (root) {
  "use strict";

  const FORMAT = "endfield-skport-capture";
  const FORMAT_VERSION = 1;
  const API_HOST = "zonai.skport.com";

  // Read-only player data endpoints. Anything else (auth, sign-in, settings
  // writes) is never captured.
  const TARGET_PREFIXES = [
    "/api/v1/game/player/binding",
    "/api/v1/game/endfield/card/",
    "/web/v1/game/endfield/team/",
    "/web/v1/game/endfield/calculate/",
    "/web/v1/game/endfield/search-",
    "/web/v1/game/endfield/enums",
  ];
  const EXCLUDED_PARTS = ["/auth", "attendance", "show-config", "char-sort", "asset-show"];

  // Bodies above this size are dropped rather than stored.
  const MAX_BODY_CHARS = 5_000_000;

  function parseUrl(url, base) {
    try {
      return new URL(String(url), base);
    } catch {
      return null;
    }
  }

  function isTargetUrl(url, base) {
    const parsed = parseUrl(url, base);
    if (!parsed || parsed.protocol !== "https:" || parsed.hostname !== API_HOST) return false;
    const path = parsed.pathname;
    if (EXCLUDED_PARTS.some((part) => path.includes(part))) return false;
    return TARGET_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  function sortedQuery(parsed) {
    const entries = [...parsed.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries);
  }

  // One entry per endpoint and query, so per-operator responses
  // (e.g. card/char?charId=…) are kept side by side and a repeat replaces
  // the older copy.
  function captureKey(url, base) {
    const parsed = parseUrl(url, base);
    if (!parsed) return null;
    const query = new URLSearchParams(Object.entries(sortedQuery(parsed))).toString();
    return parsed.pathname + (query ? "?" + query : "");
  }

  // Builds a stored entry from what the page received. Returns null when the
  // response isn't a capturable JSON body.
  function makeEntry({ url, method, status, bodyText, capturedAt }, base) {
    if (!isTargetUrl(url, base)) return null;
    if (typeof bodyText !== "string" || bodyText.length > MAX_BODY_CHARS) return null;
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return null;
    }
    const parsed = parseUrl(url, base);
    return {
      key: captureKey(url, base),
      path: parsed.pathname,
      query: sortedQuery(parsed),
      method: String(method || "GET").toUpperCase(),
      status: Number(status) || 0,
      capturedAt: String(capturedAt),
      body,
    };
  }

  function addEntry(entries, entry) {
    if (!entry) return entries;
    return { ...entries, [entry.key]: entry };
  }

  function buildExport({ entries, startedAt, savedAt, pageUrl, extensionVersion }) {
    const page = parseUrl(pageUrl);
    const responses = Object.keys(entries)
      .sort()
      .map((key) => {
        const { key: _key, ...rest } = entries[key];
        return rest;
      });
    return {
      format: FORMAT,
      version: FORMAT_VERSION,
      extensionVersion: String(extensionVersion),
      page: page ? page.origin + page.pathname : null,
      startedAt: String(startedAt),
      savedAt: String(savedAt),
      responses,
    };
  }

  function exportFilename(startedAt) {
    const stamp = String(startedAt).replace(/\.\d+Z$/, "Z").replace(/[:]/g, "-");
    return `endfield-capture/skport-${stamp}.json`;
  }

  const api = {
    FORMAT,
    FORMAT_VERSION,
    MAX_BODY_CHARS,
    isTargetUrl,
    captureKey,
    makeEntry,
    addEntry,
    buildExport,
    exportFilename,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.EndfieldCapture = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
