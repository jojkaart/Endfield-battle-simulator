"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const capture = require("../core.js");

const PAGE = "https://game.skport.com/tools/endfield/cost-calculator";
const API = "https://zonai.skport.com";

test("captures read-only player data endpoints", () => {
  for (const path of [
    "/api/v1/game/player/binding",
    "/api/v1/game/endfield/card/detail?roleId=1&serverId=3",
    "/api/v1/game/endfield/card/char?charId=abc",
    "/web/v1/game/endfield/team/user-game-data",
    "/web/v1/game/endfield/calculate/user-game-data",
    "/web/v1/game/endfield/search-chars",
    "/web/v1/game/endfield/enums",
  ]) {
    assert.equal(capture.isTargetUrl(API + path, PAGE), true, path);
  }
});

test("never captures auth, sign-in or settings endpoints", () => {
  for (const path of [
    "/web/v1/auth/refresh",
    "/web/v1/user/auth/generate_cred_by_code",
    "/web/v1/game/endfield/attendance",
    "/api/v1/game/attendance",
    "/api/v1/game/endfield/card/detail/show-config",
    "/api/v1/game/player/show-config",
    "/web/v1/wiki/item/info",
  ]) {
    assert.equal(capture.isTargetUrl(API + path, PAGE), false, path);
  }
});

test("only the global API host over https", () => {
  assert.equal(capture.isTargetUrl("http://zonai.skport.com/api/v1/game/player/binding", PAGE), false);
  assert.equal(capture.isTargetUrl("https://zonai.skport.com.evil.example/api/v1/game/player/binding", PAGE), false);
  assert.equal(capture.isTargetUrl("https://zonai.skland.com/api/v1/game/player/binding", PAGE), false);
  assert.equal(capture.isTargetUrl("/api/v1/game/player/binding", PAGE), false, "relative URL resolves to the page host");
  assert.equal(capture.isTargetUrl("not a url :::", "also not"), false);
});

test("capture key ignores query order but keeps different queries apart", () => {
  const a = capture.captureKey(API + "/api/v1/game/endfield/card/char?serverId=3&charId=x", PAGE);
  const b = capture.captureKey(API + "/api/v1/game/endfield/card/char?charId=x&serverId=3", PAGE);
  const c = capture.captureKey(API + "/api/v1/game/endfield/card/char?charId=y&serverId=3", PAGE);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(capture.captureKey(API + "/web/v1/game/endfield/enums", PAGE), "/web/v1/game/endfield/enums");
});

test("makeEntry keeps the parsed body and drops non-JSON, oversized or untargeted responses", () => {
  const base = { method: "get", status: 200, capturedAt: "2026-10-18T12:00:00.000Z" };
  const entry = capture.makeEntry(
    { ...base, url: API + "/web/v1/game/endfield/enums?b=2&a=1", bodyText: '{"code":0,"data":{"x":1.5}}' },
    PAGE,
  );
  assert.deepEqual(entry, {
    key: "/web/v1/game/endfield/enums?a=1&b=2",
    path: "/web/v1/game/endfield/enums",
    query: { a: "1", b: "2" },
    method: "GET",
    status: 200,
    capturedAt: "2026-10-18T12:00:00.000Z",
    body: { code: 0, data: { x: 1.5 } },
  });
  assert.equal(capture.makeEntry({ ...base, url: API + "/web/v1/game/endfield/enums", bodyText: "<html>" }, PAGE), null);
  assert.equal(capture.makeEntry({ ...base, url: API + "/web/v1/auth/refresh", bodyText: "{}" }, PAGE), null);
  const huge = '"' + "x".repeat(capture.MAX_BODY_CHARS) + '"';
  assert.equal(capture.makeEntry({ ...base, url: API + "/web/v1/game/endfield/enums", bodyText: huge }, PAGE), null);
  assert.equal(capture.makeEntry({ ...base, url: API + "/web/v1/game/endfield/enums", bodyText: undefined }, PAGE), null);
});

test("a repeated response replaces the older copy", () => {
  const url = API + "/api/v1/game/endfield/card/detail";
  const first = capture.makeEntry({ url, method: "GET", status: 200, capturedAt: "t1", bodyText: '{"v":1}' }, PAGE);
  const second = capture.makeEntry({ url, method: "GET", status: 200, capturedAt: "t2", bodyText: '{"v":2}' }, PAGE);
  let entries = capture.addEntry({}, first);
  entries = capture.addEntry(entries, second);
  entries = capture.addEntry(entries, null);
  assert.deepEqual(Object.keys(entries), ["/api/v1/game/endfield/card/detail"]);
  assert.equal(entries["/api/v1/game/endfield/card/detail"].body.v, 2);
});

test("export is sorted by key, strips the page query and omits internal keys", () => {
  const mk = (path, t) => capture.makeEntry({ url: API + path, method: "GET", status: 200, capturedAt: t, bodyText: "{}" }, PAGE);
  let entries = {};
  entries = capture.addEntry(entries, mk("/web/v1/game/endfield/search-chars", "t2"));
  entries = capture.addEntry(entries, mk("/api/v1/game/player/binding", "t1"));
  const data = capture.buildExport({
    entries,
    startedAt: "s",
    savedAt: "v",
    pageUrl: PAGE + "?token=secret#frag",
    extensionVersion: "0.1.0",
  });
  assert.equal(data.format, "endfield-skport-capture");
  assert.equal(data.version, 1);
  assert.equal(data.page, PAGE);
  assert.deepEqual(
    data.responses.map((r) => r.path),
    ["/api/v1/game/player/binding", "/web/v1/game/endfield/search-chars"],
  );
  assert.ok(data.responses.every((r) => !("key" in r)));
});

test("export filename is a safe relative path", () => {
  assert.equal(capture.exportFilename("2026-10-18T12:34:56.789Z"), "endfield-capture/skport-2026-10-18T12-34-56Z.json");
});
