"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DAY_LABELS,
  MEETING_MARK_LABEL,
  addDays,
  createSchedule,
  formatDotDate,
  fridayOf,
  parseISODate,
  weekFriday,
  weekStartFromFriday,
  type MeetingMark,
  type Plan,
  type PlanItem,
  type PlanTopic,
  type ScheduleDisplay,
} from "@/lib/plan";
import { scheduleCellText } from "@/lib/table";
import { topicColor, type Selection } from "@/lib/selection";
import type { PlanActions } from "@/lib/use-plan";
import { cn } from "@/lib/utils";

type InspectorPanelProps = {
  plan: Plan;
  actions: PlanActions;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
};

export function InspectorPanel({ plan, actions, selection, onSelect }: InspectorPanelProps) {
  if (selection?.type === "topic") {
    const index = plan.topics.findIndex((topic) => topic.id === selection.topicId);
    const topic = plan.topics[index];
    if (topic) {
      return (
        <TopicInspector
          topic={topic}
          index={index}
          total={plan.topics.length}
          actions={actions}
          onSelect={onSelect}
        />
      );
    }
  }

  if (selection?.type === "item") {
    const topicIndex = plan.topics.findIndex((topic) => topic.id === selection.topicId);
    const topic = plan.topics[topicIndex];
    const itemIndex = topic?.items.findIndex((item) => item.id === selection.itemId) ?? -1;
    const item = itemIndex >= 0 ? topic!.items[itemIndex] : undefined;
    if (topic && item) {
      return (
        <ItemInspector
          plan={plan}
          topic={topic}
          topicIndex={topicIndex}
          item={item}
          itemIndex={itemIndex}
          actions={actions}
          onSelect={onSelect}
        />
      );
    }
  }

  return <DocumentInspector plan={plan} actions={actions} />;
}

/** Base UI ToggleGroup 은 배열 값을 쓰므로 단일 선택용으로 감싼다. */
function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <ToggleGroup
      variant="outline"
      value={[value]}
      onValueChange={(next) => {
        const picked = (next as T[])[0];
        if (picked) onChange(picked);
      }}
      className="w-full"
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className="flex-1 text-xs">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function PanelSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function DocumentInspector({ plan, actions }: { plan: Plan; actions: PlanActions }) {
  const shiftWeek = (weeks: number) =>
    actions.patchPlan({ weekStart: addDays(plan.weekStart, weeks * 7) });

  return (
    <div className="space-y-6 p-4">
      <PanelSection title="문서 설정" description="표 머리글과 저장 파일에 함께 반영됩니다.">
        <div className="space-y-2">
          <Label htmlFor="plan-title">제목</Label>
          <Input
            id="plan-title"
            value={plan.title}
            onChange={(event) => actions.patchPlan({ title: event.target.value })}
            placeholder="주간 연구 추진 계획"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-legend">범례</Label>
          <Input
            id="plan-legend"
            value={plan.legend}
            onChange={(event) => actions.patchPlan({ legend: event.target.value })}
            placeholder="@ : 외부회의 , # : 내부회의"
          />
        </div>
      </PanelSection>

      <Separator />

      <PanelSection title="기간" description="금요일을 기준으로 한 주를 잡습니다.">
        <div className="space-y-2">
          <Label htmlFor="week-friday">기준 금요일</Label>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftWeek(-1)} aria-label="이전 주">
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              id="week-friday"
              type="date"
              value={weekFriday(plan)}
              onChange={(event) => {
                if (!event.target.value) return;
                const friday = fridayOf(parseISODate(event.target.value));
                actions.patchPlan({ weekStart: weekStartFromFriday(friday) });
              }}
              className="flex-1"
            />
            <Button variant="outline" size="icon" onClick={() => shiftWeek(1)} aria-label="다음 주">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            어느 날짜를 골라도 그 주의 금요일로 맞춰집니다. 표는 {formatDotDate(plan.weekStart)} ~{" "}
            {formatDotDate(addDays(plan.weekStart, plan.dayCount - 1))} 를 담습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: plan.dayCount }, (_, i) => (
            <span key={i} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              {DAY_LABELS[i]} {formatDotDate(addDays(plan.weekStart, i))}
            </span>
          ))}
        </div>
        <div className="space-y-2">
          <Label>표시 요일</Label>
          <SegmentedControl
            value={String(plan.dayCount)}
            onChange={(value) => actions.patchPlan({ dayCount: Number(value) })}
            options={[
              { value: "5", label: "월~금" },
              { value: "6", label: "월~토" },
              { value: "7", label: "월~일" },
            ]}
          />
        </div>
      </PanelSection>

      <Separator />

      <PanelSection title="표 모양">
        <SwitchRow
          id="spacer-rows"
          label="주제 사이 빈 줄"
          description="첨부 양식처럼 주제 블록을 띄웁니다."
          checked={plan.spacerRows}
          onCheckedChange={(checked) => actions.patchPlan({ spacerRows: checked })}
        />
        <SwitchRow
          id="include-title"
          label="문서 제목 줄 넣기"
          description="표 위에 제목 문단을 추가합니다."
          checked={plan.includeTitle}
          onCheckedChange={(checked) => actions.patchPlan({ includeTitle: checked })}
        />
      </PanelSection>

      <Separator />

      <PanelSection title="다시 시작">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => actions.reset("sample")}>
            예시 불러오기
          </Button>
          <Button variant="outline" size="sm" onClick={() => actions.reset("empty")}>
            비우기
          </Button>
        </div>
      </PanelSection>
    </div>
  );
}

