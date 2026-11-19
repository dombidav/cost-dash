import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { createServer } from "vite";

const template = await readFile(
  new URL("../build/service-worker.js", import.meta.url),
  "utf8",
);

function worker({
  version = "new",
  fail = false,
  stores = new Map(),
  windows,
} = {}) {
  const scope = "https://example.com/cost-dash/";
  const prefix = `rezsipont:${scope}:`;
  const listeners = new Map();
  let claimed = false;
  let skipWaiting = false;
  const storage = {
    async open(key) {
      if (!stores.has(key)) stores.set(key, new Map());
      const entries = stores.get(key);
      return {
        async addAll(requests) {
          if (fail) throw new Error("download failed");
          for (const request of requests) {
            assert.equal(request.cache, "reload");
            entries.set(request.url, new Response(request.url));
          }
        },
        async match(url) {
          return entries.get(url)?.clone();
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(key) {
      return stores.delete(key);
    },
  };
  runInNewContext(
    template
      .replace('"__VERSION__"', JSON.stringify(version))
      .replace(
        '"__ASSETS__"',
        JSON.stringify([
          "index.html",
          "dashboard.html",
          "assets/lazy.js",
          "assets/font.ttf",
        ]),
      ),
    {
      self: {
        registration: { scope },
        clients: {
          matchAll: async () =>
            windows ?? [{ id: "app", url: scope + "dashboard.html" }],
          claim: async () => {
            claimed = true;
          },
        },
        skipWaiting: () => {
          skipWaiting = true;
        },
        addEventListener: (name, callback) => listeners.set(name, callback),
      },
      caches: storage,
      URL,
      Request,
      Response,
    },
  );
  async function dispatch(name, detail = {}) {
    let pending;
    listeners.get(name)({
      ...detail,
      waitUntil: (promise) => {
        pending = promise;
      },
    });
    await pending;
  }
  async function fetchResource(path, method = "GET") {
    let response;
    listeners.get("fetch")({
      request: new Request(new URL(path, scope), { method }),
      respondWith: (promise) => {
        response = promise;
      },
    });
    return response;
  }
  return {
    scope,
    prefix,
    stores,
    dispatch,
    fetchResource,
    get claimed() {
      return claimed;
    },
    get skipWaiting() {
      return skipWaiting;
    },
  };
}

test("complete offline cache serves unvisited chunks, fonts, root and query URLs under a project path", async () => {
  const sw = worker();
  await sw.dispatch("install");
  assert.equal(sw.claimed, false);
  assert.equal(sw.skipWaiting, false);
  await sw.dispatch("activate");
  assert.equal(sw.claimed, true);
  for (const path of [
    "dashboard.html?source=app",
    "assets/lazy.js",
    "assets/font.ttf",
    "./",
  ]) {
    const response = await sw.fetchResource(path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /https:\/\/example.com\/cost-dash\//);
  }
  assert.equal(await sw.fetchResource("missing.html"), undefined);
  assert.equal(
    await sw.fetchResource("https://other.example/dashboard.html"),
    undefined,
  );
  assert.equal(await sw.fetchResource("../dashboard.html"), undefined);
  assert.equal(await sw.fetchResource("dashboard.html", "POST"), undefined);
});

test("a complete update can activate in one app window without touching unrelated apps", async () => {
  const scope = "https://example.com/cost-dash/";
  const sw = worker({
    windows: [
      { id: "app", url: scope + "dashboard.html" },
      { id: "other", url: "https://example.com/other-app/" },
    ],
  });
  await sw.dispatch("install");
  assert.equal(sw.skipWaiting, false);
  await sw.dispatch("message", {
    data: { type: "ACTIVATE_UPDATE" },
    source: { id: "app" },
  });
  assert.equal(sw.skipWaiting, true);
});

test("updates defer activation while another app window may have edits or old lazy chunks", async () => {
  const scope = "https://example.com/cost-dash/";
  const windows = [
    { id: "app", url: scope },
    { id: "second", url: scope + "viz.html" },
  ];
  const sw = worker({ windows });
  const messages = [];
  const source = {
    id: "app",
    postMessage: (message) => messages.push(message.type),
  };
  await sw.dispatch("install");
  await sw.dispatch("message", { data: { type: "ACTIVATE_UPDATE" }, source });
  assert.equal(sw.skipWaiting, false);
  assert.deepEqual(messages, ["UPDATE_DEFERRED"]);
  windows.pop();
  await sw.dispatch("message", { data: { type: "ACTIVATE_UPDATE" }, source });
  assert.equal(sw.skipWaiting, true);
  const foreign = worker();
  await foreign.dispatch("message", {
    data: { type: "ACTIVATE_UPDATE" },
    source: { id: "foreign", postMessage: () => {} },
  });
  assert.equal(foreign.skipWaiting, false);
});

test("failed offline download preserves the old cache and never activates a partial app", async () => {
  const oldCache = "rezsipont:https://example.com/cost-dash/:old";
  const sw = worker({ fail: true, stores: new Map([[oldCache, new Map()]]) });
  await assert.rejects(sw.dispatch("install"), /download failed/);
  assert.deepEqual([...sw.stores.keys()], [oldCache]);
  assert.equal(sw.claimed, false);
  assert.equal(sw.skipWaiting, false);
});

test("updates retain the running version until activation and only remove this app's obsolete cache", async () => {
  const sw = worker();
  const old = sw.prefix + "old";
  const unrelated = "rezsipont:https://example.com/other-app/:old";
  sw.stores.set(old, new Map());
  sw.stores.set(unrelated, new Map());
  await sw.dispatch("install");
  assert.equal(sw.stores.has(old), true);
  assert.equal(sw.skipWaiting, false);
  await sw.dispatch("activate");
  assert.equal(sw.stores.has(old), false);
  assert.equal(sw.stores.has(unrelated), true);
  assert.equal(sw.stores.has(sw.prefix + "new"), true);
});

test("platform exclusions cover iOS, iPad desktop mode, Mac Chrome/Edge and Safari", async (t) => {
  const server = await createServer({
    cacheDir: `tmp/vite-pwa-tests-${process.pid}`,
    server: { middlewareMode: true, ws: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => server.close());
  const { excludedPlatform } = await server.ssrLoadModule(
    "/src/lib/pwa-platform.ts",
  );
  for (const [ua, platform, touch] of [
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/140 Safari/604.1",
      "iPhone",
      5,
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18 Safari/605.1",
      "MacIntel",
      5,
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Chrome/140 Safari/537.36",
      "MacIntel",
      0,
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Chrome/140 Edg/140 Safari/537.36",
      "MacIntel",
      0,
    ],
    ["Version/18.0 Safari/605.1", "", 0],
  ])
    assert.equal(excludedPlatform(ua, platform, touch), true);
  assert.equal(
    excludedPlatform(
      "Mozilla/5.0 (Windows NT 10.0) Chrome/140 Safari/537.36 Edg/140",
      "Win32",
      0,
    ),
    false,
  );
  assert.equal(
    excludedPlatform(
      "Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile Safari/537.36",
      "Linux armv8l",
      5,
    ),
    false,
  );

  const { offlineApp } = await server.ssrLoadModule("/build/pwa.ts");
  const directory = await mkdtemp(resolve("tmp/pwa-output-"));
  t.after(() => {
    assert.equal(dirname(directory), resolve("tmp"));
    return rm(directory, { recursive: true, force: true });
  });
  await mkdir(resolve(directory, "assets"));
  await writeFile(resolve(directory, "index.html"), "app");
  await writeFile(resolve(directory, "assets/lazy.js"), "lazy");
  await writeFile(resolve(directory, "assets/font.ttf"), "font");
  const plugin = offlineApp();
  plugin.configResolved({ root: directory, build: { outDir: "." } });
  await plugin.closeBundle();
  const output = await readFile(resolve(directory, "sw.js"), "utf8");
  assert.ok(output.includes('"assets/lazy.js"'));
  assert.ok(output.includes('"assets/font.ttf"'));
  assert.ok(output.includes('"index.html"'));
  assert.ok(!output.includes("__VERSION__"));
  await plugin.closeBundle();
  assert.equal(await readFile(resolve(directory, "sw.js"), "utf8"), output);
  await writeFile(resolve(directory, "assets/font.ttf"), "new font");
  await plugin.closeBundle();
  assert.notEqual(await readFile(resolve(directory, "sw.js"), "utf8"), output);
});

test("install identity uses dashboard colours, correctly sized PNG icons and a scoped start URL", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../public/manifest.webmanifest", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.start_url, "./dashboard.html");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.theme_color, "#d3bdff");
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) {
    const png = await readFile(
      new URL(`../public/${icon.src}`, import.meta.url),
    );
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
