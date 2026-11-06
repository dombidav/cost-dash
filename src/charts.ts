import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, BarController, BarElement, Tooltip, Filler } from 'chart.js';
import type { Reading } from './types';

// Register only the chart components we actually use; no date adapter or auto bundle.
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, BarController, BarElement, Tooltip, Filler);
Chart.defaults.color = '#a1aea5';
Chart.defaults.borderColor = '#344035';
Chart.defaults.font.family = 'Inter, Segoe UI, Arial, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.animation = false;
const plots = new Map<string, Chart>();
const volume = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 });
const day = new Intl.DateTimeFormat('hu-HU', { timeZone: 'UTC', month: 'short', day: 'numeric' });

export function clear(id: string) { plots.get(id)?.destroy(); plots.delete(id); }
export function drawConsumption(canvas: HTMLCanvasElement, readings: Reading[]) {
  clear(canvas.id);
  if (!readings.length) return;
  const first = readings[0];
  const chart = new Chart(canvas, {
    type: 'line',
    data: { datasets: [{ data: readings.map(r => ({ x: Date.parse(r.date), y: r.value - first.value })), borderColor: '#b9f592', backgroundColor: '#b9f59212', fill: true, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#b9f592', tension: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false, parsing: false, normalized: true,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: { type: 'linear', min: Date.parse(first.date), max: Date.parse(readings.at(-1)!.date) || undefined, grid: { display: false }, ticks: { maxTicksLimit: 4, callback: value => day.format(new Date(Number(value))) } },
        y: { beginAtZero: true, ticks: { maxTicksLimit: 4, callback: value => `${volume.format(Number(value))} m³` }, grid: { color: '#34403566' } },
      },
      plugins: { tooltip: { callbacks: { title: items => new Date(items[0].parsed.x ?? 0).toISOString().slice(0, 10), label: item => `${volume.format(item.parsed.y ?? 0)} m³ fogyasztás` } } },
    },
  });
  plots.set(canvas.id, chart as Chart);
}
export function drawBenchmark(canvas: HTMLCanvasElement, bars: { label: string; value: number; own: boolean }[]) {
  clear(canvas.id);
  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: bars.map(bar => bar.label), datasets: [{ data: bars.map(bar => bar.value), backgroundColor: bars.map(bar => bar.own ? '#b9f592' : '#577560'), borderRadius: 5, maxBarThickness: 20 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: { x: { beginAtZero: true, grid: { color: '#34403555' }, ticks: { maxTicksLimit: 3, callback: value => `${volume.format(Number(value))} m³` } }, y: { grid: { display: false }, ticks: { font: { size: 10 }, callback: (_, index) => bars[index].own ? 'Saját éves adat' : bars[index].label.split(' · ')[0] } } },
      plugins: { tooltip: { callbacks: { label: item => `${volume.format(Number(item.raw))} m³/év` } } },
    },
  });
  plots.set(canvas.id, chart as Chart);
}
