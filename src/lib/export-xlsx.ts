import ExcelJS from "exceljs";

import type { Plan } from "./plan";
import {
  BODY_FONT_PT,
  HEADER_FILL,
  SIDE_MARGIN_TWIPS,
  TITLE_GAP_TWIPS,
  TOP_MARGIN_TWIPS,
  buildTableModel,
} from "./table";

const TWIPS_PER_CHAR = 105;
const TWIPS_PER_INCH = 1440;
const TWIPS_PER_POINT = 20;
/** 인쇄할 때의 좌우 여백 3cm */
const SIDE_MARGIN_INCHES = SIDE_MARGIN_TWIPS / TWIPS_PER_INCH;
/** 인쇄할 때의 위쪽 여백 3cm */
const TOP_MARGIN_INCHES = TOP_MARGIN_TWIPS / TWIPS_PER_INCH;
/** 제목과 표 사이를 2cm 로 띄우는 빈 행의 높이(pt) */
const TITLE_GAP_POINTS = TITLE_GAP_TWIPS / TWIPS_PER_POINT;

export async function buildXlsx(plan: Plan): Promise<Buffer> {
  const model = buildTableModel(plan);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "주간 연구계획 마인드맵";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("주간계획", {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: SIDE_MARGIN_INCHES,
        right: SIDE_MARGIN_INCHES,
        top: TOP_MARGIN_INCHES,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
    views: [{ state: "frozen", ySplit: model.includeTitle && model.title.trim() ? 3 : 2 }],
  });

  sheet.columns = model.columnWidths.map((twips) => ({
    width: Math.round((twips / TWIPS_PER_CHAR) * 10) / 10,
  }));

  const columnCount = model.columnWidths.length;
  let rowIndex = 1;

  if (model.includeTitle && model.title.trim()) {
    sheet.mergeCells(1, 1, 1, columnCount);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = model.title.trim();
    titleCell.font = { name: "맑은 고딕", size: 14, bold: true };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 24;
    sheet.getRow(2).height = TITLE_GAP_POINTS;
    rowIndex = 3;
  }

  const occupied = new Set<string>();

  for (const row of model.rows) {
    const sheetRow = sheet.getRow(rowIndex);
    sheetRow.height = Math.max(18, Math.round(row.minHeight / 20));

    let column = 1;
    for (const cell of row.cells) {
      while (occupied.has(`${rowIndex},${column}`)) column += 1;

      const lastRow = rowIndex + cell.rowSpan - 1;
      const lastColumn = column + cell.colSpan - 1;
      if (cell.rowSpan > 1 || cell.colSpan > 1) {
        sheet.mergeCells(rowIndex, column, lastRow, lastColumn);
        for (let r = rowIndex; r <= lastRow; r += 1) {
          for (let c = column; c <= lastColumn; c += 1) {
            occupied.add(`${r},${c}`);
          }
        }
      }

      const target = sheet.getCell(rowIndex, column);
      target.value = cell.paragraphs.map((paragraph) => paragraph.text).join("\n");
      target.font = { name: "맑은 고딕", size: BODY_FONT_PT, bold: cell.bold };
      target.alignment = {
        horizontal: cell.align,
        vertical: cell.kind === "content" ? "top" : "middle",
        wrapText: true,
      };
      target.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (cell.shaded) {
        target.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${HEADER_FILL}` },
        };
      }

      column += cell.colSpan;
    }

    // 세로 병합에 가려진 칸에도 테두리를 넣어 표가 끊겨 보이지 않게 한다.
    for (let c = 1; c <= columnCount; c += 1) {
      const target = sheet.getCell(rowIndex, c);
      if (!target.border) {
        target.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    }

    rowIndex += 1;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
