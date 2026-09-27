import {
  DAY_LABELS,
  MEETING_MARK_PREFIX,
  addDays,
  formatDotDate,
  type Plan,
  type PlanItem,
  type PlanTopic,
} from "./plan";

export type CellParagraph = {
  text: string;
  /** 머리기호 줄: 두 번째 줄부터 들여쓰기를 맞춘다. */
  hanging?: boolean;
};

export type CellKind = "corner" | "legend" | "head" | "topic" | "content" | "day" | "spacer";

export type TableCellModel = {
  key: string;
  kind: CellKind;
  paragraphs: CellParagraph[];
  colSpan: number;
  rowSpan: number;
  align: "left" | "center";
  bold: boolean;
  shaded: boolean;
  topicId?: string;
  itemId?: string;
};

export type TableRowModel = {
  key: string;
  cells: TableCellModel[];
  header: boolean;
  /** twips 단위 최소 높이 */
  minHeight: number;
};

export type TableModel = {
  title: string;
  includeTitle: boolean;
  dayCount: number;
  columnWidths: number[];
  rows: TableRowModel[];
};

/** A4 가로 방향, 좌우 여백 720twips 기준 사용 가능 폭 */
const USABLE_WIDTH = 15400;
const TOPIC_WIDTH = 2600;
const DAY_WIDTH = 1160;

export const HEADER_FILL = "D9D9D9";

export function columnWidths(dayCount: number): number[] {
  const contentWidth = USABLE_WIDTH - TOPIC_WIDTH - DAY_WIDTH * dayCount;
  return [TOPIC_WIDTH, contentWidth, ...Array.from({ length: dayCount }, () => DAY_WIDTH)];
}

export function arrowText(span: number): string {
  return span <= 1 ? "←→" : `←${"─".repeat(span * 3)}→`;
}

export function scheduleCellText(item: PlanItem): string {
  const schedule = item.schedule;
  if (!schedule) return "";
  const span = schedule.endDay - schedule.startDay + 1;
  if (schedule.display === "text") {
    return schedule.label.trim() || item.text.split("\n")[0]?.trim() || arrowText(span);
  }
  return arrowText(span);
}

type Lane = PlanItem[];

