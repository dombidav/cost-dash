import {
  getPhoto,
  photoIds,
  PHOTO_MAX,
  thumbnailFrom,
  type StoredPhoto,
} from "../lib/photos";

export type PhotoAttachment = { id: string; bytes: Uint8Array };
export const BACKUP_MAX = 200 * 1024 * 1024;
export const PHOTO_ATTACHMENT = /^rezsipont-kep-([a-zA-Z0-9-]{1,80})\.webp$/;
export const photoFilename = (id: string) => `rezsipont-kep-${id}.webp`;

export function validatePhotoAttachments(
  data: unknown,
  images: PhotoAttachment[],
) {
  const required = photoIds(data);
  const available = new Map<string, Uint8Array>();
  let total = 0;
  for (const { id, bytes } of images) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || available.has(id))
      throw new Error("A mentés képhivatkozásai hibásak vagy ismétlődnek.");
    if (
      bytes.length < 12 ||
      bytes.length > PHOTO_MAX ||
      String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF" ||
      String.fromCharCode(...bytes.subarray(8, 12)) !== "WEBP"
    )
      throw new Error("A mentés érvénytelen vagy túl nagy képet tartalmaz.");
    total += bytes.length;
    if (total > BACKUP_MAX) throw new Error("A mentés képei túl nagyok.");
    available.set(id, bytes);
  }
  if (required.some((id) => !available.has(id)))
    throw new Error(
      "A mentésből egy vagy több mérési kép hiányzik. Az adatok nem állíthatók vissza hiányosan.",
    );
  return available;
}

export async function collectPhotoAttachments(data: unknown) {
  const images: PhotoAttachment[] = [];
  let total = 0;
  for (const id of photoIds(data)) {
    const image = await getPhoto(id);
    total += image.size;
    if (total > BACKUP_MAX)
      throw new Error(
        "A képek túl nagyok egyetlen PDF-hez. Exportáld az oldalakat külön-külön.",
      );
    images.push({ id, bytes: new Uint8Array(await image.arrayBuffer()) });
  }
  validatePhotoAttachments(data, images);
  return images;
}

// Imported IDs are always replaced so another open page or a failed restore
// cannot overwrite pictures still referenced by the current local data.
export async function preparePhotoRestore<T>(
  data: T,
  images: PhotoAttachment[],
) {
  const available = validatePhotoAttachments(data, images);
  const replacements = new Map<string, string>();
  const photos: StoredPhoto[] = [];
  for (const oldId of photoIds(data)) {
    const id = crypto.randomUUID();
    const image = new Blob([Uint8Array.from(available.get(oldId)!).buffer], {
      type: "image/webp",
    });
    const thumbnail = await thumbnailFrom(image);
    replacements.set(oldId, id);
    photos.push({ id, image, thumbnail, created: Date.now() });
  }
  const next = structuredClone(data);
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    for (const [key, child] of Object.entries(value)) {
      if (key === "photoId")
        (value as Record<string, unknown>)[key] = replacements.get(
          child as string,
        );
      else visit(child);
    }
  }
  visit(next);
  return { data: next, photos };
}
