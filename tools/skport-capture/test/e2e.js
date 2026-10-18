// End-to-end check: loads the unpacked extension into Chromium, serves a
// fake SKPORT page and API responses (nothing reaches the real site), and
// checks the saved capture file. Needs Playwright; run with
//   node test/e2e.js [path-to-chromium]
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const EXTENSION = path.resolve(__dirname, "..");
const API = "https://zonai.skport.com";

const PAGE_HTML = `<!doctype html><html><body><script>
  (async () => {
    await fetch("${API}/api/v1/game/endfield/card/detail?serverId=3&roleId=1").then(r => r.json());
    await fetch("${API}/web/v1/auth/refresh").then(r => r.text());
    await new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", "${API}/web/v1/game/endfield/team/user-game-data");
      xhr.onload = resolve;
      xhr.send();
    });
    await new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = "json";
      xhr.open("GET", "${API}/api/v1/game/endfield/card/char?charId=c1");
      xhr.onload = resolve;
      xhr.send();
    });
    document.title = "done";
  })();
</script></body></html>`;

const BODIES = {
  "/api/v1/game/endfield/card/detail": { code: 0, data: { detail: { chars: [{ id: "c1", level: 90 }] } } },
  "/web/v1/auth/refresh": { code: 0, data: { token: "must-not-be-captured" } },
  "/web/v1/game/endfield/team/user-game-data": { code: 0, data: { userGameData: { itemCount: { item_gold: 12345 } } } },
  "/api/v1/game/endfield/card/char": { code: 0, data: { char: { id: "c1", attack: 1.25 } } },
};

async function main() {
  const executablePath = process.argv[2] || undefined;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "skport-capture-e2e-"));

  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: true,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  try {
    await context.route("https://game.skport.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: PAGE_HTML }),
    );
    await context.route(`${API}/**`, (route) => {
      const { pathname } = new URL(route.request().url());
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "https://game.skport.com" },
        body: JSON.stringify(BODIES[pathname] || { code: 404 }),
      });
    });

    const page = await context.newPage();
    await page.goto("https://game.skport.com/tools/endfield/cost-calculator?x=1");
    await page.waitForFunction(() => document.title === "done");

    // relay.js saves 4 s after the last response. Playwright redirects
    // downloads into its own folder, so ask the browser where the file went.
    const [worker] = context.serviceWorkers().length
      ? context.serviceWorkers()
      : [await context.waitForEvent("serviceworker")];
    const deadline = Date.now() + 20000;
    let downloads = [];
    while (Date.now() < deadline) {
      downloads = await worker.evaluate(
        () => new Promise((resolve) => chrome.downloads.search({ state: "complete" }, resolve)),
      );
      if (downloads.length) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.equal(downloads.length, 1, "exactly one capture file was saved");
    const file = downloads[0].filename;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));

    assert.equal(data.format, "endfield-skport-capture");
    assert.equal(data.page, "https://game.skport.com/tools/endfield/cost-calculator");
    assert.deepEqual(
      data.responses.map((r) => r.path),
      [
        "/api/v1/game/endfield/card/char",
        "/api/v1/game/endfield/card/detail",
        "/web/v1/game/endfield/team/user-game-data",
      ],
    );
    assert.deepEqual(data.responses[1].query, { roleId: "1", serverId: "3" });
    assert.deepEqual(data.responses[1].body, BODIES["/api/v1/game/endfield/card/detail"]);
    assert.equal(data.responses[0].body.data.char.attack, 1.25);
    assert.equal(data.responses[2].body.data.userGameData.itemCount.item_gold, 12345);
    assert.ok(!JSON.stringify(data).includes("must-not-be-captured"), "auth responses are not captured");
    console.log("e2e ok:", data.responses.length, "responses captured");
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
