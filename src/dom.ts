export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Hiányzó felületi elem: ${id}`);
  return value as T;
}
export function control(id: string): HTMLInputElement | HTMLSelectElement {
  const value = element(id);
  if (!(value instanceof HTMLInputElement || value instanceof HTMLSelectElement)) throw new Error(`Hiányzó beviteli mező: ${id}`);
  return value;
}
