"use client";

import { useMemo } from "react";

import type { Plan } from "@/lib/plan";
import type { Selection } from "@/lib/selection";
import { buildTableModel, type TableCellModel } from "@/lib/table";
import { cn } from "@/lib/utils";

type TablePreviewProps = {
  plan: Plan;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
};

export function TablePreview({ plan, selection, onSelect }: TablePreviewProps) {
  const model = useMemo(() => buildTableModel(plan), [plan]);
  const totalWidth = model.columnWidths.reduce((sum, value) => sum + value, 0);

  const isSelected = (cell: TableCellModel) => {
    if (!selection) return false;
    if (cell.itemId && selection.type === "item") return selection.itemId === cell.itemId;
    if (cell.topicId && selection.type === "topic") return selection.topicId === cell.topicId;
    return false;
  };

  const handleClick = (cell: TableCellModel) => {
    if (cell.itemId) {
      const topic = plan.topics.find((candidate) =>
        candidate.items.some((item) => item.id === cell.itemId),
      );
      if (topic) onSelect({ type: "item", topicId: topic.id, itemId: cell.itemId });
      return;
    }
    if (cell.topicId) onSelect({ type: "topic", topicId: cell.topicId });
  };

  return (
    <div className="h-full overflow-auto rounded-xl border bg-muted/30 p-4 sm:p-6">
      <div className="mx-auto w-fit min-w-full">
        {model.includeTitle && model.title.trim() && (
          <p className="mb-3 text-center text-base font-bold">{model.title.trim()}</p>
        )}
        <table
          className="w-full table-fixed border-collapse bg-white text-[12px] text-black shadow-sm"
          style={{ minWidth: 880 }}
        >
          <colgroup>
            {model.columnWidths.map((width, index) => (
              <col key={index} style={{ width: `${(width / totalWidth) * 100}%` }} />
            ))}
          </colgroup>
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.key} style={{ height: `${Math.round(row.minHeight / 20)}pt` }}>
                {row.cells.map((cell) => (
                  <td
                    key={cell.key}
                    rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                    colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                    onClick={() => handleClick(cell)}
                    className={cn(
                      "border border-black px-1.5 py-1 align-middle",
                      cell.kind === "content" && "align-top",
                      cell.align === "center" ? "text-center" : "text-left",
                      cell.bold && "font-semibold",
                      cell.shaded && "bg-[#d9d9d9]",
                      (cell.topicId || cell.itemId) && "cursor-pointer",
                      isSelected(cell) && "bg-blue-50 outline outline-2 -outline-offset-2 outline-blue-500",
                    )}
                  >
                    {cell.paragraphs.map((paragraph, index) => (
                      <span
                        key={index}
                        className={cn(
                          "block whitespace-pre-wrap break-words leading-[1.45]",
                          paragraph.hanging && "pl-[1.1em] -indent-[1.1em]",
                        )}
                      >
                        {paragraph.text || "\u00a0"}
                      </span>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          이 표가 그대로 docx / xlsx 로 저장됩니다. 칸을 누르면 해당 항목이 선택됩니다.
        </p>
      </div>
    </div>
  );
}
