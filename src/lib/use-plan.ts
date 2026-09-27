"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clampPlanSchedules,
  createItem,
  createTopic,
  normalizePlan,
  samplePlan,
  type Plan,
  type PlanItem,
  type PlanTopic,
} from "./plan";

const STORAGE_KEY = "weekly-research-planner:v1";

export type PlanActions = {
  setPlan: (plan: Plan) => void;
  patchPlan: (patch: Partial<Plan>) => void;
  addTopic: (afterTopicId?: string) => string;
  patchTopic: (topicId: string, patch: Partial<PlanTopic>) => void;
  removeTopic: (topicId: string) => void;
  moveTopic: (topicId: string, direction: -1 | 1) => void;
  addItem: (topicId: string, afterItemId?: string) => string;
  patchItem: (topicId: string, itemId: string, patch: Partial<PlanItem>) => void;
  removeItem: (topicId: string, itemId: string) => void;
  moveItem: (topicId: string, itemId: string, direction: -1 | 1) => void;
  reset: (mode: "empty" | "sample") => void;
};

export function usePlan() {
  const [plan, setPlanState] = useState<Plan | null>(null);
  const loadedRef = useRef(false);

  // 서버 렌더 결과와 어긋나지 않도록 저장된 계획은 첫 마운트 이후에 읽는다.
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let restored: Plan | null = null;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      restored = stored ? normalizePlan(JSON.parse(stored)) : null;
    } catch {
      restored = null;
    }
    setPlanState(restored ?? samplePlan());
  }, []);

  useEffect(() => {
    if (!plan) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      } catch {
        // 저장 공간이 없으면 조용히 넘어간다. 내보내기는 계속 동작한다.
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [plan]);

  const update = useCallback((updater: (current: Plan) => Plan) => {
    setPlanState((current) => (current ? updater(current) : current));
  }, []);

  const actions = useMemo<PlanActions>(() => {
    const mapTopics = (
      current: Plan,
      topicId: string,
      updater: (topic: PlanTopic) => PlanTopic,
    ): Plan => ({
      ...current,
      topics: current.topics.map((topic) => (topic.id === topicId ? updater(topic) : topic)),
    });

    return {
      setPlan: (next) => setPlanState(clampPlanSchedules(next)),
      patchPlan: (patch) =>
        update((current) => clampPlanSchedules({ ...current, ...patch })),
      addTopic: (afterTopicId) => {
        const topic = createTopic({ name: "" });
        update((current) => {
          const index = afterTopicId
            ? current.topics.findIndex((t) => t.id === afterTopicId)
            : -1;
          const topics = [...current.topics];
          if (index >= 0) topics.splice(index + 1, 0, topic);
          else topics.push(topic);
          return { ...current, topics };
        });
        return topic.id;
      },
      patchTopic: (topicId, patch) =>
        update((current) => mapTopics(current, topicId, (topic) => ({ ...topic, ...patch }))),
      removeTopic: (topicId) =>
        update((current) => ({
          ...current,
          topics: current.topics.filter((topic) => topic.id !== topicId),
        })),
      moveTopic: (topicId, direction) =>
        update((current) => {
          const index = current.topics.findIndex((topic) => topic.id === topicId);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= current.topics.length) return current;
          const topics = [...current.topics];
          [topics[index], topics[target]] = [topics[target], topics[index]];
          return { ...current, topics };
        }),
      addItem: (topicId, afterItemId) => {
        const item = createItem();
        update((current) =>
          mapTopics(current, topicId, (topic) => {
            const index = afterItemId ? topic.items.findIndex((i) => i.id === afterItemId) : -1;
            const items = [...topic.items];
            if (index >= 0) items.splice(index + 1, 0, item);
            else items.push(item);
            return { ...topic, items };
          }),
        );
        return item.id;
      },
      patchItem: (topicId, itemId, patch) =>
        update((current) =>
          mapTopics(current, topicId, (topic) => ({
            ...topic,
            items: topic.items.map((item) =>
              item.id === itemId ? { ...item, ...patch } : item,
            ),
          })),
        ),
      removeItem: (topicId, itemId) =>
        update((current) =>
          mapTopics(current, topicId, (topic) => ({
            ...topic,
            items: topic.items.filter((item) => item.id !== itemId),
          })),
        ),
      moveItem: (topicId, itemId, direction) =>
        update((current) =>
          mapTopics(current, topicId, (topic) => {
            const index = topic.items.findIndex((item) => item.id === itemId);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= topic.items.length) return topic;
            const items = [...topic.items];
            [items[index], items[target]] = [items[target], items[index]];
            return { ...topic, items };
          }),
        ),
      reset: (mode) =>
        setPlanState((current) => {
          if (mode === "sample") return samplePlan();
          return {
            ...samplePlan(),
            topics: [],
            weekStart: current?.weekStart ?? samplePlan().weekStart,
            title: "주간 연구 추진 계획",
          };
        }),
    };
  }, [update]);

  return { plan, actions, loading: plan === null };
}
