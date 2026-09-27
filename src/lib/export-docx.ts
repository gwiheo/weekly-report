import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

import type { Plan } from "./plan";
import {
  HEADER_FILL,
  buildTableModel,
  type CellParagraph,
  type TableCellModel,
  type TableModel,
} from "./table";

const FONT = "맑은 고딕";
const BODY_SIZE = 18; // half-points = 9pt
const TITLE_SIZE = 26;

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" } as const;

function cellParagraph(
  paragraph: CellParagraph,
  cell: TableCellModel,
): Paragraph {
  return new Paragraph({
    alignment: cell.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: 0, after: 0, line: 240 },
    indent: paragraph.hanging ? { left: 200, hanging: 160 } : undefined,
    children: [
      new TextRun({
        text: paragraph.text,
        bold: cell.bold,
        font: FONT,
        size: BODY_SIZE,
      }),
    ],
  });
}

function docxCell(cell: TableCellModel, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
    rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
    verticalAlign: cell.kind === "content" ? VerticalAlign.TOP : VerticalAlign.CENTER,
    shading: cell.shaded
      ? { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL }
      : undefined,
    margins: { top: 20, bottom: 20, left: 60, right: 60 },
    children: cell.paragraphs.map((paragraph) => cellParagraph(paragraph, cell)),
  });
}

function docxTable(model: TableModel): Table {
  const rows = model.rows.map((row) => {
    let column = 0;
    const cells = row.cells.map((cell) => {
      const width = model.columnWidths
        .slice(column, column + cell.colSpan)
        .reduce((sum, value) => sum + value, 0);
      column += cell.colSpan;
      return docxCell(cell, width);
    });

    return new TableRow({
      tableHeader: row.header,
      height: { value: row.minHeight, rule: HeightRule.ATLEAST },
      children: cells,
    });
  });

  return new Table({
    columnWidths: model.columnWidths,
    layout: TableLayoutType.FIXED,
    width: {
      size: model.columnWidths.reduce((sum, value) => sum + value, 0),
      type: WidthType.DXA,
    },
    borders: {
      top: THIN_BORDER,
      bottom: THIN_BORDER,
      left: THIN_BORDER,
      right: THIN_BORDER,
      insideHorizontal: THIN_BORDER,
      insideVertical: THIN_BORDER,
    },
    rows,
  });
}

export async function buildDocx(plan: Plan): Promise<Buffer> {
  const model = buildTableModel(plan);

  const children: (Paragraph | Table)[] = [];
  if (model.includeTitle && model.title.trim()) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 160 },
        children: [
          new TextRun({ text: model.title.trim(), bold: true, font: FONT, size: TITLE_SIZE }),
        ],
      }),
    );
  }
  children.push(docxTable(model));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE },
          paragraph: { spacing: { before: 0, after: 0, line: 240 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
