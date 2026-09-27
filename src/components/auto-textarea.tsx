"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type AutoTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
};

/** 내용에 맞춰 높이가 자동으로 늘어나는 입력칸. 마인드맵 노드 안에서 사용한다. */
export function AutoTextarea({ value, className, ...props }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      spellCheck={false}
      className={cn(
        "w-full resize-none overflow-hidden bg-transparent outline-none",
        "placeholder:text-muted-foreground/60",
        className,
      )}
      {...props}
    />
  );
}
