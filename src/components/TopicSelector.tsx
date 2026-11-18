"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FolderOpen, Plus } from "lucide-react";
import type { TopicRecord, WordRecord } from "@/lib/db";
import { cn } from "@/lib/utils";

interface TopicSelectorProps {
  topics: TopicRecord[];
  words: WordRecord[];
  activeTopicId: number | null;
  onSelectTopic: (topicId: number) => void;
  onCreateTopic: (name: string) => Promise<number>;
}

export function TopicSelector({
  topics,
  words,
  activeTopicId,
  onSelectTopic,
  onCreateTopic,
}: TopicSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const activeTopic =
    topics.find((t) => t.id === activeTopicId) ?? topics[0] ?? null;

  const countsByTopic = new Map<number, number>();
  for (const word of words) {
    countsByTopic.set(word.topicId, (countsByTopic.get(word.topicId) ?? 0) + 1);
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = newTopicName.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      const createdId = await onCreateTopic(trimmed);
      onSelectTopic(createdId);
      setNewTopicName("");
      setIsOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-xs backdrop-blur-md transition-all",
          isOpen
            ? "border-primary bg-card-solid text-foreground ring-2 ring-primary/20"
            : "border-border/80 bg-card/85 text-foreground hover:border-primary/60 hover:bg-card-solid"
        )}
      >
        <FolderOpen className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">Topic:</span>
        <span className="max-w-[160px] truncate font-semibold sm:max-w-[140px]">
          {activeTopic?.name ?? "General"}
        </span>
        {activeTopic?.id !== undefined ? (
          <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
            {countsByTopic.get(activeTopic.id) ?? 0}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
            isOpen && "rotate-180 text-primary"
          )}
        />
      </button>

      {isOpen ? (
        <div className="absolute left-1/2 z-50 mt-2 w-[min(18rem,calc(100vw-1.75rem))] -translate-x-1/2 rounded-2xl border border-border bg-card-solid p-2 shadow-[0_22px_50px_-12px_rgba(15,20,25,0.28)] ring-1 ring-black/5 backdrop-blur-xl animate-word-drop dark:ring-white/10 dark:shadow-[0_24px_55px_-12px_rgba(0,0,0,0.9)] sm:left-0 sm:w-72 sm:translate-x-0">
          <div className="mb-1.5 px-2.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Save lookups into topic
          </div>
          <div
            role="listbox"
            className="max-h-56 space-y-1 overflow-y-auto pr-0.5"
          >
            {topics.map((topic) => {
              if (topic.id === undefined) return null;
              const isSelected = topic.id === activeTopic?.id;
              const count = countsByTopic.get(topic.id) ?? 0;
              return (
                <button
                  key={topic.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelectTopic(topic.id!);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-primary/12 font-semibold text-primary"
                      : "text-foreground hover:bg-muted/80"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-primary transition-opacity",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{topic.name}</span>
                  </span>
                  <span
                    className={cn(
                      "ml-2 rounded-full px-2 py-0.5 text-xs tabular-nums",
                      isSelected
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <form
            onSubmit={handleCreate}
            className="mt-2 flex items-center gap-1.5 border-t border-border pt-2"
          >
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="New topic (e.g. LotR)..."
              className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background/80 px-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:h-8 sm:text-xs"
            />
            <button
              type="submit"
              disabled={!newTopicName.trim() || isCreating}
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-primary px-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
