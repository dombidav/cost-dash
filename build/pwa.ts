import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

// Include the entire production output, including lazy chunks, PDF fonts and
// the PDF worker. A page need not have been opened before it works offline.
export function offlineApp(): Plugin {
  let outputDirectory: string;
  return {
    name: "rezsipont-offline",
    apply: "build",
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      async function files(directory: string): Promise<string[]> {
        const entries = await readdir(resolve(outputDirectory, directory), {
          withFileTypes: true,
        });
        const nested = await Promise.all(
          entries.map((entry) => {
            const path = directory + entry.name;
            return entry.isDirectory() ? files(path + "/") : [path];
          }),
        );
        return nested.flat();
      }
      const assets = (await files(""))
        .filter((path) => path !== "sw.js")
        .sort();
      const source = await readFile(
        new URL("./service-worker.js", import.meta.url),
        "utf8",
      );
      const hash = createHash("sha256").update(source);
      for (const path of assets) {
        hash.update(path);
        hash.update(await readFile(resolve(outputDirectory, path)));
      }
      await writeFile(
        resolve(outputDirectory, "sw.js"),
        source
          .replace(
            '"__VERSION__"',
            JSON.stringify(hash.digest("hex").slice(0, 20)),
          )
          .replace('"__ASSETS__"', JSON.stringify(assets)),
      );
    },
  };
}
