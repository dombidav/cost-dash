import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = ts.transpileModule(
  await readFile(new URL("../src/lib/pwa-updates.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

class Target {
  listeners = new Map();
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) {
    this.listeners.get(name)?.delete(callback);
  }
  emit(name, detail = {}) {
    for (const listener of this.listeners.get(name) ?? []) listener(detail);
  }
}

function app({ online = true, controlled = true } = {}) {
  const window = new Target();
  const document = Object.assign(new Target(), { visibilityState: "visible" });
  const serviceWorker = Object.assign(new Target(), {
    controller: controlled ? {} : null,
  });
  const navigator = { onLine: online, serviceWorker };
  let now = 0,
    sequence = 0,
    requests = 0,
    fail = false,
    allowed = true,
    reloads = 0;
  const timers = new Map();
  const timer = (callback, delay, repeat = false) => {
    const id = ++sequence;
    timers.set(id, { callback, delay, repeat, at: now + delay });
    return id;
  };
  const exports = {};
  runInNewContext(source, {
    exports,
    window,
    document,
    navigator,
    Date: { now: () => now },
    setTimeout: (fn, delay) => timer(fn, delay),
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, delay) => timer(fn, delay, true),
    clearInterval: (id) => timers.delete(id),
  });
  const registration = Object.assign(new Target(), {
    waiting: null,
    installing: null,
    update: async () => {
      requests++;
      if (fail) throw new Error("offline");
    },
  });
  const state = {};
  const monitor = exports.monitorPwaUpdates(registration, {
    available: (value) => {
      state.available = value;
    },
    applying: (value) => {
      state.applying = value;
    },
    blocked: (value) => {
      state.blocked = value;
    },
    failed: () => {
      state.failed = true;
    },
    canApply: () => allowed,
    reload: () => {
      reloads++;
    },
  });
  return {
    window,
    document,
    navigator,
    registration,
    monitor,
    state,
    timers,
    get requests() {
      return requests;
    },
    get reloads() {
      return reloads;
    },
    set fail(value) {
      fail = value;
    },
    set allowed(value) {
      allowed = value;
    },
    async tick(ms) {
      now += ms;
      for (const [id, item] of [...timers]) {
        if (!timers.has(id) || item.at > now) continue;
        if (item.repeat) item.at = now + item.delay;
        else timers.delete(id);
        item.callback();
      }
      await new Promise((resolve) => setImmediate(resolve));
    },
    waiting() {
      const messages = [];
      const worker = Object.assign(new Target(), {
        state: "installing",
        postMessage: (data) => messages.push(data.type),
      });
      registration.installing = worker;
      registration.emit("updatefound");
      registration.waiting = worker;
      worker.state = "installed";
      worker.emit("statechange");
      return messages;
    },
  };
}

test("checks on launch, foreground, pageshow, reconnect and every five minutes without request storms", async () => {
  const a = app();
  await a.tick(0);
  assert.equal(a.requests, 1);
  a.window.emit("focus");
  a.window.emit("pageshow");
  a.document.emit("visibilitychange");
  await a.tick(0);
  assert.equal(a.requests, 1);
  await a.tick(60_001);
  a.window.emit("focus");
  await a.tick(0);
  assert.equal(a.requests, 2);
  await a.tick(5 * 60_000);
  assert.equal(a.requests, 3);
  a.document.visibilityState = "hidden";
  await a.tick(5 * 60_000);
  assert.equal(a.requests, 3);
  a.document.visibilityState = "visible";
  a.document.emit("visibilitychange");
  await a.tick(0);
  assert.equal(a.requests, 4);
  a.window.emit("online");
  await a.tick(0);
  assert.equal(a.requests, 5);
  a.monitor.stop();
  assert.equal(a.timers.size, 0);
  a.window.emit("online");
  await a.tick(5 * 60_000);
  assert.equal(a.requests, 5);
});

test("offline startup skips network checks and failed online requests are quiet and retryable", async () => {
  const a = app({ online: false });
  await a.tick(5 * 60_000);
  assert.equal(a.requests, 0);
  a.navigator.onLine = true;
  a.fail = true;
  a.window.emit("online");
  await a.tick(0);
  assert.equal(a.requests, 1);
  assert.equal(a.state.failed, undefined);
  a.fail = false;
  a.window.emit("online");
  await a.tick(0);
  assert.equal(a.requests, 2);
  a.monitor.stop();
});

test("a fully downloaded update activates automatically and controllerchange reloads exactly once", async () => {
  const a = app();
  const messages = a.waiting();
  assert.equal(a.state.available, true);
  await a.tick(2_000);
  assert.deepEqual(messages, ["ACTIVATE_UPDATE"]);
  assert.equal(a.state.applying, true);
  a.navigator.serviceWorker.controller = {};
  a.navigator.serviceWorker.emit("controllerchange");
  a.navigator.serviceWorker.emit("controllerchange");
  assert.equal(a.reloads, 1);
  a.monitor.stop();
});

test("editing, background state and pending operations postpone automatic activation; manual refresh works", async () => {
  const a = app();
  const messages = a.waiting();
  a.document.emit("input");
  await a.tick(2_000);
  assert.deepEqual(messages, []);
  a.allowed = false;
  a.monitor.apply();
  assert.deepEqual(messages, []);
  a.allowed = true;
  a.document.visibilityState = "hidden";
  a.monitor.apply();
  assert.deepEqual(messages, []);
  a.document.visibilityState = "visible";
  a.monitor.apply();
  assert.deepEqual(messages, ["ACTIVATE_UPDATE"]);
  a.monitor.stop();
});

test("a second app window defers activation, then retries after it is closed", async () => {
  const a = app();
  const messages = a.waiting();
  await a.tick(2_000);
  a.navigator.serviceWorker.emit("message", {
    source: a.registration.waiting,
    data: { type: "UPDATE_DEFERRED" },
  });
  assert.equal(a.state.blocked, true);
  assert.equal(a.state.applying, false);
  await a.tick(2_000);
  assert.equal(messages.length, 1);
  await a.tick(30_000);
  assert.equal(messages.length, 2);
  a.monitor.stop();
});

test("first installation does not reload and an offline download failure does not show an error", async () => {
  const a = app({ online: false, controlled: false });
  a.navigator.serviceWorker.controller = {};
  a.navigator.serviceWorker.emit("controllerchange");
  assert.equal(a.reloads, 0);
  a.waiting();
  a.registration.installing.state = "redundant";
  a.registration.installing.emit("statechange");
  assert.equal(a.state.failed, undefined);
  a.monitor.stop();
});
