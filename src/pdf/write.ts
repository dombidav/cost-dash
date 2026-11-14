import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PageSizes, rgb, type PDFFont } from "pdf-lib";
import regularUrl from "../assets/pdf/NotoSans-Regular.ttf?url";
import boldUrl from "../assets/pdf/NotoSans-Bold.ttf?url";
import { ATTACHMENT_NAME, type Category } from "./backup";
import type { Report, ReportStatistics } from "./report";

async function fontBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("A PDF betűtípusa nem tölthető be.");
  return response.arrayBuffer();
}

export async function writeReport(
  report: Report,
  category: Category,
  date: string,
  attachment: Uint8Array,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    fontBytes(regularUrl),
    fontBytes(boldUrl),
  ]);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  const supported = new Set(regular.getCharacterSet());
  const [width, height] = PageSizes.A4;
  const margin = 44;
  const bodyWidth = width - 2 * margin;
  const ink = rgb(0.1, 0.15, 0.19);
  const secondary = rgb(0.29, 0.35, 0.4);
  const divider = rgb(0.88, 0.91, 0.93);
  const accents = {
    gas: rgb(0.12, 0.34, 0.2),
    electricity: rgb(0.13, 0.32, 0.56),
    water: rgb(0.05, 0.36, 0.45),
    car: rgb(0.55, 0.27, 0.1),
    subscriptions: rgb(0.4, 0.25, 0.55),
    dashboard: rgb(0.13, 0.32, 0.4),
  };
  const accent = accents[category];
  const title =
    report.title ??
    (report.period ? "Fogyasztás és statisztikák" : "Fogyasztási napló");
  pdf.setTitle(`RezsiPont | ${report.category} | ${title}`);
  pdf.setCreator("RezsiPont");
  pdf.setLanguage("hu-HU");
  await pdf.attach(attachment, ATTACHMENT_NAME, {
    mimeType: "application/json",
    description: "RezsiPont mentés visszaállításhoz",
  });

  let page = pdf.addPage(PageSizes.A4);
  let y = 0;
  function printable(text: string) {
    return [...text.normalize("NFC").replace(/\s+/g, " ")]
      .map((char) => (supported.has(char.codePointAt(0)!) ? char : "?"))
      .join("");
  }
  function text(
    value: string,
    x: number,
    baseline: number,
    size = 10,
    font = regular,
    color = ink,
  ) {
    page.drawText(value, { x, y: baseline, size, font, color });
  }
  function rule(baseline: number) {
    page.drawLine({
      start: { x: margin, y: baseline },
      end: { x: width - margin, y: baseline },
      color: divider,
      thickness: 0.6,
    });
  }
  function heading() {
    page.drawRectangle({
      x: 0,
      y: height - 5,
      width,
      height: 5,
      color: accent,
    });
    text("RezsiPont", margin, height - 43, 11, bold, accent);
    text(printable(title), margin, height - 73, 23, bold);
    text(
      `${report.category}  |  Készült: ${date}`,
      margin,
      height - 95,
      10,
      regular,
      secondary,
    );
    if (report.period) {
      text(
        printable(
          `${report.periodLabel ?? "Kedvezményes év"}: ${report.period}`,
        ),
        margin,
        height - 112,
        10,
        regular,
        secondary,
      );
    }
    y = height - (report.period ? 134 : 117);
    rule(y);
    y -= 25;
  }
  function ensureSpace(required: number) {
    if (y - required >= 51) return false;
    page = pdf.addPage(PageSizes.A4);
    heading();
    return true;
  }
  function wrap(value: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    let current = "";
    for (const word of printable(value).split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = "";
      for (const char of word) {
        if (current && font.widthOfTextAtSize(current + char, size) > width) {
          lines.push(current);
          current = "";
        }
        current += char;
      }
    }
    lines.push(current);
    return lines;
  }
  function line(value: string, size: number, font: PDFFont, color = ink) {
    for (const part of wrap(value, font, size, bodyWidth)) {
      ensureSpace(size + 7);
      text(part, margin, y, size, font, color);
      y -= size + 7;
    }
  }
  function statistics(stats: ReportStatistics) {
    for (const [label, value] of stats.rows) {
      const labels = wrap(label, regular, 10, bodyWidth * 0.6 - 16);
      const values = wrap(value, bold, 10, bodyWidth * 0.4 - 16);
      const rowHeight = Math.max(labels.length, values.length) * 14 + 5;
      ensureSpace(rowHeight);
      labels.forEach((part, index) =>
        text(part, margin + 8, y - index * 14, 10),
      );
      values.forEach((part, index) =>
        text(
          part,
          width - margin - 8 - bold.widthOfTextAtSize(part, 10),
          y - index * 14,
          10,
          bold,
        ),
      );
      y -= rowHeight;
    }
    if (stats.note) line(stats.note, 9, regular, secondary);
    y -= 6;
  }

  heading();
  if (report.note) {
    line(report.note, 9, regular, secondary);
    y -= 10;
  }
  if (report.summary) {
    line(report.summaryTitle ?? "Összes mérési pont", 14, bold, accent);
    statistics(report.summary);
  }
  for (const meter of report.meters) {
    ensureSpace(
      85 + (meter.statistics ? meter.statistics.rows.length * 19 + 34 : 0),
    );
    line(meter.name, 14, bold, accent);
    if (meter.tariff) line(meter.tariff, 10, regular, secondary);
    if (meter.statistics) statistics(meter.statistics);
    if (meter.tableTitle) line(meter.tableTitle, 11, bold);
    if (!meter.readings.length) {
      line(
        meter.emptyMessage ?? "Még nincs rögzített mérőállás.",
        10,
        regular,
        secondary,
      );
      y -= 16;
      continue;
    }

    const weights = meter.columnWeights ?? meter.columns.map(() => 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map((weight) => (bodyWidth * weight) / totalWeight);
    const size = 9;
    const cellsFor = (cells: string[], font: PDFFont) =>
      cells.map((cell, i) => wrap(cell, font, size, widths[i] - 16));
    const rowHeight = (cells: string[][]) =>
      Math.max(...cells.map((parts) => parts.length)) * 13 + 8;
    const row = (cells: string[][], font: PDFFont) => {
      let left = margin;
      cells.forEach((parts, i) => {
        const rightAligned =
          (meter.alignments?.[i] ?? (i ? "right" : "left")) === "right";
        parts.forEach((part, index) =>
          text(
            part,
            rightAligned
              ? left + widths[i] - 8 - font.widthOfTextAtSize(part, size)
              : left + 8,
            y - index * 13,
            size,
            font,
          ),
        );
        left += widths[i];
      });
      y -= rowHeight(cells);
    };
    const header = cellsFor(meter.columns, bold);
    const headerHeight = rowHeight(header);
    const tableHeader = () => {
      page.drawRectangle({
        x: margin,
        y: y - headerHeight + 14,
        width: bodyWidth,
        height: headerHeight,
        color: divider,
      });
      row(header, bold);
    };
    ensureSpace(headerHeight + rowHeight(cellsFor(meter.readings[0], regular)));
    tableHeader();
    for (const reading of meter.readings) {
      const cells = cellsFor(reading, regular);
      if (y - rowHeight(cells) < 51) {
        ensureSpace(rowHeight(cells) + headerHeight + 30);
        line(meter.name, 12, bold, accent);
        tableHeader();
      }
      row(cells, regular);
      rule(y + 13);
    }
    y -= 14;
  }

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    page = current;
    rule(43);
    text(
      "A visszaállítható adatok a PDF csatolmányában találhatók.",
      margin,
      28,
      8,
      regular,
      secondary,
    );
    const counter = `${index + 1} / ${pages.length}`;
    text(
      counter,
      width - margin - regular.widthOfTextAtSize(counter, 8),
      28,
      8,
      regular,
      secondary,
    );
  });
  return pdf.save();
}