/** 일정이 겹치지 않는 항목끼리 한 줄에 모아 최소 행 수를 만든다. */
export function packLanes(items: PlanItem[]): Lane[] {
  const scheduled = items
    .filter((item) => item.schedule)
    .sort((a, b) => a.schedule!.startDay - b.schedule!.startDay);

  const lanes: Lane[] = [];
  for (const item of scheduled) {
    const { startDay, endDay } = item.schedule!;
    const lane = lanes.find((candidate) =>
      candidate.every((other) => {
        const o = other.schedule!;
        return endDay < o.startDay || startDay > o.endDay;
      }),
    );
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

function contentParagraphs(topic: PlanTopic): CellParagraph[] {
  const paragraphs: CellParagraph[] = [];
  for (const item of topic.items) {
    if (!item.showInContent) continue;
    const lines = item.text.split("\n");
    const first = lines[0] ?? "";
    const prefix = MEETING_MARK_PREFIX[item.mark];
    if (item.bullet) {
      paragraphs.push({ text: `- ${prefix}${first}`.trimEnd(), hanging: true });
    } else {
      paragraphs.push({ text: `${prefix}${first}`.trimEnd() });
    }
    for (const line of lines.slice(1)) {
      paragraphs.push({ text: line, hanging: item.bullet });
    }
  }
  return paragraphs;
}

function dayCells(lane: Lane, dayCount: number, rowKey: string): TableCellModel[] {
  const byStart = new Map<number, PlanItem>();
  for (const item of lane) byStart.set(item.schedule!.startDay, item);

  const cells: TableCellModel[] = [];
  let day = 0;
  while (day < dayCount) {
    const item = byStart.get(day);
    if (item) {
      const span = Math.min(item.schedule!.endDay, dayCount - 1) - day + 1;
      cells.push({
        key: `${rowKey}-d${day}`,
        kind: "day",
        paragraphs: [{ text: scheduleCellText(item) }],
        colSpan: span,
        rowSpan: 1,
        align: "center",
        bold: false,
        shaded: false,
        itemId: item.id,
      });
      day += span;
    } else {
      cells.push({
        key: `${rowKey}-d${day}`,
        kind: "day",
        paragraphs: [{ text: "" }],
        colSpan: 1,
        rowSpan: 1,
        align: "center",
        bold: false,
        shaded: false,
      });
      day += 1;
    }
  }
  return cells;
}

function emptyDayCells(dayCount: number, rowKey: string): TableCellModel[] {
  return Array.from({ length: dayCount }, (_, day) => ({
    key: `${rowKey}-d${day}`,
    kind: "day" as const,
    paragraphs: [{ text: "" }],
    colSpan: 1,
    rowSpan: 1,
    align: "center" as const,
    bold: false,
    shaded: false,
  }));
}

export function buildTableModel(plan: Plan): TableModel {
  const dayCount = plan.dayCount;
  const columns = columnWidths(dayCount);
  const rows: TableRowModel[] = [];

  const dayNames = Array.from({ length: dayCount }, (_, i) => DAY_LABELS[i]);
  const dates = Array.from({ length: dayCount }, (_, i) =>
    formatDotDate(addDays(plan.weekStart, i)),
  );

  rows.push({
    key: "head-1",
    header: true,
    minHeight: 300,
    cells: [
      {
        key: "head-1-corner",
        kind: "corner",
        paragraphs: [{ text: "" }],
        colSpan: 1,
        rowSpan: 1,
        align: "center",
        bold: false,
        shaded: false,
      },
      {
        key: "head-1-legend",
        kind: "legend",
        paragraphs: [{ text: plan.legend }],
        colSpan: 1,
        rowSpan: 1,
        align: "left",
        bold: false,
        shaded: false,
      },
      ...dayNames.map((name, i) => ({
        key: `head-1-day-${i}`,
        kind: "head" as const,
        paragraphs: [{ text: name }],
        colSpan: 1,
        rowSpan: 1,
        align: "center" as const,
        bold: true,
        shaded: true,
      })),
    ],
  });

  rows.push({
    key: "head-2",
    header: true,
    minHeight: 300,
    cells: [
      {
        key: "head-2-topic",
        kind: "head",
        paragraphs: [{ text: "연구 주제" }],
        colSpan: 1,
        rowSpan: 1,
        align: "center",
        bold: true,
        shaded: true,
      },
      {
        key: "head-2-content",
        kind: "head",
        paragraphs: [{ text: "연구 내용" }],
        colSpan: 1,
        rowSpan: 1,
        align: "center",
        bold: true,
        shaded: true,
      },
      ...dates.map((date, i) => ({
        key: `head-2-date-${i}`,
        kind: "head" as const,
        paragraphs: [{ text: date }],
        colSpan: 1,
        rowSpan: 1,
        align: "center" as const,
        bold: true,
        shaded: true,
      })),
    ],
  });

  plan.topics.forEach((topic, topicIndex) => {
    const lanes = packLanes(topic.items);
    const rowCount = Math.max(1, lanes.length);
    const content = contentParagraphs(topic);
    const nameParagraphs: CellParagraph[] = (topic.name || "").split("\n").map((text) => ({ text }));

    for (let laneIndex = 0; laneIndex < rowCount; laneIndex += 1) {
      const rowKey = `topic-${topic.id}-${laneIndex}`;
      const cells: TableCellModel[] = [];

      if (laneIndex === 0) {
        cells.push({
          key: `${rowKey}-name`,
          kind: "topic",
          paragraphs: nameParagraphs.length ? nameParagraphs : [{ text: "" }],
          colSpan: 1,
          rowSpan: rowCount,
          align: "center",
          bold: false,
          shaded: false,
          topicId: topic.id,
        });
        cells.push({
          key: `${rowKey}-content`,
          kind: "content",
          paragraphs: content.length ? content : [{ text: "" }],
          colSpan: 1,
          rowSpan: rowCount,
          align: "left",
          bold: false,
          shaded: false,
          topicId: topic.id,
        });
      }

      cells.push(
        ...(lanes[laneIndex]
          ? dayCells(lanes[laneIndex], dayCount, rowKey)
          : emptyDayCells(dayCount, rowKey)),
      );

      const contentHeight = estimateHeight(content, columns[1]);
      rows.push({
        key: rowKey,
        header: false,
        minHeight:
          rowCount === 1
            ? contentHeight
            : Math.max(280, Math.ceil(contentHeight / rowCount)),
        cells,
      });
    }

    const isLast = topicIndex === plan.topics.length - 1;
    if (plan.spacerRows && !isLast) {
      rows.push({
        key: `spacer-${topic.id}`,
        header: false,
        minHeight: 120,
        cells: Array.from({ length: dayCount + 2 }, (_, i) => ({
          key: `spacer-${topic.id}-${i}`,
          kind: "spacer" as const,
          paragraphs: [{ text: "" }],
          colSpan: 1,
          rowSpan: 1,
          align: "left" as const,
          bold: false,
          shaded: false,
        })),
      });
    }
  });

  return {
    title: plan.title,
    includeTitle: plan.includeTitle,
    dayCount,
    columnWidths: columns,
    rows,
  };
}

const CJK = /[\u1100-\u11FF\u3000-\u303F\u3040-\u30FF\u3130-\u318F\u4E00-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/;

/** 글자 폭을 전각 기준(em)으로 어림한다. */
function textWidthEm(text: string): number {
  let width = 0;
  for (const char of text) width += CJK.test(char) ? 1 : 0.55;
  return width;
}

/**
 * 줄바꿈을 감안한 행 높이(twips). xlsx 는 병합 칸의 높이를 자동으로 맞추지
 * 못하므로 여기서 미리 계산해 둔다.
 */
function estimateHeight(paragraphs: CellParagraph[], contentWidth: number): number {
  const emPerLine = Math.max(10, (contentWidth - 160) / 180);
  let lines = 0;
  for (const paragraph of paragraphs) {
    const usable = paragraph.hanging ? emPerLine - 1.2 : emPerLine;
    lines += Math.max(1, Math.ceil(textWidthEm(paragraph.text) / usable));
  }
  return Math.max(560, lines * 240 + 60);
}

export function planFileBaseName(plan: Plan): string {
  const safeTitle = (plan.title || "주간계획").replace(/[\\/:*?"<>|]/g, "").trim() || "주간계획";
  return `${safeTitle}_${plan.weekStart}`;
}
