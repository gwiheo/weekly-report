export type Selection =
  | { type: "root" }
  | { type: "topic"; topicId: string }
  | { type: "item"; topicId: string; itemId: string };

export function selectionKey(selection: Selection | null): string {
  if (!selection) return "";
  if (selection.type === "root") return "root";
  if (selection.type === "topic") return selection.topicId;
  return selection.itemId;
}

/** 주제 색상 팔레트. 마인드맵 가지와 미리보기 강조에 함께 쓴다. */
export const TOPIC_COLORS = [
  "#2563eb",
  "#0d9488",
  "#c2410c",
  "#7c3aed",
  "#be123c",
  "#0369a1",
  "#4d7c0f",
  "#a16207",
] as const;

export function topicColor(index: number): string {
  return TOPIC_COLORS[index % TOPIC_COLORS.length];
}
