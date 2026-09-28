import PptxGenJS from "pptxgenjs";

import type { Plan } from "./plan";
import {
  BODY_FONT_PT,
  HEADER_FILL,
  SIDE_MARGIN_TWIPS,
  TITLE_GAP_TWIPS,
  buildTableModel,
  textWidthEm,
  type TableCellModel,
  type TableModel,
  type TableRowModel,
} from "./table";

const FONT = "맑은 고딕";

const POINTS_PER_INCH = 72;
const TWIPS_PER_INCH = 1440;

/** LAYOUT_WIDE 기준 슬라이드 크기(인치) */
const SLIDE_WIDTH = 13.333;
const SLIDE_HEIGHT = 7.5;
/** 표 좌우 여백 3cm */
const SIDE_MARGIN = SIDE_MARGIN_TWIPS / TWIPS_PER_INCH;
/**
 * 파워포인트는 제목을 글상자로 넣기 때문에, 글상자가 차지하는 한 줄 높이만큼
 * 위 여백과 제목 간격을 나눠 가진다. 이 값을 위 여백에 더하고 간격에서 빼면
 * 파워포인트에서 잰 값이 아래 주석의 수치와 맞는다.
 */
const TITLE_LINE_TWIPS = 567;
/** 파워포인트 기준 제목 위 여백 2cm. docx·xlsx 의 위 여백과는 따로 둔다. */
const TOP_MARGIN_TWIPS = 1134;
const TOP_MARGIN = (TOP_MARGIN_TWIPS + TITLE_LINE_TWIPS) / TWIPS_PER_INCH;
const BOTTOM_MARGIN = 0.3;

const TITLE_FONT_SIZE = 18;
/** 제목 글상자 높이 */
const TITLE_BOX_HEIGHT = 0.4;
/** 제목과 표 사이 간격 2cm (글상자 한 줄 높이를 뺀 값) */
const TITLE_GAP = (TITLE_GAP_TWIPS - TITLE_LINE_TWIPS) / TWIPS_PER_INCH;
/** 제목이 있을 때 표가 시작하기까지 쓰는 높이 */
const TITLE_BLOCK_HEIGHT = TITLE_BOX_HEIGHT + TITLE_GAP;
/** 표 안의 글자는 머리글과 본문 모두 같은 크기로 쓴다. */
const BASE_FONT_SIZE = BODY_FONT_PT;
/** 한 주제 블록이 슬라이드보다 높을 때만 여기까지 줄인다. */
const MIN_FONT_SIZE = 7;
/** 내용이 적을 때 표를 세로로 늘리는 한도 */
const MAX_STRETCH = 1.5;

const LINE_HEIGHT_RATIO = 1.3;
const CELL_PADDING = 0.06;
const HEADER_ROW_COUNT = 2;
/** 페이지 나눔 판단에만 쓰는 여유. 뷰어별 글자 폭 차이를 흡수한다. */
const BUDGET_SAFETY = 1.12;

const BORDER = { type: "solid" as const, color: "000000", pt: 0.5 };

type Cell = { text: string; options: Record<string, unknown> };

/** 한 행의 렌더링 높이와, 페이지 나눔에 쓸 여유를 더한 높이 */
type SizedRow = { row: TableRowModel; height: number; budget: number };

/**
 * 세로 병합된 주제 블록은 쪼개면 표가 깨지므로, 함께 움직여야 하는 행들을
 * 한 덩어리로 묶는다. 여백 행은 혼자서 한 덩어리가 된다.
 */
type Block = { rows: SizedRow[]; budget: number };

function tableWidth(): number {
  return SLIDE_WIDTH - SIDE_MARGIN * 2;
}

/** twips 기준 열 너비를 슬라이드 폭에 맞춰 인치로 환산한다. */
function columnInches(model: TableModel): number[] {
  const totalTwips = model.columnWidths.reduce((sum, value) => sum + value, 0);
  const scale = tableWidth() / (totalTwips / TWIPS_PER_INCH);
  return model.columnWidths.map((twips) => (twips / TWIPS_PER_INCH) * scale);
}

/**
 * 칸마다 줄바꿈된 줄 수를 세어 행 높이를 인치로 추정한다. pptxgenjs 의 rowH 는
 * 최소 높이여서, 실제 필요한 높이보다 작게 주면 뷰어가 행을 늘려 표가 슬라이드를
 * 넘어간다.
 */
function estimateRowHeight(
  row: TableRowModel,
  columns: number[],
  fontSize: number,
): number {
  let tallest = 0;
  let column = 0;

  for (const cell of row.cells) {
    const width = columns
      .slice(column, column + cell.colSpan)
      .reduce((sum, value) => sum + value, 0);
    column += cell.colSpan;

    const usableEm = Math.max(6, ((width - 0.12) * POINTS_PER_INCH) / fontSize);
    let lines = 0;
    for (const paragraph of cell.paragraphs) {
      lines += Math.max(1, Math.ceil(textWidthEm(paragraph.text) / usableEm));
    }

    const needed = (lines * fontSize * LINE_HEIGHT_RATIO) / POINTS_PER_INCH + CELL_PADDING;
    // 세로 병합된 칸은 여러 행이 나눠 부담한다.
    tallest = Math.max(tallest, cell.rowSpan > 1 ? needed / cell.rowSpan : needed);
  }

  return tallest;
}

