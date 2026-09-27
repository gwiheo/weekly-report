export const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export const MIN_DAY_COUNT = 5;
export const MAX_DAY_COUNT = 7;

/** `@` 외부회의 / `#` 내부회의 표기. 범례와 짝을 이룬다. */
export type MeetingMark = "none" | "external" | "internal";

export const MEETING_MARK_PREFIX: Record<MeetingMark, string> = {
  none: "",
  external: "@ ",
  internal: "# ",
};

export const MEETING_MARK_LABEL: Record<MeetingMark, string> = {
  none: "표시 없음",
  external: "@ 외부회의",
  internal: "# 내부회의",
};

/** 요일 칸에 표시되는 방식. `arrow`는 화살표, `text`는 직접 입력한 문구. */
export type ScheduleDisplay = "arrow" | "text";

export type Schedule = {
  startDay: number;
  endDay: number;
  display: ScheduleDisplay;
  label: string;
};

export type PlanItem = {
  id: string;
  text: string;
  /** 연구 내용 칸에서 `-` 머리기호를 붙일지 여부. 소제목 줄에는 끈다. */
  bullet: boolean;
  /** 끄면 요일 칸에만 표시되고 연구 내용 칸에서는 빠진다. (예: 임시 공휴일) */
  showInContent: boolean;
  mark: MeetingMark;
  schedule: Schedule | null;
};

export type PlanTopic = {
  id: string;
  name: string;
  items: PlanItem[];
};

export type Plan = {
  title: string;
  legend: string;
  /** 해당 주의 월요일 (yyyy-mm-dd) */
  weekStart: string;
  dayCount: number;
  /** 주제 블록 사이에 빈 줄을 넣을지 여부 */
  spacerRows: boolean;
  /** docx 첫 줄에 제목 문단을 넣을지 여부 */
  includeTitle: boolean;
  topics: PlanTopic[];
};

export const DEFAULT_LEGEND = "@ : 외부회의 , # : 내부회의";

let seq = 0;

export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function createItem(patch: Partial<PlanItem> = {}): PlanItem {
  return {
    id: uid("item"),
    text: "",
    bullet: true,
    showInContent: true,
    mark: "none",
    schedule: null,
    ...patch,
  };
}

export function createTopic(patch: Partial<PlanTopic> = {}): PlanTopic {
  return {
    id: uid("topic"),
    name: "",
    items: [],
    ...patch,
  };
}

export function createSchedule(day: number): Schedule {
  return { startDay: day, endDay: day, display: "arrow", label: "" };
}

/** 주어진 날짜가 속한 주의 월요일을 yyyy-mm-dd 로 돌려준다. */
export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toISODate(d);
}

/** 월요일 시작 기준으로 금요일은 다섯 번째 날이다. */
const FRIDAY_INDEX = 4;

/** 주어진 날짜가 속한 주의 금요일을 yyyy-mm-dd 로 돌려준다. */
export function fridayOf(date: Date): string {
  return addDays(mondayOf(date), FRIDAY_INDEX);
}

/** 계획이 잡고 있는 주의 금요일. 편집 화면에서 기준일로 보여 준다. */
export function weekFriday(plan: Pick<Plan, "weekStart">): string {
  return addDays(plan.weekStart, FRIDAY_INDEX);
}

/** 기준 금요일에서 표의 첫 칸(월요일) 날짜를 되돌린다. */
export function weekStartFromFriday(friday: string): string {
  return addDays(friday, -FRIDAY_INDEX);
}