function TopicInspector({
  topic,
  index,
  total,
  actions,
  onSelect,
}: {
  topic: PlanTopic;
  index: number;
  total: number;
  actions: PlanActions;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <div className="space-y-6 p-4">
      <PanelSection title="연구 주제" description="표 첫 번째 열에 들어갑니다.">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ backgroundColor: topicColor(index) }} />
          <span className="text-xs text-muted-foreground">
            {index + 1} / {total} 번째 주제
          </span>
        </div>
        <Textarea
          value={topic.name}
          onChange={(event) => actions.patchTopic(topic.id, { name: event.target.value })}
          placeholder="예: 쿠쿠 바리스타 정수기&#10;(TTA 용역 건)"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">줄바꿈은 표 안에서도 그대로 유지됩니다.</p>
      </PanelSection>

      <Separator />

      <PanelSection title="순서와 관리">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={index <= 0}
            onClick={() => actions.moveTopic(topic.id, -1)}
          >
            <ArrowUp className="size-4" /> 위로
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={index >= total - 1}
            onClick={() => actions.moveTopic(topic.id, 1)}
          >
            <ArrowDown className="size-4" /> 아래로
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const id = actions.addItem(topic.id);
              onSelect({ type: "item", topicId: topic.id, itemId: id });
            }}
          >
            추진 내용 추가
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              actions.removeTopic(topic.id);
              onSelect({ type: "root" });
            }}
          >
            <Trash2 className="size-4" /> 주제 삭제
          </Button>
        </div>
      </PanelSection>
    </div>
  );
}

