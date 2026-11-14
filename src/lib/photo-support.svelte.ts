import { supportsWebp } from "./photos";

export const photoSupport = $state({ ready: false, supported: false });
let check: Promise<void> | undefined;
export function checkPhotoSupport() {
  return (check ??= supportsWebp().then((supported) => {
    photoSupport.supported = supported;
    photoSupport.ready = true;
  }));
}
