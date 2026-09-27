"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Maximize2, Minus, Plus, Trash2 } from "lucide-react";

import { AutoTextarea } from "@/components/auto-textarea";
import { Button } from "@/components/ui/button";
import {
  MEETING_MARK_PREFIX,
  clamp,
  dayRangeLabel,
  formatWeekRange,
  type Plan,
  type PlanItem,
  type PlanTopic,
} from "@/lib/plan";
import { topicColor, type Selection } from "@/lib/selection";
import type { PlanActions } from "@/lib/use-plan";
import { cn } from "@/lib/utils";

type MindmapCanvasProps = {
  plan: Plan;
  actions: PlanActions;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
  focusId: string | null;
  onFocusHandled: () => void;
  onRequestFocus: (id: string) => void;
};

type Edge = { id: string; from: string; to: string; color: string };
type Path = { id: string; d: string; color: string };

const MIN_SCALE = 0.35;
const MAX_SCALE = 1.8;

export function MindmapCanvas({
  plan,
  actions,
  selection,
  onSelect,
  focusId,
  onFocusHandled,
  onRequestFocus,
}: MindmapCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const observerRef = useRef<ResizeObserver | null>(null);
  const frameRef = useRef<number | null>(null);

  const [view, setView] = useState({ x: 40, y: 40, scale: 1 });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const [paths, setPaths] = useState<Path[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [panning, setPanning] = useState(false);
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = [];
    plan.topics.forEach((topic, index) => {
      const color = topicColor(index);
      list.push({ id: `root-${topic.id}`, from: "root", to: topic.id, color });
      topic.items.forEach((item) => {
        list.push({ id: `${topic.id}-${item.id}`, from: topic.id, to: item.id, color });
      });
    });
    return list;
  }, [plan.topics]);

  const measureAt = useCallback((scale: number) => {
    const tree = treeRef.current;
    if (!tree) return;
    const treeRect = tree.getBoundingClientRect();

    const nextSize = {
      width: Math.round(treeRect.width / scale),
      height: Math.round(treeRect.height / scale),
    };
    setSize((prev) =>
      prev.width === nextSize.width && prev.height === nextSize.height ? prev : nextSize,
    );

    const box = (id: string) => {
      const el = nodeRefs.current.get(id);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: (rect.left - treeRect.left) / scale,
        y: (rect.top - treeRect.top) / scale,
        w: rect.width / scale,
        h: rect.height / scale,
      };
    };

    const next: Path[] = [];
    for (const edge of edges) {
      const a = box(edge.from);
      const b = box(edge.to);
      if (!a || !b) continue;
      const x1 = a.x + a.w;
      const y1 = a.y + a.h / 2;
      const x2 = b.x;
      const y2 = b.y + b.h / 2;
      const dx = Math.max(18, (x2 - x1) / 2);
      next.push({
        id: edge.id,
        color: edge.color,
        d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
      });
    }

    setPaths((prev) => {
      if (prev.length === next.length && prev.every((p, i) => p.d === next[i].d && p.id === next[i].id)) {
        return prev;
      }
      return next;
    });
  }, [edges]);

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      measureAt(viewRef.current.scale);
    });
  }, [measureAt]);

  const registerNode = useCallback((id: string, el: HTMLElement | null) => {
    const map = nodeRefs.current;
    const observer = observerRef.current;
    const previous = map.get(id);
    if (previous && previous !== el && observer) observer.unobserve(previous);
    if (el) {
      map.set(id, el);
      observer?.observe(el);
    } else {
      map.delete(id);
    }
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(() => scheduleMeasure());
    observerRef.current = observer;
    if (treeRef.current) observer.observe(treeRef.current);
    nodeRefs.current.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      observerRef.current = null;
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [scheduleMeasure]);

  useLayoutEffect(() => {
    viewRef.current = { ...viewRef.current, scale: view.scale };
    measureAt(view.scale);
  }, [measureAt, plan, view.scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        setView((current) => {
          const scale = clamp(
            current.scale * Math.exp(-event.deltaY / 320),
            MIN_SCALE,
            MAX_SCALE,
          );
          const ratio = scale / current.scale;
          return {
            scale,
            x: px - (px - current.x) * ratio,
            y: py - (py - current.y) * ratio,
          };
        });
        return;
      }
      setView((current) => ({
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!focusId) return;
    const canvas = canvasRef.current;
    const el = canvas?.querySelector<HTMLTextAreaElement>(`[data-focus-id="${focusId}"]`);
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      const rect = el.getBoundingClientRect();
      const bounds = canvas!.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (rect.bottom > bounds.bottom - 32) dy = bounds.bottom - 32 - rect.bottom;
      if (rect.top < bounds.top + 32) dy = bounds.top + 32 - rect.top;
      if (rect.right > bounds.right - 32) dx = bounds.right - 32 - rect.right;
      if (rect.left < bounds.left + 32) dx = bounds.left + 32 - rect.left;
      if (dx || dy) setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
    }
    onFocusHandled();
  }, [focusId, onFocusHandled]);

  const zoomBy = (factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const px = canvas.clientWidth / 2;
    const py = canvas.clientHeight / 2;
    setView((current) => {
      const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = scale / current.scale;
      return { scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  };

  const fitToScreen = () => {
    const canvas = canvasRef.current;
    const tree = treeRef.current;
    if (!canvas || !tree) return;
    const treeRect = tree.getBoundingClientRect();
    const width = size.width || treeRect.width / view.scale;
    const height = size.height || treeRect.height / view.scale;
    if (!width || !height) return;

    const scale = clamp(
      Math.min((canvas.clientWidth - 80) / width, (canvas.clientHeight - 80) / height),
      MIN_SCALE,
      1,
    );
    setView({
      scale,
      x: Math.max(24, (canvas.clientWidth - width * scale) / 2),
      y: Math.max(24, (canvas.clientHeight - height * scale) / 2),
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement;
    // 포인터를 캡처하면 그 뒤의 click 이 캔버스로 넘어가므로, 조작 요소 위에서는 패닝하지 않는다.
    if (target.closest("[data-node], [data-no-pan]")) return;
    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: viewRef.current.x,
      oy: viewRef.current.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan) return;
    setView((current) => ({
      ...current,
      x: pan.ox + (event.clientX - pan.x),
      y: pan.oy + (event.clientY - pan.y),
    }));
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return;
    panRef.current = null;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const addTopicAfter = (topicId?: string) => {
    const id = actions.addTopic(topicId);
    onSelect({ type: "topic", topicId: id });
    onRequestFocus(id);
  };

  const addItemAfter = (topicId: string, afterItemId?: string) => {
    const id = actions.addItem(topicId, afterItemId);
    onSelect({ type: "item", topicId, itemId: id });
    onRequestFocus(id);
  };

  return (
    <div
      ref={canvasRef}
      className={cn(
        "relative h-full w-full overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] [background-size:22px_22px]",
        panning ? "cursor-grabbing" : "cursor-grab",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        <div ref={treeRef} className="relative inline-flex items-center gap-14 p-1">
          <svg
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={size.width || 1}
            height={size.height || 1}
            aria-hidden
          >
            {paths.map((path) => (
              <path
                key={path.id}
                d={path.d}
                fill="none"
                stroke={path.color}
                strokeOpacity={0.45}
                strokeWidth={2}
                strokeLinecap="round"
              />
            ))}
          </svg>

          <RootNode
            plan={plan}
            selected={selection?.type === "root"}
            onSelect={() => onSelect({ type: "root" })}
            onAddTopic={() => addTopicAfter()}
            register={registerNode}
          />

          <div className="relative flex flex-col gap-5">
            {plan.topics.map((topic, index) => (
              <div key={topic.id} className="flex items-center gap-12">
                <TopicNode
                  topic={topic}
                  color={topicColor(index)}
                  selected={selection?.type === "topic" && selection.topicId === topic.id}
                  onSelect={() => onSelect({ type: "topic", topicId: topic.id })}
                  onChange={(name) => actions.patchTopic(topic.id, { name })}
                  onRemove={() => actions.removeTopic(topic.id)}
                  onAddSibling={() => addTopicAfter(topic.id)}
                  onAddItem={() => addItemAfter(topic.id)}
                  register={registerNode}
                />
                <div className="flex flex-col gap-2.5">
                  {topic.items.map((item) => (
                    <ItemNode
                      key={item.id}
                      item={item}
                      color={topicColor(index)}
                      selected={selection?.type === "item" && selection.itemId === item.id}
                      onSelect={() => onSelect({ type: "item", topicId: topic.id, itemId: item.id })}
                      onChange={(text) => actions.patchItem(topic.id, item.id, { text })}
                      onRemove={() => actions.removeItem(topic.id, item.id)}
                      onAddSibling={() => addItemAfter(topic.id, item.id)}
                      register={registerNode}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => addItemAfter(topic.id)}
                    className="w-fit rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition hover:border-solid hover:bg-accent hover:text-foreground"
                  >
                    + 추진 내용
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addTopicAfter()}
              className="w-fit rounded-md border border-dashed px-3 py-1.5 text-sm text-muted-foreground transition hover:border-solid hover:bg-accent hover:text-foreground"
            >
              + 연구 주제
            </button>
          </div>
        </div>
      </div>

      {plan.topics.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div
            data-no-pan
            className="pointer-events-auto max-w-sm rounded-xl border bg-background/95 p-5 text-center shadow-sm backdrop-blur"
          >
            <h2 className="text-sm font-semibold">아직 연구 주제가 없습니다</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              가운데 노드에서 가지를 뻗어 연구 주제와 추진 내용을 적고, 요일을 골라 일정을 표시하세요.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button size="sm" onClick={() => addTopicAfter()}>
                첫 주제 추가
              </Button>
              <Button size="sm" variant="outline" onClick={() => actions.reset("sample")}>
                예시 불러오기
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
        <p className="pointer-events-none hidden max-w-md rounded-md bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur sm:block">
          Enter 새 항목 · Shift+Enter 줄바꿈 · Tab 하위 항목 · 빈 칸에서 Backspace 삭제 · 휠 이동 /
          Ctrl+휠 확대
        </p>
        <div
          data-no-pan
          className="pointer-events-auto ml-auto flex items-center gap-1 rounded-md border bg-background/90 p-1 backdrop-blur"
        >
          <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomBy(1 / 1.15)} aria-label="축소">
            <Minus className="size-4" />
          </Button>
          <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(view.scale * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomBy(1.15)} aria-label="확대">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={fitToScreen} aria-label="화면에 맞추기">
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

type RegisterFn = (id: string, el: HTMLElement | null) => void;

function RootNode({
  plan,
  selected,
  onSelect,
  onAddTopic,
  register,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  onAddTopic: () => void;
  register: RegisterFn;
}) {
  return (
    <div
      data-node
      ref={(el) => register("root", el)}
      onClick={onSelect}
      className={cn(
        "w-56 cursor-pointer rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-sm transition",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <p className="text-sm font-semibold leading-snug">{plan.title || "제목 없는 계획"}</p>
      <p className="mt-1 text-xs opacity-80">{formatWeekRange(plan)}</p>
      <div className="mt-2 flex items-center justify-between text-xs opacity-80">
        <span>주제 {plan.topics.length}개</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAddTopic();
          }}
          className="rounded px-1.5 py-0.5 transition hover:bg-primary-foreground/15"
        >
          + 주제
        </button>
      </div>
    </div>
  );
}

function TopicNode({
  topic,
  color,
  selected,
  onSelect,
  onChange,
  onRemove,
  onAddSibling,
  onAddItem,
  register,
}: {
  topic: PlanTopic;
  color: string;
  selected: boolean;
  onSelect: () => void;
  onChange: (name: string) => void;
  onRemove: () => void;
  onAddSibling: () => void;
  onAddItem: () => void;
  register: RegisterFn;
}) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onAddSibling();
      return;
    }
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      onAddItem();
      return;
    }
    if (event.key === "Backspace" && topic.name === "" && topic.items.length === 0) {
      event.preventDefault();
      onRemove();
      return;
    }
    if (event.key === "Escape") event.currentTarget.blur();
  };

  return (
    <div
      data-node
      ref={(el) => register(topic.id, el)}
      onClick={onSelect}
      className={cn(
        "group relative w-60 cursor-pointer rounded-lg border bg-card shadow-sm transition",
        selected ? "border-transparent ring-2 ring-offset-2 ring-offset-background" : "hover:shadow",
      )}
      style={selected ? ({ ["--tw-ring-color" as string]: color } as CSSProperties) : undefined}
    >
      <span
        className="absolute inset-y-0 left-0 w-1.5 rounded-l-lg"
        style={{ backgroundColor: color }}
      />
      <div className="py-2.5 pl-4 pr-2">
        <AutoTextarea
          data-focus-id={topic.id}
          value={topic.name}
          placeholder="연구 주제"
          onChange={(event) => onChange(event.target.value)}
          onFocus={onSelect}
          onKeyDown={onKeyDown}
          className="text-sm font-semibold leading-snug"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">내용 {topic.items.length}건</span>
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAddItem();
              }}
              className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              + 내용
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              aria-label="주제 삭제"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemNode({
  item,
  color,
  selected,
  onSelect,
  onChange,
  onRemove,
  onAddSibling,
  register,
}: {
  item: PlanItem;
  color: string;
  selected: boolean;
  onSelect: () => void;
  onChange: (text: string) => void;
  onRemove: () => void;
  onAddSibling: () => void;
  register: RegisterFn;
}) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onAddSibling();
      return;
    }
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      onAddSibling();
      return;
    }
    if (event.key === "Backspace" && item.text === "") {
      event.preventDefault();
      onRemove();
      return;
    }
    if (event.key === "Escape") event.currentTarget.blur();
  };

  return (
    <div
      data-node
      ref={(el) => register(item.id, el)}
      onClick={onSelect}
      className={cn(
        "group w-[19rem] cursor-pointer rounded-md border bg-card px-3 py-2 shadow-sm transition",
        selected ? "border-transparent ring-2 ring-offset-2 ring-offset-background" : "hover:shadow",
      )}
      style={selected ? ({ ["--tw-ring-color" as string]: color } as CSSProperties) : undefined}
    >
      <AutoTextarea
        data-focus-id={item.id}
        value={item.text}
        placeholder="추진 내용"
        onChange={(event) => onChange(event.target.value)}
        onFocus={onSelect}
        onKeyDown={onKeyDown}
        className="text-[13px] leading-relaxed"
      />
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {item.schedule ? (
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: color }}
          >
            {dayRangeLabel(item.schedule)}
            {item.schedule.display === "text" && item.schedule.label
              ? ` · ${item.schedule.label}`
              : ""}
          </span>
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            일정 없음
          </span>
        )}
        {item.mark !== "none" && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {MEETING_MARK_PREFIX[item.mark].trim()} 회의
          </span>
        )}
        {!item.showInContent && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            내용칸 제외
          </span>
        )}
        {!item.bullet && item.showInContent && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            머리기호 없음
          </span>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="ml-auto rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="내용 삭제"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
