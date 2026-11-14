export const PHOTO_TARGET = 250_000;
export const PHOTO_MAX = 1_000_000;
export const PHOTO_INPUT_MAX = 15 * 1024 * 1024;
export const PHOTO_PIXEL_MAX = 50_000_000;
export type Photo = { image: Blob; thumbnail: Blob };
export type StoredPhoto = Photo & { id: string; created: number };

export function photoIds(value: unknown): string[] {
  const ids = new Set<string>();
  function visit(item: unknown) {
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item)) return item.forEach(visit);
    for (const [key, child] of Object.entries(item)) {
      if (key === "photoId") {
        if (typeof child !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(child))
          throw new Error("Érvénytelen képhivatkozás.");
        ids.add(child);
      } else visit(child);
    }
  }
  visit(value);
  return [...ids];
}

export function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp")
          reject(
            new Error("A böngésző nem támogatja a WebP-képek készítését."),
          );
        else resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

let capability: Promise<boolean> | undefined;
export function supportsWebp() {
  return (capability ??= (async () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      await canvasBlob(canvas, 0.75);
      return true;
    } catch {
      return false;
    }
  })());
}

export async function optimizePhoto(canvas: HTMLCanvasElement): Promise<Photo> {
  let image = await canvasBlob(canvas, 0.78);
  for (const quality of [0.68, 0.58]) {
    if (image.size <= PHOTO_TARGET) break;
    image = await canvasBlob(canvas, quality);
  }
  // Keep the selected detail readable rather than shrinking it indefinitely.
  if (image.size > PHOTO_MAX)
    throw new Error(
      "A kép túl részletes. Vágd szűkebbre a fontos részt, majd próbáld újra.",
    );
  const thumb = document.createElement("canvas");
  const ratio = Math.min(1, 320 / Math.max(canvas.width, canvas.height));
  thumb.width = Math.max(1, Math.round(canvas.width * ratio));
  thumb.height = Math.max(1, Math.round(canvas.height * ratio));
  const context = thumb.getContext("2d");
  if (!context) throw new Error("A kép nem dolgozható fel.");
  context.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  const thumbnail = await canvasBlob(thumb, 0.65);
  thumb.width = thumb.height = 0;
  return { image, thumbnail };
}

export async function thumbnailFrom(image: Blob) {
  const url = URL.createObjectURL(image);
  try {
    const element = new Image();
    element.src = url;
    await element.decode();
    if (element.naturalWidth * element.naturalHeight > PHOTO_PIXEL_MAX)
      throw new Error("Túl nagy képfelbontás.");
    const canvas = document.createElement("canvas");
    const ratio = Math.min(
      1,
      320 / Math.max(element.naturalWidth, element.naturalHeight),
    );
    canvas.width = Math.max(1, Math.round(element.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(element.naturalHeight * ratio));
    canvas
      .getContext("2d")!
      .drawImage(element, 0, 0, canvas.width, canvas.height);
    // Imported WebP can still be viewed on browsers without a WebP encoder.
    const thumbnail = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("A kép sérült."))),
        "image/png",
      ),
    );
    canvas.width = canvas.height = 0;
    return thumbnail;
  } finally {
    URL.revokeObjectURL(url);
  }
}

let connection: Promise<IDBDatabase> | undefined;
export function photoDatabase() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("rezsipont-photos", 1);
    request.onupgradeneeded = () => {
      request.result
        .createObjectStore("images", { keyPath: "id" })
        .createIndex("created", "created");
      request.result.createObjectStore("thumbnails", { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      resolve(db);
    };
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      connection = undefined;
      reject(
        new Error("Zárd be a többi RezsiPont lapot a képtár megnyitásához."),
      );
    };
  }));
}

function complete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("A képek helyi mentése sikertelen."),
      );
  });
}

export async function putPhotos(photos: StoredPhoto[]) {
  if (!photos.length) return;
  const db = await photoDatabase();
  const tx = db.transaction(["images", "thumbnails"], "readwrite");
  const done = complete(tx);
  for (const { id, image, thumbnail, created } of photos) {
    tx.objectStore("images").put({ id, image, created });
    tx.objectStore("thumbnails").put({ id, image: thumbnail });
  }
  await done;
}

export async function putPhoto(photo: Photo) {
  const id = crypto.randomUUID();
  await putPhotos([{ ...photo, id, created: Date.now() }]);
  return id;
}

// Persist the binary data first. A failed metadata save leaves the old link intact.
export async function commitPhoto(
  photo: Photo | null,
  commit: (id?: string) => boolean,
) {
  const id = photo ? await putPhoto(photo) : undefined;
  try {
    if (!commit(id))
      throw new Error(
        "A helyi mentés sikertelen. A kép és a korábbi adatok nem módosultak.",
      );
  } catch (reason) {
    if (id) await deletePhotos([id]);
    throw reason;
  }
}

export async function getPhoto(id: string, thumbnail = false): Promise<Blob> {
  const db = await photoDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(thumbnail ? "thumbnails" : "images")
      .objectStore(thumbnail ? "thumbnails" : "images")
      .get(id);
    request.onsuccess = () =>
      request.result?.image
        ? resolve(request.result.image)
        : reject(new Error("A mérés képe nem található a helyi képtárban."));
    request.onerror = () => reject(request.error);
  });
}

export async function deletePhotos(ids: string[]) {
  if (!ids.length) return;
  const db = await photoDatabase();
  const tx = db.transaction(["images", "thumbnails"], "readwrite");
  const done = complete(tx);
  for (const id of ids) {
    tx.objectStore("images").delete(id);
    tx.objectStore("thumbnails").delete(id);
  }
  await done;
}

export async function prunePhotos(referenced: Set<string>, olderThan: number) {
  if (!connection) return;
  const db = await connection;
  const tx = db.transaction(["images", "thumbnails"], "readwrite");
  const done = complete(tx);
  const request = tx
    .objectStore("images")
    .index("created")
    .openKeyCursor(IDBKeyRange.upperBound(olderThan));
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    if (!referenced.has(String(cursor.primaryKey))) {
      tx.objectStore("images").delete(cursor.primaryKey);
      tx.objectStore("thumbnails").delete(cursor.primaryKey);
    }
    cursor.continue();
  };
  await done;
}
