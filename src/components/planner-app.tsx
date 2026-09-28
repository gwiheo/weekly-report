"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Presentation,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { InspectorPanel } from "@/components/inspector-panel";
import { MindmapCanvas } from "@/components/mindmap-canvas";
import { TablePreview } from "@/components/table-preview";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatWeekRange, normalizePlan } from "@/lib/plan";
import type { Selection } from "@/lib/selection";
import { planFileBaseName } from "@/lib/table";
import { usePlan } from "@/lib/use-plan";

type ExportKind = "docx" | "xlsx" | "pptx";
type View = "mindmap" | "table" | "edit";

export function PlannerApp() {
  const { plan, actions, loading } = usePlan();
  const [selection, setSelection] = useState<Selection | null>({ type: "root" });
  const [focusId, setFocusId] = useState<string | null>(null);
  const [view, setView] = useState<View>("mindmap");
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFocusHandled = useCallback(() => setFocusId(null), []);

  const exportFile = useCallback(
    async (kind: ExportKind) => {
      if (!plan) return;
      setBusy(kind);
      try {
        const response = await fetch(`/api/export/${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plan),
        });
        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(detail?.error ?? "파일을 만들지 못했습니다.");
        }
        const blob = await response.blob();
        saveAs(blob, `${planFileBaseName(plan)}.${kind}`);
        toast.success(`${kind.toUpperCase()} 파일을 저장했습니다.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "파일을 만들지 못했습니다.");
      } finally {
        setBusy(null);
      }
    },
    [plan],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void exportFile("docx");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exportFile]);

  const exportJson = () => {
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    saveAs(blob, `${planFileBaseName(plan)}.json`);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = normalizePlan(JSON.parse(await file.text()));
      if (!parsed) throw new Error("계획 파일 형식이 아닙니다.");
      actions.setPlan(parsed);
      setSelection({ type: "root" });
      toast.success("계획을 불러왔습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "파일을 불러오지 못했습니다.");
    }
  };

  const onSelect = useCallback((next: Selection) => setSelection(next), []);
  const onRequestFocus = useCallback((id: string) => setFocusId(id), []);

  if (loading || !plan) {
    return (
      <div className="flex h-dvh items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">계획을 불러오는 중…</span>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-muted/20">
      <header className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold sm:text-base">
            {plan.title || "제목 없는 계획"}
          </h1>
          <p className="text-xs text-muted-foreground">{formatWeekRange(plan)} · 주간 연구 추진 계획</p>
        </div>

        <Tabs
          value={view}
          onValueChange={(value) => setView(value as View)}
          className="order-last w-full sm:order-none sm:ml-4 sm:w-auto"
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="mindmap" className="flex-1 sm:flex-none">
              마인드맵
            </TabsTrigger>
            <TabsTrigger value="table" className="flex-1 sm:flex-none">
              표 미리보기
            </TabsTrigger>
            <TabsTrigger value="edit" className="flex-1 sm:flex-none lg:hidden">
              편집
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importJson(file);
              event.target.value = "";
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" />
            <span className="hidden sm:inline">불러오기</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={exportJson}>
            <Download className="size-4" />
            <span className="hidden sm:inline">JSON</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportFile("xlsx")}
            disabled={busy !== null}
          >
            {busy === "xlsx" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            XLSX
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportFile("pptx")}
            disabled={busy !== null}
          >
            {busy === "pptx" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Presentation className="size-4" />
            )}
            PPTX
          </Button>
          <Button size="sm" onClick={() => void exportFile("docx")} disabled={busy !== null}>
            {busy === "docx" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            DOCX 저장
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        <section className="min-w-0 flex-1 p-3">
          <div className={view === "mindmap" ? "h-full" : "hidden h-full"}>
            <MindmapCanvas
              plan={plan}
              actions={actions}
              selection={selection}
              onSelect={onSelect}
              focusId={focusId}
              onFocusHandled={onFocusHandled}
              onRequestFocus={onRequestFocus}
            />
          </div>
          {view === "table" && (
            <div className="h-full">
              <TablePreview plan={plan} selection={selection} onSelect={onSelect} />
            </div>
          )}
          {view === "edit" && (
            <div className="h-full overflow-y-auto rounded-xl border bg-background lg:hidden">
              <InspectorPanel
                plan={plan}
                actions={actions}
                selection={selection}
                onSelect={onSelect}
              />
            </div>
          )}
        </section>

        <aside className="hidden w-[22rem] shrink-0 overflow-y-auto border-l bg-background lg:block">
          <InspectorPanel plan={plan} actions={actions} selection={selection} onSelect={onSelect} />
        </aside>
      </main>
    </div>
  );
}
