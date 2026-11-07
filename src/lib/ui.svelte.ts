export const ui = $state({
  status: "Helyi mentés bekapcsolva",
  storageError: false,
  message: "",
  undo: null as { message: string; action: () => void; focusId: string } | null,
});
let timer: ReturnType<typeof setTimeout>;
export function toast(message: string, undo?: () => void, focusId = "main") {
  clearTimeout(timer);
  ui.message = message;
  if (undo) ui.undo = { message, action: undo, focusId };
  timer = setTimeout(() => {
    ui.message = "";
  }, 4500);
}
