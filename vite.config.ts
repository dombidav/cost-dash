import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { offlineApp } from "./build/pwa.ts";

export default defineConfig(({ command }) => ({
  base: "./",
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      command === "build"
        ? execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
            cwd: fileURLToPath(new URL(".", import.meta.url)),
            encoding: "utf8",
          }).trim()
        : "local",
    ),
  },
  plugins: [svelte(), offlineApp()],
  optimizeDeps: { include: ["cropperjs"] },
  build: {
    target: "es2022",
    minify: "terser",
    cssMinify: true,
    sourcemap: false,
    rolldownOptions: {
      input: {
        gas: fileURLToPath(new URL("./index.html", import.meta.url)),
        electricity: fileURLToPath(new URL("./aram.html", import.meta.url)),
        water: fileURLToPath(new URL("./viz.html", import.meta.url)),
        car: fileURLToPath(new URL("./auto.html", import.meta.url)),
        dashboard: fileURLToPath(new URL("./dashboard.html", import.meta.url)),
        subscriptions: fileURLToPath(
          new URL("./havidijak.html", import.meta.url),
        ),
      },
    },
    terserOptions: {
      compress: { passes: 3, drop_console: true },
      mangle: true,
      format: { comments: false },
    },
  },
}));
