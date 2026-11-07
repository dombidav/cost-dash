import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { ATTACHMENT_NAME } from "./backup";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function readBackup(file: File) {
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
    return file.content ?? (await pdf.getAttachmentContent(id));
  } finally {
    await task.destroy();
  }
}
