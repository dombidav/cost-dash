import { photoIds, prunePhotos } from "./photos";

const keys = [
  "rezsi-calculator.v1",
  "rezsi-electricity.v1",
  "rezsipont.water.v1",
  "rezsipont.car.v1",
];
let timer: ReturnType<typeof setTimeout> | undefined;

// Allow time for metadata commits and retain removed pictures while undo is available.
export function schedulePhotoCleanup(hasUndo: () => boolean) {
  if (timer) return;
  timer = setTimeout(async () => {
    timer = undefined;
    try {
      if (hasUndo()) {
        schedulePhotoCleanup(hasUndo);
        return;
      }
      const referenced = new Set<string>();
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw !== null)
          photoIds(JSON.parse(raw)).forEach((id) => referenced.add(id));
      }
      await prunePhotos(referenced, Date.now() - 5 * 60_000);
    } catch {
      /* Preserve pictures if any metadata is unreadable or storage is unavailable. */
    }
  }, 5 * 60_000);
}
