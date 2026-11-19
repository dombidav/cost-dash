const CHECK_INTERVAL = 5 * 60_000;
const CHECK_THROTTLE = 60_000;
const APPLY_INTERVAL = 2_000;

export function monitorPwaUpdates(
  registration: ServiceWorkerRegistration,
  options: {
    available: (value: boolean) => void;
    applying: (value: boolean) => void;
    blocked: (value: boolean) => void;
    failed: () => void;
    canApply: (manual: boolean) => boolean;
    reload: () => void;
    edited?: boolean;
  },
) {
  let stopped = false;
  let checking = false;
  let applying = false;
  let edited = options.edited ?? false;
  let reloaded = false;
  let controller = navigator.serviceWorker.controller;
  let lastCheck = -Infinity;
  let nextApply = 0;
  let activationTimeout: ReturnType<typeof setTimeout> | undefined;
  const workers = new Map<ServiceWorker, () => void>();

  function sync() {
    options.available(!!registration.waiting);
  }

  async function check(force = false) {
    if (
      stopped ||
      checking ||
      navigator.onLine === false ||
      document.visibilityState !== "visible" ||
      (!force && Date.now() - lastCheck < CHECK_THROTTLE)
    )
      return;
    checking = true;
    lastCheck = Date.now();
    try {
      await registration.update();
      if (!stopped) sync();
    } catch {
      // Offline, flaky connections and unavailable deployments leave the app usable.
    } finally {
      checking = false;
    }
  }

  function finishApplying() {
    applying = false;
    options.applying(false);
    clearTimeout(activationTimeout);
  }

  function apply(manual = false) {
    if (
      stopped ||
      applying ||
      !registration.waiting ||
      document.visibilityState !== "visible" ||
      !options.canApply(manual) ||
      (!manual && (edited || Date.now() < nextApply))
    )
      return;
    applying = true;
    options.applying(true);
    options.blocked(false);
    try {
      registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
      activationTimeout = setTimeout(finishApplying, 10_000);
    } catch {
      finishApplying();
    }
  }

  function watchInstall() {
    const worker = registration.installing;
    if (!worker || workers.has(worker)) return;
    const changed = () => {
      if (stopped) return;
      sync();
      if (worker.state === "redundant" && navigator.onLine !== false)
        options.failed();
    };
    worker.addEventListener("statechange", changed);
    workers.set(worker, changed);
  }

  function controllerChanged() {
    const previous = controller;
    controller = navigator.serviceWorker.controller;
    if (previous && controller && previous !== controller && !reloaded) {
      reloaded = true;
      finishApplying();
      options.reload();
    }
  }
  const activity = () => {
    edited = true;
  };
  const foreground = () => {
    void check();
  };
  const online = () => {
    void check(true);
  };
  const message = (event: MessageEvent) => {
    if (
      event.source === registration.waiting &&
      event.data?.type === "UPDATE_DEFERRED"
    ) {
      finishApplying();
      options.blocked(true);
      nextApply = Date.now() + 30_000;
    }
  };

  registration.addEventListener("updatefound", watchInstall);
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    controllerChanged,
  );
  navigator.serviceWorker.addEventListener("message", message);
  window.addEventListener("online", online);
  window.addEventListener("focus", foreground);
  window.addEventListener("pageshow", foreground);
  document.addEventListener("visibilitychange", foreground);
  document.addEventListener("input", activity);
  document.addEventListener("change", activity);
  const checkingTimer = setInterval(foreground, CHECK_INTERVAL);
  const applyingTimer = setInterval(() => apply(), APPLY_INTERVAL);
  sync();
  watchInstall();
  void check(true);

  return {
    apply: () => apply(true),
    stop() {
      stopped = true;
      clearInterval(checkingTimer);
      clearInterval(applyingTimer);
      clearTimeout(activationTimeout);
      registration.removeEventListener("updatefound", watchInstall);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controllerChanged,
      );
      navigator.serviceWorker.removeEventListener("message", message);
      window.removeEventListener("online", online);
      window.removeEventListener("focus", foreground);
      window.removeEventListener("pageshow", foreground);
      document.removeEventListener("visibilitychange", foreground);
      document.removeEventListener("input", activity);
      document.removeEventListener("change", activity);
      for (const [worker, listener] of workers)
        worker.removeEventListener("statechange", listener);
    },
  };
}
