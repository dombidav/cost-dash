import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  base: "./",
  plugins: [svelte()],
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
      },
    },
    terserOptions: {
      compress: { passes: 3, drop_console: true },
      mangle: true,
      format: { comments: false },
    },
  },
});