function ItemInspector({
  plan,
  topic,
  topicIndex,
  item,
  itemIndex,
  actions,
  onSelect,
}: {
  plan: Plan;
  topic: PlanTopic;
  topicIndex: number;
  item: PlanItem;
  itemIndex: number;
  actions: PlanActions;
  onSelect: (selection: Selection) => void;
}) {
  const patch = (value: Partial<PlanItem>) => actions.patchItem(topic.id, item.id, value);
  const schedule = item.schedule;

  const onDayClick = (day: number) => {
    if (!schedule) {
      patch({ schedule: createSchedule(day) });
      return;
    }
    if (day < schedule.startDay) {
      patch({ schedule: { ...schedule, startDay: day } });
    } else if (day > schedule.endDay) {
      patch({ schedule: { ...schedule, endDay: day } });
    } else {
      patch({ schedule: { ...schedule, startDay: day, endDay: day } });
    }
  };

  return (
    <div className="space-y-6 p-4">
      <PanelSection title="추진 내용" description={`${topic.name || "이름 없는 주제"} 하위 항목`}>
        <Textarea
          value={item.text}
          onChange={(event) => patch({ text: event.target.value })}
          placeholder="예: 바리스타앱 테스트(v0.7.5) 및 피드백"
          rows={3}
        />
        <SwitchRow
          id={`bullet-${item.id}`}
          label="머리기호 `-` 붙이기"
          description="소제목 줄에는 꺼 두세요."
          checked={item.bullet}
          onCheckedChange={(checked) => patch({ bullet: checked })}
        />
        <SwitchRow
          id={`content-${item.id}`}
          label="연구 내용 칸에 표시"
          description="끄면 요일 칸에만 나옵니다. (예: 임시 공휴일)"
          checked={item.showInContent}
          onCheckedChange={(checked) => patch({ showInContent: checked })}
        />
        <div className="space-y-2">
          <Label>회의 표시</Label>
          <SegmentedControl<MeetingMark>
            value={item.mark}
            onChange={(mark) => patch({ mark })}
            options={(["none", "external", "internal"] as MeetingMark[]).map((mark) => ({
              value: mark,
              label: MEETING_MARK_LABEL[mark],
            }))}
          />
        </div>
      </PanelSection>

      <Separator />

      <PanelSection title="일정" description="선택한 요일 칸이 하나로 합쳐집니다.">
        <SwitchRow
          id={`schedule-${item.id}`}
          label="요일 칸에 표시"
          checked={Boolean(schedule)}
          onCheckedChange={(checked) => patch({ schedule: checked ? createSchedule(0) : null })}
        />
        {schedule && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: plan.dayCount }, (_, day) => {
                const active = day >= schedule.startDay && day <= schedule.endDay;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onDayClick(day)}
                    className={cn(
                      "min-w-11 rounded-md border px-2 py-1.5 text-xs transition",
                      active
                        ? "border-transparent text-white"
                        : "bg-background hover:bg-accent",
                    )}
                    style={active ? { backgroundColor: topicColor(topicIndex) } : undefined}
                  >
                    <span className="block font-medium">{DAY_LABELS[day]}</span>
                    <span className="block text-[10px] opacity-80">
                      {formatDotDate(addDays(plan.weekStart, day)).split(".").slice(1).join(".")}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              요일을 눌러 시작일을 정하고, 다른 요일을 눌러 기간을 늘립니다.
            </p>
            <div className="space-y-2">
              <Label>표시 방식</Label>
              <SegmentedControl<ScheduleDisplay>
                value={schedule.display}
                onChange={(display) => patch({ schedule: { ...schedule, display } })}
                options={[
                  { value: "arrow", label: "화살표" },
                  { value: "text", label: "문구" },
                ]}
              />
            </div>
            {schedule.display === "text" && (
              <Input
                value={schedule.label}
                onChange={(event) => patch({ schedule: { ...schedule, label: event.target.value } })}
                placeholder="예: 임시 공휴일"
              />
            )}
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              표에 들어갈 모습:{" "}
              <span className="font-medium text-foreground">{scheduleCellText(item) || "(비어 있음)"}</span>
            </div>
          </>
        )}
      </PanelSection>

      <Separator />

      <PanelSection title="순서와 관리">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={itemIndex <= 0}
            onClick={() => actions.moveItem(topic.id, item.id, -1)}
          >
            <ArrowUp className="size-4" /> 위로
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={itemIndex >= topic.items.length - 1}
            onClick={() => actions.moveItem(topic.id, item.id, 1)}
          >
            <ArrowDown className="size-4" /> 아래로
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              actions.removeItem(topic.id, item.id);
              onSelect({ type: "topic", topicId: topic.id });
            }}
          >
            <Trash2 className="size-4" /> 삭제
          </Button>
        </div>
      </PanelSection>
    </div>
  );
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
