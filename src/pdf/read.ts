import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { ATTACHMENT_NAME } from "./backup";
import { PHOTO_ATTACHMENT, type PhotoAttachment } from "./photos";
import { PHOTO_MAX } from "../lib/photos";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function readBackup(file: File) {
  return (await readBackupBundle(file))?.content ?? null;
}

export async function readBackupBundle(file: File) {
  const task = getDocument({ data: await file.arrayBuffer() });
  try {
    const pdf = await task.promise;
    const files = await pdf.getAttachments();
    const match =
      files &&
      [...files].find(
        ([id, file]) =>
          id === ATTACHMENT_NAME || file.filename === ATTACHMENT_NAME,
      );
    if (!match) return null;
    const [id, file] = match;
    const content = file.content ?? (await pdf.getAttachmentContent(id));
    if (!content) throw new Error("A PDF adatcsatolmánya hiányzik.");
    const images: PhotoAttachment[] = [];
    for (const [key, entry] of files!) {
      const image = PHOTO_ATTACHMENT.exec(entry.filename);
      if (!image) continue;
      const bytes = entry.content ?? (await pdf.getAttachmentContent(key));
      if (!bytes || bytes.length > PHOTO_MAX)
        throw new Error("A mentés egyik képe hiányzik vagy túl nagy.");
      images.push({ id: image[1], bytes });
    }
    return { content, images };
  } finally {
    await task.destroy();
  }
}
