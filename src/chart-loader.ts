type Charts = typeof import('./charts');
let loaded: Promise<Charts> | undefined;
const pending = new Map<HTMLCanvasElement, (charts: Charts) => void>();
const visible = new WeakSet<Element>();
let observer: IntersectionObserver | undefined;

function draw(canvas: HTMLCanvasElement) {
  loaded ??= import('./charts');
  void loaded.then(charts => {
    if (!canvas.isConnected) return;
    pending.get(canvas)?.(charts);
  }).catch(() => {
    canvas.textContent = 'A grafikon nem tölthető be. Az értékeket a naplóban és a kártyákon találod.';
  });
}
export function scheduleChart(canvas: HTMLCanvasElement, render: (charts: Charts) => void) {
  pending.set(canvas, render);
  if (!('IntersectionObserver' in window)) { draw(canvas); return; }
  observer ??= new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      visible.add(entry.target);
      draw(entry.target as HTMLCanvasElement);
    }
  }, { rootMargin: '150px' });
  observer.observe(canvas);
  if (visible.has(canvas)) draw(canvas);
}
export function clearChart(id: string) {
  const canvas = document.getElementById(id) as HTMLCanvasElement | null;
  if (canvas) { pending.delete(canvas); observer?.unobserve(canvas); }
  void loaded?.then(charts => charts.clear(id));
}
