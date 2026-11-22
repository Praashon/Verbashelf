"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BookmarkCheck,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ExternalLink,
  FolderInput,
  FolderOpen,
  GripVertical,
  History,
  Mic,
  NotebookPen,
  Pencil,
  Sparkles,
  Square,
  StickyNote,
  Trash2,
  Volume2,
} from "lucide-react";
import { formatReadableDate, type TopicRecord } from "@/lib/db";
import type { ReshapedWordView } from "@/lib/dictionary";
import { speakWord, stopPronunciation } from "@/lib/pronunciation";
import { cn } from "@/lib/utils";
import { PronunciationPractice } from "@/components/PronunciationPractice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  note?: string;
  customExample?: string;
  dueBadge?: string;
  isDue?: boolean;
  onSaveNotes?: (patch: {
    note: string;
    customExample: string;
  }) => Promise<void> | void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  wordDomId?: number;
  isFocused?: boolean;
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
  note,
  customExample,
  dueBadge,
  isDue = false,
  onSaveNotes,
  selectable = false,
  selected = false,
  onToggleSelect,
  wordDomId,
  isFocused = false,
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
  const [isPracticeOpen, setIsPracticeOpen] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [draftExample, setDraftExample] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPronunciation();
    };
  }, []);

  const handlePlayAudio = () => {
    if (isPlaying) {
      stopPronunciation();
      setIsPlaying(false);
      return;
    }

    void speakWord({
      word: view.word,
      audioUrl: view.audioUrl,
      onStart: () => {
        if (mountedRef.current) {
          setIsPlaying(true);
        }
      },
      onEnd: () => {
        if (mountedRef.current) {
          setIsPlaying(false);
        }
      },
    });
  };

  const openNoteEditor = () => {
    setDraftNote(note ?? "");
    setDraftExample(customExample ?? "");
    setIsEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    if (!onSaveNotes) return;
    setIsSavingNotes(true);
    try {
      await onSaveNotes({
        note: draftNote.trim(),
        customExample: draftExample.trim(),
      });
      if (mountedRef.current) {
        setIsEditingNotes(false);
      }
    } finally {
      if (mountedRef.current) {
        setIsSavingNotes(false);
      }
    }
  };

  const handleClearNotes = async () => {
    if (!onSaveNotes) return;
    setIsSavingNotes(true);
    try {
      await onSaveNotes({ note: "", customExample: "" });
      if (mountedRef.current) {
        setDraftNote("");
        setDraftExample("");
        setIsEditingNotes(false);
      }
    } finally {
      if (mountedRef.current) {
        setIsSavingNotes(false);
      }
    }
  };

  const hasSavedNote = Boolean(note?.trim() || customExample?.trim());

  return (
    <article
      data-word-id={wordDomId}
      draggable={draggable && !selectable && !isEditingNotes}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative rounded-2xl border p-4 sm:p-6 backdrop-blur-md transition-all duration-300 ease-out",
        animateDrop && "animate-word-drop",
        draggable && !selectable && "sm:cursor-grab sm:active:cursor-grabbing",
        isDragging && "opacity-45 scale-[0.98] ring-2 ring-primary/50",
        selected && "ring-2 ring-primary border-primary/70",
        isFocused && !selected && "ring-2 ring-primary/65 border-primary/60",
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
          {selectable && onToggleSelect ? (
            <button
              type="button"
              onClick={onToggleSelect}
              aria-pressed={selected}
              aria-label={
                selected ? `Deselect ${view.word}` : `Select ${view.word}`
              }
              className={cn(
                "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors sm:h-7 sm:w-7",
                selected
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card-solid/80 text-muted-foreground hover:border-primary/50 hover:text-primary"
              )}
            >
              {selected ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
          ) : draggable ? (
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

          <button
            type="button"
            onClick={handlePlayAudio}
            aria-label={
              isPlaying
                ? `Stop pronunciation for ${view.word}`
                : `Play pronunciation for ${view.word}`
            }
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

          <button
            type="button"
            onClick={() => setIsPracticeOpen((prev) => !prev)}
            aria-expanded={isPracticeOpen}
            aria-label={`Practice pronouncing ${view.word}`}
            title="Record and compare pronunciation"
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-all",
              isPracticeOpen
                ? "border-primary bg-primary/12 text-primary"
                : "border-border bg-card-solid/80 text-muted-foreground hover:border-primary hover:text-primary"
            )}
          >
            <Mic className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Practice</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {wasExisting && previousDateKey ? (
            <Badge variant="violet" className="transition-all">
              <History className="h-3 w-3" />
              <span>Previously saved on {formatReadableDate(previousDateKey)}</span>
            </Badge>
          ) : null}

          {dueBadge ? (
            <Badge
              variant={
                dueBadge === "New"
                  ? "violet"
                  : isDue
                    ? "outline"
                    : "secondary"
              }
              className={cn(
                isDue &&
                  dueBadge !== "New" &&
                  "border-primary/40 bg-primary/10 text-primary",
                !isDue && "text-muted-foreground"
              )}
            >
              <Sparkles className="h-3 w-3" />
              <span>{dueBadge}</span>
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

      {isPracticeOpen ? (
        <PronunciationPractice
          word={view.word}
          audioUrl={view.audioUrl}
          phonetic={view.phonetic}
          onClose={() => setIsPracticeOpen(false)}
        />
      ) : null}

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

            {meaning.antonyms.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Antonyms:
                </span>
                {meaning.antonyms.map((ant) =>
                  onWordClick ? (
                    <button
                      key={ant}
                      type="button"
                      onClick={() => onWordClick(ant)}
                      className="cursor-pointer rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-700 transition-all hover:bg-rose-500 hover:text-white dark:text-rose-300"
                    >
                      {ant}
                    </button>
                  ) : (
                    <span
                      key={ant}
                      className="rounded-full border border-rose-500/25 bg-rose-500/8 px-2.5 py-0.5 text-xs text-rose-700 dark:text-rose-300"
                    >
                      {ant}
                    </span>
                  )
                )}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      {view.relatedWords && view.relatedWords.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
          <span className="text-xs font-medium text-muted-foreground">
            Also see:
          </span>
          {view.relatedWords.map((rel) =>
            onWordClick ? (
              <button
                key={rel}
                type="button"
                onClick={() => onWordClick(rel)}
                className="cursor-pointer rounded-full border border-[#63e]/25 bg-[#63e]/10 px-2.5 py-0.5 text-xs font-medium text-[#5227cc] transition-all hover:bg-[#63e] hover:text-white dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-300"
              >
                {rel}
              </button>
            ) : (
              <span
                key={rel}
                className="rounded-full border border-[#63e]/25 bg-[#63e]/10 px-2.5 py-0.5 text-xs text-[#5227cc] dark:text-violet-300"
              >
                {rel}
              </span>
            )
          )}
        </div>
      ) : null}

      {onSaveNotes || hasSavedNote ? (
        <div className="mt-4 border-t border-border/50 pt-3">
          {isEditingNotes ? (
            <div className="space-y-2.5 rounded-xl border border-primary/30 bg-background/80 p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <NotebookPen className="h-3.5 w-3.5 text-primary" />
                  <span>Personal Note &amp; Mnemonic</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Ctrl+Enter to save
                </span>
              </div>

              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    void handleSaveNotes();
                  } else if (e.key === "Escape") {
                    setIsEditingNotes(false);
                  }
                }}
                rows={2}
                placeholder="Write a memory hook, root word clue, or personal reminder..."
                aria-label={`Personal note for ${view.word}`}
                className="w-full rounded-lg border border-border bg-card-solid px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm"
              />

              <input
                type="text"
                value={draftExample}
                onChange={(e) => setDraftExample(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    void handleSaveNotes();
                  } else if (e.key === "Escape") {
                    setIsEditingNotes(false);
                  }
                }}
                placeholder="Optional: write your own example sentence..."
                aria-label={`Personal example sentence for ${view.word}`}
                className="h-9 w-full rounded-lg border border-border bg-card-solid px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  {hasSavedNote ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isSavingNotes}
                      onClick={() => void handleClearNotes()}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <span>Clear Note</span>
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSavingNotes}
                    onClick={() => setIsEditingNotes(false)}
                  >
                    <span>Cancel</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isSavingNotes}
                    onClick={() => void handleSaveNotes()}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isSavingNotes ? "Saving..." : "Save Note"}</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : hasSavedNote ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    <StickyNote className="h-3 w-3" />
                    <span>My Note &amp; Mnemonic</span>
                  </span>
                  {note?.trim() ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {note}
                    </p>
                  ) : null}
                  {customExample?.trim() ? (
                    <p className="border-l-2 border-amber-500/50 pl-2.5 text-xs italic text-muted-foreground sm:text-sm">
                      My example: &ldquo;{customExample}&rdquo;
                    </p>
                  ) : null}
                </div>

                {onSaveNotes ? (
                  <button
                    type="button"
                    onClick={openNoteEditor}
                    aria-label={`Edit personal note for ${view.word}`}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-border/80 bg-card-solid/90 px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : onSaveNotes ? (
            <button
              type="button"
              onClick={openNoteEditor}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <NotebookPen className="h-3.5 w-3.5" />
              <span>Add note / mnemonic</span>
            </button>
          ) : null}
        </div>
      ) : null}

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