function sizeRows(model: TableModel, columns: number[], fontSize: number): SizedRow[] {
  return model.rows.map((row) => {
    const height = Math.max(
      row.minHeight / TWIPS_PER_INCH,
      estimateRowHeight(row, columns, fontSize),
    );
    return { row, height, budget: height * BUDGET_SAFETY };
  });
}

function toBlocks(rows: SizedRow[]): Block[] {
  const blocks: Block[] = [];
  let index = 0;
  while (index < rows.length) {
    const topicCell = rows[index].row.cells.find((cell) => cell.kind === "topic");
    const span = topicCell ? Math.max(1, topicCell.rowSpan) : 1;
    const group = rows.slice(index, index + span);
    blocks.push({
      rows: group,
      budget: group.reduce((sum, item) => sum + item.budget, 0),
    });
    index += span;
  }
  return blocks;
}

function paginate(blocks: Block[], available: number): Block[][] {
  const slides: Block[][] = [];
  let current: Block[] = [];
  let used = 0;

  for (const block of blocks) {
    if (current.length > 0 && used + block.budget > available) {
      slides.push(current);
      current = [];
      used = 0;
    }
    current.push(block);
    used += block.budget;
  }
  if (current.length > 0) slides.push(current);
  return slides.length > 0 ? slides : [[]];
}

function pptxCell(cell: TableCellModel, fontSize: number): Cell {
  return {
    text: cell.paragraphs.map((paragraph) => paragraph.text).join("\n"),
    options: {
      colspan: cell.colSpan > 1 ? cell.colSpan : undefined,
      rowspan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
      align: cell.align,
      valign: cell.kind === "content" ? "top" : "middle",
      bold: cell.bold,
      fontFace: FONT,
      fontSize,
      fill: cell.shaded ? { color: HEADER_FILL } : undefined,
      border: BORDER,
      margin: [0.02, 0.04, 0.02, 0.04],
    },
  };
}

export async function buildPptx(plan: Plan): Promise<Buffer> {
  const model = buildTableModel(plan);
  const hasTitle = model.includeTitle && model.title.trim().length > 0;
  const columns = columnInches(model);

  const slideSpace =
    SLIDE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN - (hasTitle ? TITLE_BLOCK_HEIGHT : 0);

  // 주제 블록 하나가 슬라이드보다 높으면 그만큼만 글자를 줄인다.
  let fontSize = BASE_FONT_SIZE;
  let sized = sizeRows(model, columns, fontSize);
  let headerBudget = sized
    .slice(0, HEADER_ROW_COUNT)
    .reduce((sum, item) => sum + item.budget, 0);
  let blocks = toBlocks(sized.slice(HEADER_ROW_COUNT));
  let tallest = blocks.reduce((max, block) => Math.max(max, block.budget), 0);

  while (fontSize > MIN_FONT_SIZE && tallest > slideSpace - headerBudget) {
    fontSize -= 0.5;
    sized = sizeRows(model, columns, fontSize);
    headerBudget = sized
      .slice(0, HEADER_ROW_COUNT)
      .reduce((sum, item) => sum + item.budget, 0);
    blocks = toBlocks(sized.slice(HEADER_ROW_COUNT));
    tallest = blocks.reduce((max, block) => Math.max(max, block.budget), 0);
  }

  const headerRows = sized.slice(0, HEADER_ROW_COUNT);
  const bodySpace = slideSpace - headerBudget;
  const slides = paginate(blocks, bodySpace);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "주간 연구계획 마인드맵";
  pptx.title = model.title || "주간 연구 추진 계획";

  for (const slideBlocks of slides) {
    const slide = pptx.addSlide();

    if (hasTitle) {
      slide.addText(model.title.trim(), {
        x: SIDE_MARGIN,
        y: TOP_MARGIN,
        w: tableWidth(),
        h: TITLE_BOX_HEIGHT,
        align: "center",
        valign: "middle",
        bold: true,
        fontFace: FONT,
        fontSize: TITLE_FONT_SIZE,
      });
    }

    const bodyRows = slideBlocks.flatMap((block) => block.rows);
    const bodyHeight = bodyRows.reduce((sum, item) => sum + item.height, 0);
    // 한 장으로 끝나고 여백이 남으면 표가 슬라이드를 채우도록 늘린다.
    const stretch =
      slides.length === 1 && bodyHeight > 0
        ? Math.min(MAX_STRETCH, Math.max(1, bodySpace / bodyHeight))
        : 1;

    const rows = [...headerRows, ...bodyRows];
    slide.addTable(
      rows.map(({ row }) => row.cells.map((cell) => pptxCell(cell, fontSize))),
      {
        x: SIDE_MARGIN,
        y: hasTitle ? TOP_MARGIN + TITLE_BLOCK_HEIGHT : TOP_MARGIN,
        w: tableWidth(),
        colW: columns,
        rowH: rows.map(({ row, height }) =>
          Math.max(0.1, height * (row.header ? 1 : stretch)),
        ),
        border: BORDER,
        fontFace: FONT,
        fontSize,
        valign: "middle",
        autoPage: false,
      },
    );
  }

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(output as Uint8Array);
}
