"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Library,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useAppUI } from "@/app/Providers";
import { useVault } from "@/hooks/useVault";
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
import { cn } from "@/lib/utils";
import { PreferenceBar } from "@/components/PreferenceBar";
import { WordCard } from "@/components/WordCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type VaultViewMode = "topics" | "timeline" | "trash";

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
  const { showToast } = useAppUI();
  const {
    topics,
    words,
    trashWords,
    profile,
    topicNameById,
    createTopic,
    deleteTopic,
    deleteWord,
    restoreFromTrash,
    restoreAllTrash,
    permanentlyDeleteTrashItem,
    emptyTrash,
    moveWordToTopic,
    updateProfile,
  } = useVault();

  const [viewMode, setViewMode] = useState<VaultViewMode>("topics");
  const [filterQuery, setFilterQuery] = useState("");
  const [collapsedTopics, setCollapsedTopics] = useState<Set<number>>(
    new Set()
  );
  const [newTopicName, setNewTopicName] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverTopicId, setDragOverTopicId] = useState<number | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

  const mode: DisplayMode = profile.defaultMode;
  const showExamples = profile.defaultExamples;

  const filteredWords = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return words;
    return words.filter((word) => {
      if (word.term.toLowerCase().includes(q)) return true;
      const topicName = (topicNameById.get(word.topicId) ?? "").toLowerCase();
      if (topicName.includes(q)) return true;
      if (word.rawEntry.simpleDefinition?.toLowerCase().includes(q)) {
        return true;
      }
      return word.rawEntry.meanings.some((m) =>
        m.definitions.some((d) => d.definition.toLowerCase().includes(q))
      );
    });
  }, [words, filterQuery, topicNameById]);

  const filteredTrash = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return trashWords;
    return trashWords.filter((item) => {
      if (item.term.toLowerCase().includes(q)) return true;
      if (item.originalTopicName.toLowerCase().includes(q)) return true;
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

  const handleSoftDelete = async (word: WordRecord) => {
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
  };

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
            Your Saved Words & Time Travel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {words.length} {words.length === 1 ? "word" : "words"} organized
            across {topics.length} {topics.length === 1 ? "topic" : "topics"}
            {trashWords.length > 0 ? ` (${trashWords.length} in Trash)` : ""}
          </p>
        </div>

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
            onClick={() => setViewMode("trash")}
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

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-3.5 shadow-xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={
              viewMode === "trash"
                ? "Search deleted words in Trash..."
                : "Filter saved words, definitions, or topics..."
            }
            aria-label="Filter vault words"
            className="h-10 w-full rounded-xl border border-border bg-background/80 pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:h-9 sm:text-sm"
          />
        </div>

        {viewMode !== "trash" ? (
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
        ) : null}
      </div>

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

          {topics.map((topic) => {
            if (topic.id === undefined) return null;
            const topicWords = wordsByTopic.get(topic.id) ?? [];
            if (filterQuery.trim() && topicWords.length === 0) return null;

            const isCollapsed = collapsedTopics.has(topic.id);
            const isDefaultGeneral = topic.name === DEFAULT_TOPIC_NAME;
            const isDropTarget =
              dragState !== null &&
              dragState.fromTopicId !== topic.id &&
              dragOverTopicId === topic.id;

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
                <div className="flex items-center justify-between gap-3 rounded-t-2xl px-3.5 py-3 sm:px-5 sm:py-3.5">
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
                    {isDropTarget ? (
                      <span className="ml-2 shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        Drop to move here
                      </span>
                    ) : null}
                  </button>

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
                          view={reshapeDictionaryEntry(
                            word.rawEntry,
                            mode,
                            showExamples
                          )}
                          dateKey={word.dateKey}
                          topics={topics}
                          currentTopicId={word.topicId}
                          draggable={word.id !== undefined}
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
        <p className="py-12 text-center text-sm text-muted-foreground">
          No words match your filter.
        </p>
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
                    view={reshapeDictionaryEntry(
                      word.rawEntry,
                      mode,
                      showExamples
                    )}
                    topicName={topicNameById.get(word.topicId) ?? "General"}
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
