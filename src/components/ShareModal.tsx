"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Share2,
  X,
} from "lucide-react";
import { useAppUI } from "@/app/Providers";
import { useVault } from "@/hooks/useVault";
import type { WordRecord } from "@/lib/db";
import {
  buildSharePayload,
  downloadShareableJson,
  encodeShareUrl,
  URL_SAFE_LIMIT,
} from "@/lib/share";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ShareModal() {
  const { isShareOpen, setIsShareOpen, showToast } = useAppUI();
  const { topics, words, topicNameById, profile } = useVault();

  const [selectionMode, setSelectionMode] = useState<"all" | "manual">("all");
  const [manualWordIds, setManualWordIds] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const selectedWords = useMemo(() => {
    if (selectionMode === "all") {
      return words;
    }
    return words.filter(
      (word) => word.id !== undefined && manualWordIds.has(word.id)
    );
  }, [words, selectionMode, manualWordIds]);

  const encoded = useMemo(() => {
    if (selectedWords.length === 0) return null;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://verbashelf.local";
    const payload = buildSharePayload(
      selectedWords,
      topicNameById,
      profile.displayName
    );
    return {
      payload,
      ...encodeShareUrl(payload, origin),
    };
  }, [selectedWords, topicNameById, profile.displayName]);

  if (!isShareOpen) {
    return null;
  }

  const wordsByTopic = new Map<number, WordRecord[]>();
  for (const word of words) {
    const list = wordsByTopic.get(word.topicId) ?? [];
    list.push(word);
    wordsByTopic.set(word.topicId, list);
  }

  const handleSelectMode = (mode: "all" | "manual") => {
    setSelectionMode(mode);
    setCopied(false);
    if (mode === "manual") {
      const next = new Set<number>();
      for (const word of words) {
        if (word.id !== undefined) next.add(word.id);
      }
      setManualWordIds(next);
    }
  };

  const toggleWord = (wordId: number) => {
    if (selectionMode === "all") {
      const next = new Set<number>();
      for (const word of words) {
        if (word.id !== undefined && word.id !== wordId) {
          next.add(word.id);
        }
      }
      setSelectionMode("manual");
      setManualWordIds(next);
      setCopied(false);
      return;
    }

    setManualWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      return next;
    });
    setCopied(false);
  };

  const toggleTopic = (topicId: number) => {
    const topicWords = wordsByTopic.get(topicId) ?? [];
    const topicIds = topicWords
      .map((w) => w.id)
      .filter((id): id is number => id !== undefined);
    if (topicIds.length === 0) return;

    if (selectionMode === "all") {
      const next = new Set<number>();
      for (const w of words) {
        if (w.id !== undefined && w.topicId !== topicId) {
          next.add(w.id);
        }
      }
      setSelectionMode("manual");
      setManualWordIds(next);
      setCopied(false);
      return;
    }

    const allChecked = topicIds.every((id) => manualWordIds.has(id));
    setManualWordIds((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        for (const id of topicIds) next.delete(id);
      } else {
        for (const id of topicIds) next.add(id);
      }
      return next;
    });
    setCopied(false);
  };

  const handleCopyUrl = async () => {
    if (!encoded || encoded.exceedsLimit) return;
    try {
      await navigator.clipboard.writeText(encoded.url);
      setCopied(true);
      showToast("Shareable link copied to clipboard!", "success");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast("Could not access clipboard. Copy manually.", "error");
    }
  };

  const handleDownloadJson = () => {
    if (!encoded) return;
    const filename = downloadShareableJson(encoded.payload);
    showToast(`Downloaded ${filename}`, "success");
  };

  const charCount = encoded?.charCount ?? 0;
  const percent = encoded?.percent ?? 0;
  const exceedsLimit = encoded?.exceedsLimit ?? false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-2.5 backdrop-blur-xs sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsShareOpen(false);
        }
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-2xl border border-border bg-card-solid shadow-2xl animate-word-drop sm:max-h-[88vh]">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Share2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2
                id="share-modal-title"
                className="text-base font-bold text-foreground sm:text-lg"
              >
                Selective Zero-DB Share
              </h2>
              <p className="text-xs text-muted-foreground">
                Pick exactly which topics & words to compress into a `#v1=` URL.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsShareOpen(false)}
            aria-label="Close share modal"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3.5 sm:px-6 sm:py-4">
          {words.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Your vault is empty right now.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Look up a few words first, then return here to share a curated list.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="grid w-full grid-cols-2 rounded-xl border border-border bg-muted/60 p-1 sm:inline-flex sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleSelectMode("all")}
                    className={cn(
                      "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      selectionMode === "all"
                        ? "bg-primary text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Select All ({words.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectMode("manual")}
                    className={cn(
                      "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      selectionMode === "manual"
                        ? "bg-primary text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Choose Manually
                  </button>
                </div>

                <Badge variant="violet">
                  {selectedWords.length} of {words.length} selected
                </Badge>
              </div>

              <div className="max-h-60 space-y-3 overflow-y-auto rounded-2xl border border-border bg-background/50 p-3">
                {topics.map((topic) => {
                  if (topic.id === undefined) return null;
                  const topicWords = wordsByTopic.get(topic.id) ?? [];
                  if (topicWords.length === 0) return null;

                  const topicCheckedCount =
                    selectionMode === "all"
                      ? topicWords.length
                      : topicWords.filter(
                          (w) => w.id !== undefined && manualWordIds.has(w.id)
                        ).length;

                  const allInTopicChecked =
                    topicCheckedCount === topicWords.length;

                  return (
                    <div
                      key={topic.id}
                      className="rounded-xl border border-border/70 bg-card-solid p-3"
                    >
                      <label className="flex cursor-pointer items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={allInTopicChecked}
                            onChange={() => toggleTopic(topic.id!)}
                            className="h-4 w-4 shrink-0 rounded accent-[#1d9bf0]"
                          />
                          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="truncate">{topic.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {topicCheckedCount}/{topicWords.length}
                        </span>
                      </label>

                      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-1 sm:pl-6">
                        {topicWords.map((word) => {
                          if (word.id === undefined) return null;
                          const isChecked =
                            selectionMode === "all" ||
                            manualWordIds.has(word.id);
                          return (
                            <label
                              key={word.id}
                              className={cn(
                                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                                isChecked
                                  ? "border-primary/45 bg-primary/10 text-primary"
                                  : "border-border bg-muted/40 text-muted-foreground"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleWord(word.id!)}
                                className="h-3 w-3 rounded accent-[#1d9bf0]"
                              />
                              <span className="capitalize">{word.term}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-foreground">Live URL Capacity</span>
                  <span
                    className={cn(
                      "font-mono",
                      exceedsLimit
                        ? "font-bold text-destructive"
                        : percent >= 80
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {charCount.toLocaleString()} /{" "}
                    {URL_SAFE_LIMIT.toLocaleString()} chars
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-200",
                      exceedsLimit
                        ? "bg-destructive"
                        : percent >= 80
                          ? "bg-amber-500"
                          : "bg-primary"
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {exceedsLimit ? (
                  <div className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-2">
                      <p className="font-medium">
                        Selection exceeds the 6,000-character safe URL limit.
                        Download a shareable JSON file instead or deselect a few words.
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDownloadJson}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download Shareable .json</span>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse items-stretch gap-2 border-t border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          {encoded ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadJson}
              className="w-full justify-center sm:w-auto"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export .json</span>
            </Button>
          ) : (
            <span className="hidden sm:inline" />
          )}

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {encoded && !exceedsLimit ? (
              <Link
                href={`/share#v1=${encoded.compressed}`}
                onClick={() => setIsShareOpen(false)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Preview</span>
              </Link>
            ) : null}

            <Button
              variant="primary"
              disabled={!encoded || exceedsLimit}
              onClick={handleCopyUrl}
              className="w-full justify-center sm:w-auto"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Copied Link</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Share Link</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
