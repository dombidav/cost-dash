import { excludedPlatform } from "./pwa-platform";
import { monitorPwaUpdates } from "./pwa-updates";
import { ui } from "./ui.svelte";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const pwa = $state({
  supported: false,
  offlineReady: false,
  installed: false,
  canInstall: false,
  installing: false,
  updateAvailable: false,
  updating: false,
  updateBlocked: false,
  error: "",
});

let prompt: InstallPrompt | null = null;
let updates: ReturnType<typeof monitorPwaUpdates> | undefined;

export function updateApp() {
  updates?.apply();
}

function requestPersistence() {
  // Best effort: an unavailable/denied persistence grant must not stop the app.
  void navigator.storage?.persist?.().catch(() => {});
}

export function initPwa() {
  if (
    !import.meta.env.PROD ||
    !window.isSecureContext ||
    !("serviceWorker" in navigator) ||
    !("onbeforeinstallprompt" in window) ||
    excludedPlatform(
      navigator.userAgent,
      navigator.platform,
      navigator.maxTouchPoints,
    )
  )
    return;

  pwa.supported = true;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", "#d3bdff");
  const display = matchMedia("(display-mode: standalone)");
  const updateDisplay = () => {
    pwa.installed = display.matches;
    if (pwa.installed) requestPersistence();
  };
  updateDisplay();
  display.addEventListener("change", updateDisplay);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    pwa.canInstall = true;
  });
  window.addEventListener("appinstalled", () => {
    prompt = null;
    pwa.canInstall = false;
    pwa.installed = true;
    requestPersistence();
  });

  // No manifest, service worker or install CTA on Apple devices / Safari.
  // Relative URLs also support deployments below a GitHub Pages project path.
  /* eslint-disable svelte/prefer-svelte-reactivity -- These URLs are immutable installation configuration. */
  const base = new URL(import.meta.env.BASE_URL, location.href);
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = new URL("manifest.webmanifest", base).href;
  const workerUrl = new URL("sw.js", base);
  /* eslint-enable svelte/prefer-svelte-reactivity */
  const checkController = () => {
    pwa.offlineReady =
      navigator.serviceWorker.controller?.scriptURL === workerUrl.href;
    if (pwa.offlineReady) {
      pwa.error = "";
      // The browser's own install UI must also wait for the complete download.
      if (!manifest.isConnected) document.head.append(manifest);
    }
  };
  navigator.serviceWorker.addEventListener("controllerchange", checkController);
  checkController();

  let registering = false;
  let edited = false;
  const recordEdit = () => {
    edited = true;
  };
  document.addEventListener("input", recordEdit);
  document.addEventListener("change", recordEdit);
  const register = async () => {
    if (registering || updates || navigator.onLine === false) return;
    registering = true;
    try {
      const registration = await navigator.serviceWorker.register(workerUrl, {
        scope: base.pathname,
        updateViaCache: "none",
      });
      updates = monitorPwaUpdates(registration, {
        edited,
        available: (value) => {
          pwa.updateAvailable = value;
        },
        applying: (value) => {
          pwa.updating = value;
        },
        blocked: (value) => {
          pwa.updateBlocked = value;
        },
        failed: () => {
          if (!pwa.offlineReady)
            pwa.error =
              "Az offline csomag letöltése nem sikerült. Próbáld újra később.";
        },
        canApply: (manual) =>
          document.hasFocus() &&
          (manual || (!ui.storageError && !ui.undo)) &&
          !document.activeElement?.matches(
            "input, textarea, select, [contenteditable='true']",
          ) &&
          !document.querySelector('[aria-busy="true"], dialog[open]'),
        reload: () => location.reload(),
      });
      document.removeEventListener("input", recordEdit);
      document.removeEventListener("change", recordEdit);
      clearInterval(registrationRetry);
    } catch {
      // Registration/update failures are retried; offline use is not an error.
    } finally {
      registering = false;
    }
  };
  window.addEventListener("online", () => {
    void register();
  });
  window.addEventListener("focus", () => {
    void register();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void register();
  });
  const registrationRetry = setInterval(() => {
    if (document.visibilityState === "visible") void register();
  }, 5 * 60_000);
  void register();
}

export async function installApp() {
  if (!prompt || !pwa.offlineReady || pwa.installing) return;
  const currentPrompt = prompt;
  prompt = null;
  pwa.canInstall = false;
  pwa.installing = true;
  pwa.error = "";
  try {
    await currentPrompt.prompt();
    const choice = await currentPrompt.userChoice;
    if (choice.outcome === "accepted") requestPersistence();
  } catch {
    pwa.error =
      "A telepítés nem indult el. Próbáld a böngésző telepítési menüpontját, vagy töltsd újra az oldalt.";
  } finally {
    pwa.installing = false;
  }
}
