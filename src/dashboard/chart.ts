import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
} from "chart.js";
import { money } from "../lib/format";
import { categories } from "../lib/pages";
import { categoryColorProperty, categoryIds, type MonthReport } from "./data";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
const shortMonth = new Intl.DateTimeFormat("hu-HU", {
  month: "short",
  timeZone: "UTC",
});
const amount = new Intl.NumberFormat("hu-HU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function drawMonthlyChart(
  canvas: HTMLCanvasElement,
  rows: MonthReport[],
) {
  const styles = getComputedStyle(canvas);
  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: rows.map(({ month }) =>
        shortMonth.format(new Date(`${month}-01T00:00:00Z`)),
      ),
      datasets: categoryIds
        .filter((id) => rows.some((row) => row.costs[id].value !== null))
        .map((id) => ({
          label: categories[id].label,
          data: rows.map((row) => row.costs[id].value),
          backgroundColor: styles
            .getPropertyValue(categoryColorProperty(id))
            .trim(),
          borderColor: "#19201d",
          borderWidth: 1,
          borderSkipped: false,
          maxBarThickness: 36,
        })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      color: "#a1aea5",
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: "#a1aea5", maxRotation: 0 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: "#344035" },
          ticks: {
            color: "#a1aea5",
            maxTicksLimit: 5,
            callback: (value) => `${amount.format(Number(value))} Ft`,
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${money(item.parsed.y)}`,
          },
        },
      },
    },
  });
  return () => chart.destroy();
}