export function toISODate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(value: string, days: number): string {
  const d = parseISODate(value);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** 첨부 양식과 동일한 `26.8.17` 형태 */
export function formatDotDate(value: string): string {
  const d = parseISODate(value);
  const yy = `${d.getFullYear()}`.slice(2);
  return `${yy}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function formatWeekRange(plan: Plan): string {
  const start = formatDotDate(plan.weekStart);
  const end = formatDotDate(addDays(plan.weekStart, plan.dayCount - 1));
  return `${start} ~ ${end}`;
}

export function emptyPlan(weekStart = mondayOf(new Date())): Plan {
  return {
    title: "주간 연구 추진 계획",
    legend: DEFAULT_LEGEND,
    weekStart,
    dayCount: 5,
    spacerRows: true,
    includeTitle: true,
    topics: [],
  };
}

/** 첨부된 주간 업무표를 그대로 옮겨 놓은 예시 데이터 */
export function samplePlan(): Plan {
  return {
    title: "주간 연구 추진 계획",
    legend: DEFAULT_LEGEND,
    weekStart: "2026-08-17",
    dayCount: 5,
    spacerRows: true,
    includeTitle: true,
    topics: [
      { id: "topic-sample-1", name: "정부지원사업 모니터링", items: [] },
      {
        id: "topic-sample-2",
        name: "쿠쿠 바리스타 정수기\n(TTA 용역 건)",
        items: [
          {
            id: "item-sample-2-0",
            text: "TTA:",
            bullet: false,
            showInContent: true,
            mark: "none",
            schedule: null,
          },
          {
            id: "item-sample-2-1",
            text: "바리스타앱 테스트(v0.7.5) 및 피드백",
            bullet: true,
            showInContent: true,
            mark: "none",
            schedule: null,
          },
          {
            id: "item-sample-2-2",
            text: "아메바 앱 UI개발 계약서 처리(작업기간 11/30, 계약서수정)",
            bullet: true,
            showInContent: true,
            mark: "none",
            schedule: null,
          },
          {
            id: "item-sample-2-3",
            text: "바리스타정수기 시험항목 및 시험내용 정리",
            bullet: true,
            showInContent: true,
            mark: "none",
            schedule: null,
          },
          {
            id: "item-sample-2-4",
            text: "정수기 고장진단관련 기술 검토자료 POSTING",
            bullet: true,
            showInContent: true,
            mark: "none",
            schedule: null,
          },
          {
            id: "item-sample-2-5",
            text: "노써치 국산 정수기 9종 비교자료, 필터수명관련 자료 게시",
            bullet: true,
            showInContent: true,
            mark: "none",
            schedule: null,
          },
          {
            id: "item-sample-2-6",
            text: "고장진단관련 구현방안 정리(황재국)",
            bullet: true,
            showInContent: true,
            mark: "none",
            schedule: null,
          },
          {
            id: "item-sample-2-7",
            text: "임시 공휴일",
            bullet: true,
            showInContent: false,
            mark: "none",
            schedule: { startDay: 0, endDay: 0, display: "text", label: "임시 공휴일" },
          },
        ],
      },
      {
        id: "topic-sample-3",
        name: "로봇재고관리과제",
        items: [
          {
            id: "item-sample-3-1",
            text: "CBB 재료비 집행 자료송부(재고관리 컴퓨터 구매, CBB)",
            bullet: true,
            showInContent: true,
            mark: "none",
            schedule: null,
          },
          {
            id: "item-sample-3-2",
            text: "로봇을 이용한 진열장 상품 스캔 및 바코드 식별테스트(전재우)",
            bullet: true,
            showInContent: true,
            mark: "none",
            schedule: null,
          },
          {
            id: "item-sample-3-3",
            text: "박스식별 바코드방식 테스트(EAN-13 QR 코드방식)",
            bullet: true,
            showInContent: true,
            mark: "none",
            schedule: null,
          },
        ],
      },
      {
        id: "topic-sample-4",
        name: "홈페이지개발",
        items: [
          {
            id: "item-sample-4-1",
            text: "홈페이지개발 문서검토",
            bullet: true,
            showInContent: true,
            mark: "none",
            schedule: { startDay: 3, endDay: 4, display: "arrow", label: "" },
          },
        ],
      },
      {
        id: "topic-sample-5",
        name: "기타",
        items: [
          {
            id: "item-sample-5-1",
            text: "주간업무회의(화,10:30~12:00)",
            bullet: false,
            showInContent: true,
            mark: "internal",
            schedule: { startDay: 1, endDay: 1, display: "arrow", label: "" },
          },
        ],
      },
    ],
  };
}

/** localStorage 등 외부에서 들어온 값을 안전한 Plan 으로 정규화한다. */
export function normalizePlan(input: unknown): Plan | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<Plan> & Record<string, unknown>;
  if (!Array.isArray(raw.topics)) return null;

  const dayCount = clamp(
    typeof raw.dayCount === "number" ? Math.round(raw.dayCount) : 5,
    MIN_DAY_COUNT,
    MAX_DAY_COUNT,
  );

  const weekStart =
    typeof raw.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.weekStart)
      ? raw.weekStart
      : mondayOf(new Date());

  return {
    title: typeof raw.title === "string" ? raw.title : "주간 연구 추진 계획",
    legend: typeof raw.legend === "string" ? raw.legend : DEFAULT_LEGEND,
    weekStart,
    dayCount,
    spacerRows: raw.spacerRows !== false,
    includeTitle: raw.includeTitle !== false,
    topics: raw.topics.map((topic, ti) => normalizeTopic(topic, ti, dayCount)),
  };
}

function normalizeTopic(input: unknown, index: number, dayCount: number): PlanTopic {
  const raw = (input ?? {}) as Partial<PlanTopic>;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `topic-${index}-${uid("t")}`,
    name: typeof raw.name === "string" ? raw.name : "",
    items: Array.isArray(raw.items)
      ? raw.items.map((item, ii) => normalizeItem(item, `${index}-${ii}`, dayCount))
      : [],
  };
}

function normalizeItem(input: unknown, key: string, dayCount: number): PlanItem {
  const raw = (input ?? {}) as Partial<PlanItem>;
  const marks: MeetingMark[] = ["none", "external", "internal"];
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `item-${key}-${uid("i")}`,
    text: typeof raw.text === "string" ? raw.text : "",
    bullet: raw.bullet !== false,
    showInContent: raw.showInContent !== false,
    mark: marks.includes(raw.mark as MeetingMark) ? (raw.mark as MeetingMark) : "none",
    schedule: normalizeSchedule(raw.schedule, dayCount),
  };
}

function normalizeSchedule(input: unknown, dayCount: number): Schedule | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<Schedule>;
  const start = clamp(Math.round(Number(raw.startDay) || 0), 0, dayCount - 1);
  const end = clamp(Math.round(Number(raw.endDay ?? start) || 0), start, dayCount - 1);
  return {
    startDay: start,
    endDay: end,
    display: raw.display === "text" ? "text" : "arrow",
    label: typeof raw.label === "string" ? raw.label : "",
  };
}

export function dayRangeLabel(schedule: Schedule): string {
  const start = DAY_LABELS[schedule.startDay] ?? "?";
  const end = DAY_LABELS[schedule.endDay] ?? "?";
  return schedule.startDay === schedule.endDay ? start : `${start}~${end}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** dayCount 를 줄일 때 범위를 벗어난 일정을 다시 안으로 넣는다. */
export function clampPlanSchedules(plan: Plan): Plan {
  return {
    ...plan,
    topics: plan.topics.map((topic) => ({
      ...topic,
      items: topic.items.map((item) => {
        if (!item.schedule) return item;
        const startDay = clamp(item.schedule.startDay, 0, plan.dayCount - 1);
        const endDay = clamp(item.schedule.endDay, startDay, plan.dayCount - 1);
        if (startDay === item.schedule.startDay && endDay === item.schedule.endDay) {
          return item;
        }
        return { ...item, schedule: { ...item.schedule, startDay, endDay } };
      }),
    })),
  };
}
