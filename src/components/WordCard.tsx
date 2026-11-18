"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BookmarkCheck,
  Calendar,
  Check,
  ChevronDown,
  ExternalLink,
  FolderInput,
  FolderOpen,
  GripVertical,
  History,
  Trash2,
  Volume2,
} from "lucide-react";
import { formatReadableDate, type TopicRecord } from "@/lib/db";
import type { ReshapedWordView } from "@/lib/dictionary";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MoveTopicMenuProps {
  wordLabel: string;
  topics: TopicRecord[];
  currentTopicId: number;
  onMoveTopic: (targetTopicId: number) => void;
}

function MoveTopicMenu({
  wordLabel,
  topics,
  currentTopicId,
  onMoveTopic,
}: MoveTopicMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen]);

  const currentTopic = topics.find((t) => t.id === currentTopicId);

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Move ${wordLabel} to topic`}
        className={cn(
          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all sm:h-7",
          isOpen
            ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
            : "border-border bg-card-solid/90 text-foreground hover:border-primary/50 hover:text-primary"
        )}
      >
        <FolderInput className="h-3 w-3 text-primary" />
        <span className="max-w-[100px] truncate">
          {currentTopic?.name ?? "Move"}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform duration-150",
            isOpen && "rotate-180 text-primary"
          )}
        />
      </button>

      {isOpen ? (
        <div
          role="listbox"
          aria-label={`Select destination topic for ${wordLabel}`}
          className="absolute left-0 z-50 mt-1.5 w-52 max-w-[calc(100vw-3rem)] rounded-2xl border border-border bg-card-solid p-1.5 shadow-[0_20px_48px_-12px_rgba(15,20,25,0.28)] ring-1 ring-black/5 backdrop-blur-xl animate-word-drop dark:ring-white/10 dark:shadow-[0_24px_55px_-12px_rgba(0,0,0,0.9)] sm:left-auto sm:right-0"
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Move to topic
          </div>
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {topics.map((topic) => {
              if (topic.id === undefined) return null;
              const isCurrent = topic.id === currentTopicId;
              return (
                <button
                  key={topic.id}
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => {
                    setIsOpen(false);
                    if (!isCurrent) {
                      onMoveTopic(topic.id!);
                    }
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                    isCurrent
                      ? "bg-primary/12 font-semibold text-primary"
                      : "text-foreground hover:bg-muted/80"
                  )}
                >
                  <span className="truncate">{topic.name}</span>
                  {isCurrent ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface WordCardProps {
  view: ReshapedWordView;
  topicName?: string;
  dateKey?: string;
  previousDateKey?: string | null;
  wasExisting?: boolean;
  faded?: boolean;
  animateDrop?: boolean;
  onWordClick?: (word: string) => void;
  onDelete?: () => void;
  topics?: TopicRecord[];
  currentTopicId?: number;
  onMoveTopic?: (targetTopicId: number) => void;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
}

export function WordCard({
  view,
  topicName,
  dateKey,
  previousDateKey,
  wasExisting = false,
  faded = false,
  animateDrop = false,
  onWordClick,
  onDelete,
  topics,
  currentTopicId,
  onMoveTopic,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: WordCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const handlePlayAudio = () => {
    if (!view.audioUrl) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(view.audioUrl);
    audioRef.current = audio;
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    void audio.play().catch(() => setIsPlaying(false));
  };

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative rounded-2xl border p-4 sm:p-6 backdrop-blur-md transition-all duration-300 ease-out",
        animateDrop && "animate-word-drop",
        draggable && "sm:cursor-grab sm:active:cursor-grabbing",
        isDragging && "opacity-45 scale-[0.98] ring-2 ring-primary/50",
        faded
          ? [
              "verba-card-faded border-border/90 bg-card shadow-xs",
              "hover:bg-white/95 hover:border-primary/60 hover:shadow-[0_22px_48px_-14px_rgba(29,155,240,0.34)]",
              "dark:hover:bg-[#16181c]/95 dark:hover:border-primary/60 dark:hover:shadow-[0_22px_48px_-14px_rgba(29,155,240,0.28)]",
            ]
          : "border-border/90 bg-card shadow-[0_14px_38px_-16px_rgba(15,20,25,0.22)] dark:shadow-[0_16px_40px_-14px_rgba(0,0,0,0.75)]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          {draggable ? (
            <span
              title="Drag to move to another topic folder"
              aria-hidden="true"
              className="hidden h-7 w-5 items-center justify-center rounded-md text-muted-foreground/60 transition-colors group-hover:text-primary sm:inline-flex"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          ) : null}

          <h2 className="text-xl font-bold tracking-tight capitalize break-words [overflow-wrap:anywhere] text-foreground transition-colors duration-200 sm:text-3xl">
            {view.word}
          </h2>

          {view.phonetic ? (
            <span className="max-w-full break-all rounded-lg bg-muted/90 px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary sm:break-normal sm:text-sm">
              {view.phonetic}
            </span>
          ) : null}

          {view.audioUrl ? (
            <button
              type="button"
              onClick={handlePlayAudio}
              aria-label={`Play pronunciation for ${view.word}`}
              title="Listen to pronunciation"
              className={cn(
                "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition-all sm:h-8 sm:w-8",
                isPlaying
                  ? "border-primary bg-primary text-white scale-105"
                  : "border-border bg-card-solid/80 text-foreground hover:border-primary hover:text-primary"
              )}
            >
              <Volume2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {wasExisting && previousDateKey ? (
            <Badge variant="violet" className="transition-all">
              <History className="h-3 w-3" />
              <span>Previously saved on {formatReadableDate(previousDateKey)}</span>
            </Badge>
          ) : null}

          {topicName ? (
            <Badge
              variant="outline"
              className={cn(
                "bg-background/60 transition-colors",
                faded &&
                  "group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary"
              )}
            >
              <FolderOpen className="h-3 w-3 text-primary" />
              <span>{topicName}</span>
            </Badge>
          ) : null}

          {dateKey ? (
            <Badge variant="secondary" className="text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatReadableDate(dateKey)}</span>
            </Badge>
          ) : null}

          {view.source === "freedictionaryapi" ? (
            <Badge
              variant="outline"
              title="Retrieved via FreeDictionaryAPI (Wiktionary backup)"
              className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            >
              <span>Wiktionary Fallback</span>
              {view.sourceUrl ? (
                <a
                  href={view.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open Wiktionary source"
                  className="hover:opacity-75"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </Badge>
          ) : view.source === "wikipedia" ? (
            <Badge
              variant="outline"
              title="Retrieved from Wikipedia reference summary"
              className="border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300"
            >
              <span>Wikipedia</span>
              {view.sourceUrl ? (
                <a
                  href={view.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open Wikipedia article"
                  className="hover:opacity-75"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </Badge>
          ) : view.source === "datamuse" ? (
            <Badge
              variant="outline"
              title="Retrieved via Datamuse lexical database"
              className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
            >
              <span>Datamuse Fallback</span>
            </Badge>
          ) : null}

          {topics &&
          topics.length > 1 &&
          onMoveTopic &&
          currentTopicId !== undefined ? (
            <MoveTopicMenu
              wordLabel={view.word}
              topics={topics}
              currentTopicId={currentTopicId}
              onMoveTopic={onMoveTopic}
            />
          ) : null}

          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Move ${view.word} to Trash`}
              title="Move to Trash"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive sm:h-7 sm:w-7"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {view.simpleDefinition ? (
        <div
          className={cn(
            "mt-4 rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed transition-colors duration-200",
            faded
              ? "border-border/70 bg-muted/40 text-foreground group-hover:border-primary/35 group-hover:bg-primary/8"
              : "border-primary/25 bg-primary/8 text-foreground"
          )}
        >
          <span className="mr-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            In plain English:
          </span>
          <span>{view.simpleDefinition}</span>
        </div>
      ) : null}

      <div className="mt-4 space-y-5">
        {view.meanings.map((meaning, mIdx) => (
          <section
            key={`${meaning.partOfSpeech}-${mIdx}`}
            className="space-y-2.5"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors duration-200",
                  faded
                    ? "bg-slate-200/80 text-slate-700 group-hover:bg-primary/15 group-hover:text-primary dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-primary/20 dark:group-hover:text-sky-300"
                    : "bg-primary/14 text-primary"
                )}
              >
                {meaning.partOfSpeech}
              </span>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <ol className="space-y-2.5 pl-1">
              {meaning.definitions.map((def, dIdx) => (
                <li
                  key={`${mIdx}-${dIdx}`}
                  className="flex gap-2.5 text-sm leading-relaxed sm:text-[15px]"
                >
                  <span className="mt-0.5 font-mono text-xs font-semibold text-muted-foreground transition-colors group-hover:text-primary">
                    {dIdx + 1}.
                  </span>
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-foreground transition-colors duration-200">
                      {def.definition}
                    </p>
                    {def.example ? (
                      <p className="border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground transition-colors group-hover:border-primary sm:text-sm">
                        &ldquo;{def.example}&rdquo;
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            {meaning.synonyms.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Synonyms:
                </span>
                {meaning.synonyms.map((syn) =>
                  onWordClick ? (
                    <button
                      key={syn}
                      type="button"
                      onClick={() => onWordClick(syn)}
                      className={cn(
                        "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                        faded
                          ? "border-border bg-muted/60 text-muted-foreground group-hover:border-primary/35 group-hover:bg-primary/10 group-hover:text-primary hover:!bg-primary hover:!text-white"
                          : "border-primary/25 bg-primary/10 text-primary hover:bg-primary hover:text-white"
                      )}
                    >
                      {syn}
                    </button>
                  ) : (
                    <span
                      key={syn}
                      className="rounded-full border border-border bg-muted/70 px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {syn}
                    </span>
                  )
                )}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      {!onDelete ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BookmarkCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Saved locally in your IndexedDB Vault</span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {view.enrichedSources && view.enrichedSources.length > 0 ? (
              <span>Sources: {view.enrichedSources.join(", ")}</span>
            ) : null}
            {view.totalDefinitions > 0 ? (
              <span>
                ({view.meanings.length}/{view.totalMeanings} parts of speech)
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
    </article>
  );
}
