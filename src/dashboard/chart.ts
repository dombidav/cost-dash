import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  PieController,
  Tooltip,
  type ChartDatasetCustomTypesPerDataset,
} from "chart.js";
import { fmt } from "../lib/format";
import { categories } from "../lib/pages";
import {
  categoryColorProperty,
  categoryIds,
  type MonthReport,
  type summarize,
} from "./data";

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  PieController,
  Tooltip,
);
const shortMonth = new Intl.DateTimeFormat("hu-HU", {
  month: "short",
  timeZone: "UTC",
});
const amount = new Intl.NumberFormat("hu-HU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function drawCategoryChart(
  canvas: HTMLCanvasElement,
  costs: ReturnType<typeof summarize>["costs"],
) {
  const styles = getComputedStyle(canvas);
  const positive = costs.filter((item) => (item.value ?? 0) > 0);
  const values = positive.map((item) => item.value!);
  const total = values.reduce((sum, value) => sum + value, 0);
  const chart = new Chart(canvas, {
    type: "pie",
    data: {
      labels: positive.map((item) => categories[item.id].label),
      datasets: [
        {
          data: values,
          backgroundColor: positive.map((item) =>
            styles.getPropertyValue(categoryColorProperty(item.id)).trim(),
          ),
          borderColor: styles.getPropertyValue("--card").trim() || "#19201d",
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: 8 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) =>
              `${item.label}: ${fmt(item.parsed, 0, 0)} Ft (${fmt((item.parsed / total) * 100, 1)}%)`,
          },
        },
      },
    },
  });
  return () => chart.destroy();
}

export function drawMonthlyChart(
  canvas: HTMLCanvasElement,
  rows: MonthReport[],
  earlier: MonthReport[],
) {
  const styles = getComputedStyle(canvas);
  const referenceColor = styles.getPropertyValue("--text").trim();
  return drawReportChart(
    canvas,
    rows,
    [
      ...categoryIds
        .filter((id) => rows.some((row) => row.costs[id].value !== null))
        .map((id) => ({
          type: "bar" as const,
          order: 1,
          stack: "current",
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
      ...(earlier.length
        ? [
            {
              type: "line" as const,
              label: `${earlier[0].month.slice(0, 4)} · ismert összeg`,
              data: earlier.map((row) => row.total),
              stack: "previous",
              borderColor: referenceColor,
              backgroundColor: referenceColor,
              borderDash: [6, 4],
              borderWidth: 2,
              pointRadius: 3,
              spanGaps: false,
            },
          ]
        : []),
    ],
    "Ft",
    true,
  );
}

export function drawUtilityChart(
  canvas: HTMLCanvasElement,
  rows: { month: string; value: number | null; partial: boolean }[],
  id: keyof typeof categories,
  unit: string,
) {
  const color = getComputedStyle(canvas)
    .getPropertyValue(categoryColorProperty(id))
    .trim();
  return drawReportChart(
    canvas,
    rows,
    [
      {
        type: "bar",
        label: categories[id].label,
        data: rows.map((row) => row.value),
        backgroundColor: rows.map((row) =>
          row.partial ? "transparent" : color,
        ),
        borderColor: color,
        borderWidth: 2,
        borderSkipped: false,
        maxBarThickness: 36,
      },
    ],
    unit,
  );
}

function drawReportChart(
  canvas: HTMLCanvasElement,
  rows: { month: string }[],
  datasets: ChartDatasetCustomTypesPerDataset<
    "bar" | "line",
    (number | null)[]
  >[],
  unit: string,
  stacked = false,
) {
  const chart = new Chart<"bar" | "line", (number | null)[]>(canvas, {
    data: {
      labels: rows.map(({ month }) =>
        shortMonth.format(new Date(`${month}-01T00:00:00Z`)),
      ),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      color: "#a1aea5",
      scales: {
        x: {
          stacked,
          grid: { display: false },
          ticks: { color: "#a1aea5", maxRotation: 0 },
        },
        y: {
          stacked,
          beginAtZero: true,
          grid: { color: "#344035" },
          ticks: {
            color: "#a1aea5",
            maxTicksLimit: 5,
            callback: (value) => `${amount.format(Number(value))} ${unit}`,
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (item) =>
              `${item.dataset.label}: ${fmt(item.parsed.y, unit === "Ft" ? 0 : 2, 0)} ${unit}`,
          },
        },
      },
    },
  });
  return () => chart.destroy();
}
