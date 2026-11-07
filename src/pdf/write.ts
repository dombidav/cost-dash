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
  const accent =
    category === "gas" ? rgb(0.12, 0.34, 0.2) : rgb(0.13, 0.32, 0.56);
  const title = report.period
    ? "Fogyasztás és statisztikák"
    : "Fogyasztási napló";
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
    text(title, margin, height - 73, 23, bold);
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
        `Kedvezményes év: ${report.period}`,
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
  function line(value: string, size: number, font: PDFFont, color = ink) {
    const safe = printable(value);
    let end = safe.length;
    while (
      end > 0 &&
      font.widthOfTextAtSize(
        safe.slice(0, end) + (end < safe.length ? "…" : ""),
        size,
      ) > bodyWidth
    )
      end--;
    text(
      safe.slice(0, end) + (end < safe.length ? "…" : ""),
      margin,
      y,
      size,
      font,
      color,
    );
    y -= size + 7;
  }
  function statistics(stats: ReportStatistics) {
    for (const [label, value] of stats.rows) {
      const safeLabel = printable(label),
        safeValue = printable(value);
      text(safeLabel, margin + 8, y, 10);
      text(
        safeValue,
        width - margin - 8 - bold.widthOfTextAtSize(safeValue, 10),
        y,
        10,
        bold,
      );
      y -= 19;
    }
    if (stats.note) line(stats.note, 9, regular, secondary);
    y -= 6;
  }

  heading();
  if (report.summary) {
    line("Összes mérési pont", 14, bold, accent);
    statistics(report.summary);
  }
  for (const meter of report.meters) {
    ensureSpace(
      85 + (meter.statistics ? meter.statistics.rows.length * 19 + 34 : 0),
    );
    line(meter.name, 14, bold, accent);
    if (meter.tariff) line(meter.tariff, 10, regular, secondary);
    if (meter.statistics) statistics(meter.statistics);
    if (report.period) line("Fogyasztási napló", 11, bold);
    if (!meter.readings.length) {
      line("Még nincs rögzített mérőállás.", 10, regular, secondary);
      y -= 16;
      continue;
    }

    const columnWidth = bodyWidth / meter.columns.length;
    const row = (cells: string[], font: PDFFont) => {
      cells.forEach((cell, i) => {
        const right = margin + (i + 1) * columnWidth - 8;
        text(
          cell,
          i ? right - font.widthOfTextAtSize(cell, 9) : margin + 8,
          y,
          9,
          font,
        );
      });
      y -= 21;
    };
    const tableHeader = () => {
      page.drawRectangle({
        x: margin,
        y: y - 7,
        width: bodyWidth,
        height: 22,
        color: divider,
      });
      row(meter.columns, bold);
    };
    tableHeader();
    for (const reading of meter.readings) {
      if (ensureSpace(23)) {
        line(meter.name, 12, bold, accent);
        tableHeader();
      }
      row(reading.map(printable), regular);
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
