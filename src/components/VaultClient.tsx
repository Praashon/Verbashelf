"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  FolderInput,
  FolderOpen,
  GraduationCap,
  Library,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAppUI } from "@/app/Providers";
import { useVault } from "@/hooks/useVault";
import { exportSelectedWordsBackup } from "@/lib/backup";
import {
  exportWordsAsAnkiTxt,
  exportWordsAsCsv,
} from "@/lib/portability";
import { speakWord } from "@/lib/pronunciation";
import {
  DEFAULT_TOPIC_NAME,
  formatReadableDate,
  type TrashWordRecord,
  type WordRecord,
} from "@/lib/db";
import {
  extractConciseSummary,
  reshapeDictionaryEntry,
  type DisplayMode,
} from "@/lib/dictionary";
import {
  formatDueBadge,
  hasPersonalNotes,
  isWordDue,
  MS_PER_DAY,
} from "@/lib/srs";
import { cn } from "@/lib/utils";
import { PreferenceBar } from "@/components/PreferenceBar";
import { StatsStrip } from "@/components/StatsStrip";
import { WordCard } from "@/components/WordCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TopicExportMenuProps {
  topicName: string;
  onExportAnki: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
}

function TopicExportMenu({
  topicName,
  onExportAnki,
  onExportCsv,
  onExportJson,
}: TopicExportMenuProps) {
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

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Export words from ${topicName}`}
        title={`Export ${topicName}`}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
          isOpen
            ? "border-primary bg-primary/12 text-primary"
            : "border-border bg-background/80 text-foreground hover:border-primary/50 hover:text-primary"
        )}
      >
        <Download className="h-3 w-3 text-primary" />
        <span className="hidden sm:inline">Export</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label={`Export options for ${topicName}`}
          className="absolute right-0 z-50 mt-1.5 w-48 rounded-2xl border border-border bg-card-solid p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur-xl animate-word-drop dark:ring-white/10"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onExportAnki();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span>Anki Deck (.txt)</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onExportCsv();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span>CSV Sheet (.csv)</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onExportJson();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span>Topic Backup (.json)</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

type VaultViewMode = "topics" | "timeline" | "trash";
type VaultStatusFilter = "all" | "due" | "recent" | "notes";

interface DragState {
  wordId: number;
  term: string;
  fromTopicId: number;
}

function formatDeletedAt(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function VaultClient() {
  const router = useRouter();
  const {
    isProfileOpen,
    isSettingsOpen,
    isShareOpen,
    isOnboardingOpen,
    isCommandOpen,
    showToast,
  } = useAppUI();
  const {
    topics,
    words,
    trashWords,
    dueWords,
    dueCountByTopic,
    reviewNow,
    profile,
    topicNameById,
    createTopic,
    deleteTopic,
    deleteWord,
    restoreFromTrash,
    restoreTrashBatch,
    restoreAllTrash,
    permanentlyDeleteTrashItem,
    emptyTrash,
    moveWordToTopic,
    updateWordNotes,
    bulkMoveWords,
    bulkDeleteWords,
    updateProfile,
  } = useVault();

  const [viewMode, setViewMode] = useState<VaultViewMode>("topics");
  const [filterQuery, setFilterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VaultStatusFilter>("all");
  const [posFilter, setPosFilter] = useState<string>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set());
  const [bulkTargetTopicId, setBulkTargetTopicId] = useState<number | "">("");
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [collapsedTopics, setCollapsedTopics] = useState<Set<number>>(
    new Set()
  );
  const [newTopicName, setNewTopicName] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverTopicId, setDragOverTopicId] = useState<number | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [focusedWordId, setFocusedWordId] = useState<number | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const mode: DisplayMode = profile.defaultMode;
  const showExamples = profile.defaultExamples;
  const modalOpen =
    isProfileOpen ||
    isSettingsOpen ||
    isShareOpen ||
    isOnboardingOpen ||
    isCommandOpen;

  useEffect(() => {
    if (modalOpen) return;

    const handleGlobalSlash = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener("keydown", handleGlobalSlash);
    return () => window.removeEventListener("keydown", handleGlobalSlash);
  }, [modalOpen]);

  const availablePartsOfSpeech = useMemo(() => {
    const posSet = new Set<string>();
    for (const word of words) {
      for (const meaning of word.rawEntry.meanings) {
        const pos = meaning.partOfSpeech.trim().toLowerCase();
        if (pos) posSet.add(pos);
      }
    }
    return Array.from(posSet).sort((a, b) => a.localeCompare(b));
  }, [words]);

  const recentCutoff = reviewNow > 0 ? reviewNow - 7 * MS_PER_DAY : 0;

  const statusCounts = useMemo(() => {
    let recent = 0;
    let notes = 0;
    for (const word of words) {
      if (reviewNow > 0 && word.createdAt >= recentCutoff) {
        recent += 1;
      }
      if (hasPersonalNotes(word)) {
        notes += 1;
      }
    }
    return {
      due: dueWords.length,
      recent,
      notes,
    };
  }, [words, dueWords.length, reviewNow, recentCutoff]);

  const filteredWords = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();

    return words.filter((word) => {
      if (statusFilter === "due") {
        if (reviewNow === 0 || !isWordDue(word, reviewNow)) return false;
      } else if (statusFilter === "recent") {
        if (reviewNow === 0 || word.createdAt < recentCutoff) return false;
      } else if (statusFilter === "notes") {
        if (!hasPersonalNotes(word)) return false;
      }

      if (
        posFilter !== "all" &&
        !word.rawEntry.meanings.some(
          (m) => m.partOfSpeech.trim().toLowerCase() === posFilter
        )
      ) {
        return false;
      }

      if (!q) return true;
      if (word.term.toLowerCase().includes(q)) return true;
      const topicName = (topicNameById.get(word.topicId) ?? "").toLowerCase();
      if (topicName.includes(q)) return true;
      if (word.note?.toLowerCase().includes(q)) return true;
      if (word.customExample?.toLowerCase().includes(q)) return true;
      if (word.rawEntry.simpleDefinition?.toLowerCase().includes(q)) {
        return true;
      }

      return word.rawEntry.meanings.some(
        (m) =>
          m.partOfSpeech.toLowerCase().includes(q) ||
          m.synonyms.some((syn) => syn.toLowerCase().includes(q)) ||
          m.definitions.some(
            (d) =>
              d.definition.toLowerCase().includes(q) ||
              (d.example?.toLowerCase().includes(q) ?? false)
          )
      );
    });
  }, [
    words,
    filterQuery,
    statusFilter,
    posFilter,
    reviewNow,
    recentCutoff,
    topicNameById,
  ]);

  const filteredTrash = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return trashWords;
    return trashWords.filter((item) => {
      if (item.term.toLowerCase().includes(q)) return true;
      if (item.originalTopicName.toLowerCase().includes(q)) return true;
      if (item.note?.toLowerCase().includes(q)) return true;
      if (item.customExample?.toLowerCase().includes(q)) return true;
      if (item.rawEntry.simpleDefinition?.toLowerCase().includes(q)) {
        return true;
      }
      return item.rawEntry.meanings.some((m) =>
        m.definitions.some((d) => d.definition.toLowerCase().includes(q))
      );
    });
  }, [trashWords, filterQuery]);

  const wordsByTopic = useMemo(() => {
    const map = new Map<number, WordRecord[]>();
    for (const word of filteredWords) {
      const list = map.get(word.topicId) ?? [];
      list.push(word);
      map.set(word.topicId, list);
    }
    return map;
  }, [filteredWords]);

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, WordRecord[]>();
    for (const word of filteredWords) {
      const list = groups.get(word.dateKey) ?? [];
      list.push(word);
      groups.set(word.dateKey, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredWords]);

  const existingWordIdSet = useMemo(() => {
    const set = new Set<number>();
    for (const word of words) {
      if (word.id !== undefined) set.add(word.id);
    }
    return set;
  }, [words]);

  const activeSelectedIds = useMemo(
    () => Array.from(selectedWordIds).filter((id) => existingWordIdSet.has(id)),
    [selectedWordIds, existingWordIdSet]
  );

  const selectedRecords = useMemo(() => {
    const idSet = new Set(activeSelectedIds);
    return words.filter((w) => w.id !== undefined && idSet.has(w.id));
  }, [words, activeSelectedIds]);

  const hasActiveFilters =
    filterQuery.trim() !== "" ||
    statusFilter !== "all" ||
    posFilter !== "all";

  const resetAllFilters = () => {
    setFilterQuery("");
    setStatusFilter("all");
    setPosFilter("all");
  };

  const toggleWordSelection = (wordId: number) => {
    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      return next;
    });
  };

  const toggleTopicSelection = (topicWords: WordRecord[]) => {
    const ids = topicWords
      .map((w) => w.id)
      .filter((id): id is number => id !== undefined);
    if (ids.length === 0) return;

    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    const next = new Set(selectedWordIds);
    for (const w of filteredWords) {
      if (w.id !== undefined) next.add(w.id);
    }
    setSelectedWordIds(next);
  };

  const clearSelection = () => {
    setSelectedWordIds(new Set());
  };

  const handleBulkMove = async () => {
    if (activeSelectedIds.length === 0 || bulkTargetTopicId === "") return;
    setIsBulkBusy(true);
    try {
      const moved = await bulkMoveWords(activeSelectedIds, bulkTargetTopicId);
      const destName = topicNameById.get(bulkTargetTopicId) ?? "General";
      clearSelection();
      setSelectionMode(false);
      showToast(
        `Moved ${moved} ${moved === 1 ? "word" : "words"} to ${destName}.`,
        "success"
      );
    } finally {
      setIsBulkBusy(false);
    }
  };

  const handleBulkExport = () => {
    if (selectedRecords.length === 0) return;
    const filename = exportSelectedWordsBackup(selectedRecords, topics, profile);
    showToast(`Exported ${filename}`, "success");
  };

  const handleBulkDelete = async () => {
    if (activeSelectedIds.length === 0) return;
    setIsBulkBusy(true);
    try {
      const trashIds = await bulkDeleteWords(activeSelectedIds);
      clearSelection();
      setSelectionMode(false);
      if (trashIds.length > 0) {
        showToast(
          `Moved ${trashIds.length} ${trashIds.length === 1 ? "word" : "words"} to Trash.`,
          "info",
          {
            label: "Undo",
            onClick: () => {
              void restoreTrashBatch(trashIds).then((restoredCount) => {
                showToast(
                  `Restored ${restoredCount} ${restoredCount === 1 ? "word" : "words"} to Vault.`,
                  "success"
                );
              });
            },
          }
        );
      }
    } finally {
      setIsBulkBusy(false);
    }
  };

  const toggleTopicCollapse = (topicId: number) => {
    setCollapsedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const handleCreateTopic = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = newTopicName.trim();
    if (!trimmed) return;
    await createTopic(trimmed);
    setNewTopicName("");
    showToast(`Topic "${trimmed}" ready.`, "success");
  };

  const handleWordMove = async (
    wordId: number,
    term: string,
    targetTopicId: number
  ) => {
    await moveWordToTopic(wordId, targetTopicId);
    const destName = topicNameById.get(targetTopicId) ?? "General";
    showToast(`Moved "${term}" to ${destName}.`, "success");
  };

  const handleSoftDelete = useCallback(
    async (word: WordRecord) => {
      if (word.id === undefined) return;
      const trashId = await deleteWord(word.id);
      if (trashId !== null) {
        showToast(`Moved "${word.term}" to Trash.`, "info", {
          label: "Undo",
          onClick: () => {
            void restoreFromTrash(trashId).then((restoredTerm) => {
              if (restoredTerm) {
                showToast(`Restored "${restoredTerm}" to Vault.`, "success");
              }
            });
          },
        });
      }
    },
    [deleteWord, restoreFromTrash, showToast]
  );

  const orderedVisibleWords = useMemo(() => {
    if (viewMode === "topics") {
      const list: WordRecord[] = [];
      for (const topic of topics) {
        if (topic.id === undefined || collapsedTopics.has(topic.id)) continue;
        const tWords = wordsByTopic.get(topic.id) ?? [];
        list.push(...tWords);
      }
      return list;
    }
    if (viewMode === "timeline") {
      return timelineGroups.flatMap(([, dateWords]) => dateWords);
    }
    return [];
  }, [viewMode, topics, collapsedTopics, wordsByTopic, timelineGroups]);

  const effectiveFocusedWordId = useMemo(() => {
    if (focusedWordId === null) return null;
    return orderedVisibleWords.some((w) => w.id === focusedWordId)
      ? focusedWordId
      : null;
  }, [focusedWordId, orderedVisibleWords]);

  useEffect(() => {
    if (modalOpen || viewMode === "trash") return;

    const scrollCardIntoView = (wordId: number) => {
      window.requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-word-id="${wordId}"]`
        );
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    };

    const handleVaultNavKeys = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (event.key === "Escape") {
        setFocusedWordId(null);
        if (selectionMode) {
          setSelectionMode(false);
          setSelectedWordIds(new Set());
        }
        return;
      }

      if (orderedVisibleWords.length === 0) return;

      const currentIdx =
        effectiveFocusedWordId !== null
          ? orderedVisibleWords.findIndex(
              (w) => w.id === effectiveFocusedWordId
            )
          : -1;

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        const nextIdx =
          currentIdx < 0 ? 0 : (currentIdx + 1) % orderedVisibleWords.length;
        const nextId = orderedVisibleWords[nextIdx]?.id;
        if (nextId !== undefined) {
          setFocusedWordId(nextId);
          scrollCardIntoView(nextId);
        }
        return;
      }

      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        const nextIdx =
          currentIdx < 0
            ? orderedVisibleWords.length - 1
            : (currentIdx - 1 + orderedVisibleWords.length) %
              orderedVisibleWords.length;
        const nextId = orderedVisibleWords[nextIdx]?.id;
        if (nextId !== undefined) {
          setFocusedWordId(nextId);
          scrollCardIntoView(nextId);
        }
        return;
      }

      if (event.key === "G" && event.shiftKey) {
        event.preventDefault();
        const lastId = orderedVisibleWords[orderedVisibleWords.length - 1]?.id;
        if (lastId !== undefined) {
          setFocusedWordId(lastId);
          scrollCardIntoView(lastId);
        }
        return;
      }

      if (currentIdx < 0) return;
      const focusedWord = orderedVisibleWords[currentIdx];
      if (!focusedWord) return;

      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        void speakWord({
          word: focusedWord.term,
          audioUrl: focusedWord.audioUrl,
        });
        return;
      }

      if (event.key === "x" || event.key === "X") {
        if (focusedWord.id === undefined) return;
        event.preventDefault();
        setSelectionMode(true);
        toggleWordSelection(focusedWord.id);
        return;
      }

      if (event.key === "d") {
        event.preventDefault();
        void handleSoftDelete(focusedWord);
      }
    };

    window.addEventListener("keydown", handleVaultNavKeys);
    return () => window.removeEventListener("keydown", handleVaultNavKeys);
  }, [
    modalOpen,
    viewMode,
    orderedVisibleWords,
    effectiveFocusedWordId,
    selectionMode,
    handleSoftDelete,
  ]);

  const handleRestoreItem = async (item: TrashWordRecord) => {
    if (item.id === undefined) return;
    const term = await restoreFromTrash(item.id);
    if (term) {
      showToast(
        `Restored "${term}" to ${item.originalTopicName}.`,
        "success"
      );
    }
  };

  const handleRestoreAll = async () => {
    const count = await restoreAllTrash();
    setConfirmEmptyTrash(false);
    showToast(
      `Restored ${count} ${count === 1 ? "word" : "words"} back to Vault.`,
      "success"
    );
  };

  const handleEmptyTrash = async () => {
    await emptyTrash();
    setConfirmEmptyTrash(false);
    showToast("Trash emptied permanently.", "info");
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-3.5 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Library className="h-3.5 w-3.5" />
            <span>Personal Vocabulary Vault</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Your Saved Words &amp; Time Travel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {words.length} {words.length === 1 ? "word" : "words"} organized
            across {topics.length} {topics.length === 1 ? "topic" : "topics"}
            {dueWords.length > 0 ? ` · ${dueWords.length} due for review` : ""}
            {trashWords.length > 0 ? ` (${trashWords.length} in Trash)` : ""}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          {words.length > 0 ? (
            <Link
              href={dueWords.length > 0 ? "/study?mode=srs" : "/study"}
              prefetch={true}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>
                {dueWords.length > 0
                  ? `Review Due (${dueWords.length})`
                  : "Study Vault"}
              </span>
            </Link>
          ) : null}

          <div
            role="tablist"
            aria-label="Vault view mode"
            className="grid w-full grid-cols-3 rounded-full border border-border bg-card/85 p-1 shadow-xs backdrop-blur-md sm:inline-flex sm:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "topics"}
              onClick={() => setViewMode("topics")}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3.5",
                viewMode === "topics"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Topics</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "timeline"}
              onClick={() => setViewMode("timeline")}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3.5",
                viewMode === "timeline"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Time Travel</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "trash"}
              onClick={() => {
                setSelectionMode(false);
                setViewMode("trash");
              }}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3.5",
                viewMode === "trash"
                  ? "bg-destructive text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Trash</span>
              {trashWords.length > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    viewMode === "trash"
                      ? "bg-white/25 text-white"
                      : "bg-destructive/15 text-destructive"
                  )}
                >
                  {trashWords.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      <StatsStrip />

      <div className="mb-5 space-y-3 rounded-2xl border border-border/80 bg-card/80 p-3.5 shadow-xs backdrop-blur-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={
                viewMode === "trash"
                  ? "Search deleted words in Trash..."
                  : "Search words, definitions, examples, synonyms, notes, or topics (press /)..."
              }
              aria-label="Filter vault words"
              className="h-10 w-full rounded-xl border border-border bg-background/80 pl-9 pr-9 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:h-9 sm:text-sm"
            />
            {filterQuery ? (
              <button
                type="button"
                onClick={() => setFilterQuery("")}
                aria-label="Clear filter query"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {viewMode !== "trash" ? (
            <div className="flex flex-wrap items-center gap-2">
              <PreferenceBar
                mode={mode}
                onModeChange={(nextMode) =>
                  void updateProfile({ defaultMode: nextMode })
                }
                showExamples={showExamples}
                onShowExamplesChange={(checked) =>
                  void updateProfile({ defaultExamples: checked })
                }
              />
              {words.length > 0 ? (
                <Button
                  variant={selectionMode ? "primary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectionMode((prev) => !prev);
                    if (selectionMode) {
                      clearSelection();
                    }
                  }}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>{selectionMode ? "Done" : "Select"}</span>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {viewMode !== "trash" && words.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border/60 pt-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "all", label: `All (${words.length})` },
                  { id: "due", label: `Due (${statusCounts.due})` },
                  { id: "recent", label: `7d Recent (${statusCounts.recent})` },
                  { id: "notes", label: `Has Notes (${statusCounts.notes})` },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStatusFilter(pill.id)}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    statusFilter === pill.id
                      ? "border-primary bg-primary/12 text-primary font-semibold"
                      : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value)}
                aria-label="Filter by part of speech"
                className="h-8 rounded-full border border-border bg-background/85 px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
              >
                <option value="all">All parts of speech</option>
                {availablePartsOfSpeech.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>

              {hasActiveFilters ? (
                <Button variant="ghost" size="sm" onClick={resetAllFilters}>
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {viewMode !== "trash" && words.length > 0 ? (
          <p className="hidden border-t border-border/50 pt-2 text-[11px] text-muted-foreground sm:block">
            Power keys: <kbd className="rounded border border-border px-1 font-mono text-[10px]">j</kbd>/<kbd className="rounded border border-border px-1 font-mono text-[10px]">k</kbd> navigate &middot;{" "}
            <kbd className="rounded border border-border px-1 font-mono text-[10px]">s</kbd> speak &middot;{" "}
            <kbd className="rounded border border-border px-1 font-mono text-[10px]">x</kbd> select &middot;{" "}
            <kbd className="rounded border border-border px-1 font-mono text-[10px]">d</kbd> trash &middot;{" "}
            <kbd className="rounded border border-border px-1 font-mono text-[10px]">Ctrl+K</kbd> switch topic &middot;{" "}
            <kbd className="rounded border border-border px-1 font-mono text-[10px]">?</kbd> shortcuts
          </p>
        ) : null}
      </div>

      {selectionMode && viewMode !== "trash" ? (
        <div className="sticky top-16 z-20 mb-5 flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card-solid/95 p-3.5 shadow-lg backdrop-blur-md animate-word-drop sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="primary">
              <span>{activeSelectedIds.length} selected</span>
            </Badge>
            <Button variant="outline" size="sm" onClick={selectAllVisible}>
              <span>Select Visible ({filteredWords.length})</span>
            </Button>
            {activeSelectedIds.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <span>Clear</span>
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {topics.length > 1 ? (
              <div className="flex items-center gap-1.5">
                <select
                  value={bulkTargetTopicId === "" ? "" : String(bulkTargetTopicId)}
                  onChange={(e) =>
                    setBulkTargetTopicId(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  aria-label="Destination topic for selected words"
                  className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">Move to topic...</option>
                  {topics.map((t) =>
                    t.id !== undefined ? (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ) : null
                  )}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    isBulkBusy ||
                    activeSelectedIds.length === 0 ||
                    bulkTargetTopicId === ""
                  }
                  onClick={() => void handleBulkMove()}
                >
                  <FolderInput className="h-3.5 w-3.5 text-primary" />
                  <span>Move</span>
                </Button>
              </div>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              disabled={isBulkBusy || activeSelectedIds.length === 0}
              onClick={handleBulkExport}
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>Backup (.json)</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={isBulkBusy || activeSelectedIds.length === 0}
              onClick={() => {
                if (selectedRecords.length === 0) return;
                const filename = exportWordsAsAnkiTxt(
                  selectedRecords,
                  topicNameById,
                  "selected"
                );
                showToast(`Exported ${filename}`, "success");
              }}
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>Anki (.txt)</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={isBulkBusy || activeSelectedIds.length === 0}
              onClick={() => {
                if (selectedRecords.length === 0) return;
                const filename = exportWordsAsCsv(
                  selectedRecords,
                  topicNameById,
                  "selected"
                );
                showToast(`Exported ${filename}`, "success");
              }}
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>CSV (.csv)</span>
            </Button>

            <Button
              variant="destructive"
              size="sm"
              disabled={isBulkBusy || activeSelectedIds.length === 0}
              onClick={() => void handleBulkDelete()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Trash</span>
            </Button>
          </div>
        </div>
      ) : null}

      {viewMode === "trash" ? (
        trashWords.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/75 p-12 text-center backdrop-blur-md">
            <Trash2 className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-lg font-bold text-foreground">
              Trash is empty
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Words you delete from your Vault appear here safely so you can
              restore them anytime.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/80 px-3.5 py-3 backdrop-blur-md sm:px-4">
              <span className="text-xs font-medium text-muted-foreground">
                Showing {filteredTrash.length} of {trashWords.length} deleted{" "}
                {trashWords.length === 1 ? "word" : "words"}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRestoreAll()}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-primary" />
                  <span>Restore All</span>
                </Button>

                {confirmEmptyTrash ? (
                  <div className="inline-flex items-center gap-1.5">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleEmptyTrash()}
                    >
                      <span>Confirm Empty</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmEmptyTrash(false)}
                    >
                      <span>Cancel</span>
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmEmptyTrash(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Empty Trash</span>
                  </Button>
                )}
              </div>
            </div>

            {filteredTrash.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No deleted words match your filter.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredTrash.map((item) => {
                  const summary = extractConciseSummary(item.rawEntry);
                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-border/80 bg-card/85 p-4 shadow-xs backdrop-blur-md sm:p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold capitalize break-words [overflow-wrap:anywhere] text-foreground sm:text-xl">
                              {item.term}
                            </h2>
                            {item.phonetic ? (
                              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                                {item.phonetic}
                              </span>
                            ) : null}
                            <Badge variant="outline">
                              <FolderOpen className="h-3 w-3 text-primary" />
                              <span>{item.originalTopicName}</span>
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Deleted {formatDeletedAt(item.deletedAt)} (saved{" "}
                            {formatReadableDate(item.dateKey)})
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRestoreItem(item)}
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-primary" />
                            <span>Restore</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (item.id !== undefined) {
                                void permanentlyDeleteTrashItem(item.id).then(
                                  () =>
                                    showToast(
                                      `Permanently deleted "${item.term}".`,
                                      "info"
                                    )
                                );
                              }
                            }}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete Forever</span>
                          </Button>
                        </div>
                      </div>

                      {summary.conciseMeaning ? (
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          {summary.conciseMeaning}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )
      ) : words.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/75 p-10 text-center backdrop-blur-md sm:p-12">
          <Library className="mx-auto h-10 w-10 text-primary/70" />
          <h2 className="mt-4 text-lg font-bold text-foreground">
            Your Vault is waiting for your first word
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Every lookup on the home page is automatically saved into your
            active topic folder inside IndexedDB.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              Look up a word
            </Link>
            {trashWords.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => setViewMode("trash")}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
                <span>View Trash ({trashWords.length})</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : viewMode === "topics" ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <form
              onSubmit={handleCreateTopic}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Create a new topic folder (e.g. LotR)..."
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card/85 px-3 text-base text-foreground placeholder:text-muted-foreground backdrop-blur-md focus:border-primary focus:outline-none sm:h-9 sm:text-sm"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="h-10 shrink-0 sm:h-9"
              >
                <Plus className="h-4 w-4" />
                <span>Add Topic</span>
              </Button>
            </form>
            {topics.length > 1 ? (
              <>
                <p className="hidden px-1 text-xs text-muted-foreground sm:block">
                  Tip: Drag any word card onto another topic folder to move it, or
                  use the folder menu on each card.
                </p>
                <p className="px-1 text-xs text-muted-foreground sm:hidden">
                  Tip: Tap the folder button on any word card to move it to another
                  topic.
                </p>
              </>
            ) : null}
          </div>

          {hasActiveFilters && filteredWords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/75 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No saved words match your current search or filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllFilters}
                className="mt-3"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear filters</span>
              </Button>
            </div>
          ) : null}

          {topics.map((topic) => {
            if (topic.id === undefined) return null;
            const topicWords = wordsByTopic.get(topic.id) ?? [];
            if (hasActiveFilters && topicWords.length === 0) return null;

            const topicDueCount = dueCountByTopic.get(topic.id) ?? 0;
            const isCollapsed = collapsedTopics.has(topic.id);
            const isDefaultGeneral = topic.name === DEFAULT_TOPIC_NAME;
            const isDropTarget =
              dragState !== null &&
              dragState.fromTopicId !== topic.id &&
              dragOverTopicId === topic.id;

            const topicIds = topicWords
              .map((w) => w.id)
              .filter((id): id is number => id !== undefined);
            const allTopicSelected =
              topicIds.length > 0 &&
              topicIds.every((id) => selectedWordIds.has(id));

            return (
              <section
                key={topic.id}
                onDragOver={(event) => {
                  if (!dragState || dragState.fromTopicId === topic.id) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragOverTopicId !== topic.id) {
                    setDragOverTopicId(topic.id!);
                  }
                }}
                onDragLeave={(event) => {
                  if (
                    event.relatedTarget instanceof Node &&
                    event.currentTarget.contains(event.relatedTarget)
                  ) {
                    return;
                  }
                  if (dragOverTopicId === topic.id) {
                    setDragOverTopicId(null);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOverTopicId(null);
                  const droppedRaw = event.dataTransfer.getData("text/plain");
                  const droppedId = droppedRaw
                    ? Number(droppedRaw)
                    : dragState?.wordId;
                  const droppedTerm = dragState?.term ?? "word";
                  const fromTopic = dragState?.fromTopicId;
                  setDragState(null);

                  if (
                    !droppedId ||
                    Number.isNaN(droppedId) ||
                    fromTopic === topic.id
                  ) {
                    return;
                  }

                  void handleWordMove(droppedId, droppedTerm, topic.id!);
                }}
                className={cn(
                  "rounded-2xl border shadow-sm backdrop-blur-md transition-all duration-150",
                  isDropTarget
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40 scale-[1.01]"
                    : "border-border/80 bg-card/75"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl px-3.5 py-3 sm:px-5 sm:py-3.5">
                  <button
                    type="button"
                    onClick={() => toggleTopicCollapse(topic.id!)}
                    aria-expanded={!isCollapsed}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left sm:gap-2.5"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate text-base font-bold text-foreground">
                      {topic.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
                      {topicWords.length}
                    </span>
                    {topicDueCount > 0 ? (
                      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-violet-500/12 px-2 py-0.5 text-[11px] font-semibold text-[#5227cc] dark:text-violet-300 sm:inline-flex">
                        <Sparkles className="h-3 w-3" />
                        <span>{topicDueCount} due</span>
                      </span>
                    ) : null}
                    {isDropTarget ? (
                      <span className="ml-2 shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        Drop to move here
                      </span>
                    ) : null}
                  </button>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {selectionMode && topicWords.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleTopicSelection(topicWords)}
                        className="cursor-pointer rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        {allTopicSelected ? "Deselect Topic" : "Select Topic"}
                      </button>
                    ) : null}

                    {topicWords.length > 0 ? (
                      <>
                        <TopicExportMenu
                          topicName={topic.name}
                          onExportAnki={() => {
                            const filename = exportWordsAsAnkiTxt(
                              topicWords,
                              topicNameById,
                              topic.name
                            );
                            showToast(`Exported ${filename}`, "success");
                          }}
                          onExportCsv={() => {
                            const filename = exportWordsAsCsv(
                              topicWords,
                              topicNameById,
                              topic.name
                            );
                            showToast(`Exported ${filename}`, "success");
                          }}
                          onExportJson={() => {
                            const filename = exportSelectedWordsBackup(
                              topicWords,
                              topics,
                              profile
                            );
                            showToast(`Exported ${filename}`, "success");
                          }}
                        />
                        <Link
                          href={`/study?topic=${topic.id}`}
                          prefetch={true}
                          title={`Study words in ${topic.name}`}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                        >
                          <GraduationCap className="h-3 w-3" />
                          <span>Study</span>
                        </Link>
                      </>
                    ) : null}

                    {!isDefaultGeneral ? (
                      <button
                        type="button"
                        onClick={() => {
                          void deleteTopic(topic.id!).then(() =>
                            showToast(
                              `Deleted "${topic.name}" (words moved to General).`,
                              "info"
                            )
                          );
                        }}
                        title={`Delete topic "${topic.name}" (moves words to General)`}
                        aria-label={`Delete topic ${topic.name}`}
                        className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {!isCollapsed ? (
                  <div className="space-y-3 rounded-b-2xl border-t border-border/60 p-3 sm:p-5">
                    {topicWords.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        {dragState && dragState.fromTopicId !== topic.id
                          ? `Drop word here to move into ${topic.name}`
                          : "No words saved in this topic yet."}
                      </p>
                    ) : (
                      topicWords.map((word) => (
                        <WordCard
                          key={word.id}
                          wordDomId={word.id}
                          isFocused={
                            word.id !== undefined &&
                            effectiveFocusedWordId === word.id
                          }
                          view={reshapeDictionaryEntry(
                            word.rawEntry,
                            mode,
                            showExamples
                          )}
                          dateKey={word.dateKey}
                          note={word.note}
                          customExample={word.customExample}
                          dueBadge={
                            reviewNow > 0
                              ? formatDueBadge(word, reviewNow)
                              : undefined
                          }
                          isDue={
                            reviewNow > 0 ? isWordDue(word, reviewNow) : false
                          }
                          onSaveNotes={
                            word.id !== undefined
                              ? (patch) => updateWordNotes(word.id!, patch)
                              : undefined
                          }
                          onWordClick={(clickedTerm) =>
                            router.push(`/?q=${encodeURIComponent(clickedTerm)}`)
                          }
                          selectable={selectionMode}
                          selected={
                            word.id !== undefined &&
                            selectedWordIds.has(word.id)
                          }
                          onToggleSelect={
                            word.id !== undefined
                              ? () => toggleWordSelection(word.id!)
                              : undefined
                          }
                          topics={topics}
                          currentTopicId={word.topicId}
                          draggable={word.id !== undefined && !selectionMode}
                          isDragging={dragState?.wordId === word.id}
                          onDragStart={(event) => {
                            if (word.id === undefined) return;
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData(
                              "text/plain",
                              String(word.id)
                            );
                            setDragState({
                              wordId: word.id,
                              term: word.term,
                              fromTopicId: word.topicId,
                            });
                          }}
                          onDragEnd={() => {
                            setDragState(null);
                            setDragOverTopicId(null);
                          }}
                          onMoveTopic={(targetTopicId) => {
                            if (word.id !== undefined) {
                              void handleWordMove(
                                word.id,
                                word.term,
                                targetTopicId
                              );
                            }
                          }}
                          onDelete={() => {
                            void handleSoftDelete(word);
                          }}
                        />
                      ))
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : timelineGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/75 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No saved words match your current search or filters.
          </p>
          {hasActiveFilters ? (
            <Button
              variant="outline"
              size="sm"
              onClick={resetAllFilters}
              className="mt-3"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear filters</span>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-8">
          {timelineGroups.map(([dateKey, dateWords]) => (
            <section key={dateKey} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card-solid px-3.5 py-1 text-xs font-bold text-foreground shadow-xs">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>{formatReadableDate(dateKey)}</span>
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {dateWords.length}{" "}
                  {dateWords.length === 1 ? "word" : "words"}
                </span>
                <div className="h-px flex-1 bg-border/70" />
              </div>

              <div className="space-y-3">
                {dateWords.map((word) => (
                  <WordCard
                    key={word.id}
                    wordDomId={word.id}
                    isFocused={
                      word.id !== undefined &&
                      effectiveFocusedWordId === word.id
                    }
                    view={reshapeDictionaryEntry(
                      word.rawEntry,
                      mode,
                      showExamples
                    )}
                    topicName={topicNameById.get(word.topicId) ?? "General"}
                    note={word.note}
                    customExample={word.customExample}
                    dueBadge={
                      reviewNow > 0
                        ? formatDueBadge(word, reviewNow)
                        : undefined
                    }
                    isDue={reviewNow > 0 ? isWordDue(word, reviewNow) : false}
                    onSaveNotes={
                      word.id !== undefined
                        ? (patch) => updateWordNotes(word.id!, patch)
                        : undefined
                    }
                    onWordClick={(clickedTerm) =>
                      router.push(`/?q=${encodeURIComponent(clickedTerm)}`)
                    }
                    selectable={selectionMode}
                    selected={
                      word.id !== undefined && selectedWordIds.has(word.id)
                    }
                    onToggleSelect={
                      word.id !== undefined
                        ? () => toggleWordSelection(word.id!)
                        : undefined
                    }
                    topics={topics}
                    currentTopicId={word.topicId}
                    onMoveTopic={(targetTopicId) => {
                      if (word.id !== undefined) {
                        void handleWordMove(word.id, word.term, targetTopicId);
                      }
                    }}
                    onDelete={() => {
                      void handleSoftDelete(word);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
