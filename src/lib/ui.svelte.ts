export const ui = $state({ status: 'Helyi mentés bekapcsolva', storageError: false, message: '', undo: null as (() => void) | null });
let timer: ReturnType<typeof setTimeout>;
export function toast(message: string, undo: (() => void) | null = null) {
  clearTimeout(timer); ui.message = message; ui.undo = undo;
  timer = setTimeout(() => { ui.message = ''; ui.undo = null; }, undo ? 15000 : 4500);
}
