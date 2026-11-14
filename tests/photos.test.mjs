import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import "fake-indexeddb/auto";

test("photo storage commits both variants and protects existing data on failure", async (t) => {
  const server = await createServer({
    cacheDir: `tmp/vite-photo-tests-${process.pid}`,
    server: { middlewareMode: true, ws: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => server.close());
  const {
    putPhoto,
    getPhoto,
    deletePhotos,
    commitPhoto,
    photoIds,
    prunePhotos,
    putPhotos,
  } = await server.ssrLoadModule("/src/lib/photos.ts");
  const photo = {
    image: new Blob(["full"], { type: "image/webp" }),
    thumbnail: new Blob(["thumb"], { type: "image/webp" }),
  };
  const id = await putPhoto(photo);
  assert.equal(await (await getPhoto(id)).text(), "full");
  await assert.rejects(
    putPhotos([
      { ...photo, id: "failed-pair", thumbnail: () => {}, created: 1 },
    ]),
  );
  await assert.rejects(getPhoto("failed-pair"), /nem található/);
  assert.equal(await (await getPhoto(id, true)).text(), "thumb");
  let rejectedId;
  await assert.rejects(
    commitPhoto(photo, (nextId) => {
      rejectedId = nextId;
      return false;
    }),
    /mentés sikertelen/,
  );
  await assert.rejects(getPhoto(rejectedId), /nem található/);
  assert.equal(await (await getPhoto(id)).text(), "full");
  assert.deepEqual(
    photoIds({ points: [{ readings: [{ photoId: id }, { photoId: id }] }] }),
    [id],
  );
  assert.throws(() => photoIds({ photoId: "../image.webp" }), /Érvénytelen/);
  await putPhotos([{ ...photo, id: "orphan", created: 1 }]);
  await prunePhotos(new Set([id]), Date.now() + 1);
  await assert.rejects(getPhoto("orphan"), /nem található/);
  await assert.rejects(getPhoto("orphan", true), /nem található/);
  assert.equal(await (await getPhoto(id)).text(), "full");
  await deletePhotos([id]);
  await assert.rejects(getPhoto(id), /nem található/);
  await assert.rejects(getPhoto(id, true), /nem található/);
});

test("WebP capability rejects silent PNG fallback", async (t) => {
  const server = await createServer({
    cacheDir: `tmp/vite-capability-tests-${process.pid}`,
    server: { middlewareMode: true, ws: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => server.close());
  const { canvasBlob, supportsWebp } =
    await server.ssrLoadModule("/src/lib/photos.ts");
  const canvas = {
    toBlob: (callback) => callback(new Blob(["png"], { type: "image/png" })),
  };
  await assert.rejects(canvasBlob(canvas, 0.75), /nem támogatja/);
  // The capability check also handles unavailable DOM/canvas without breaking the app.
  assert.equal(await supportsWebp(), false);
});
