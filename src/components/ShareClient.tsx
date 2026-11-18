"use client";

import React, { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Download,
  FolderOpen,
  Share2,
  Upload,
} from "lucide-react";
import { useAppUI } from "@/app/Providers";
import { useVault } from "@/hooks/useVault";
import { db, formatReadableDate } from "@/lib/db";
import { createMinimalEntryFromShare, normalizeTerm } from "@/lib/dictionary";
import {
  decodeShareHash,
  parseShareJsonFile,
  type SharePayload,
} from "@/lib/share";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function subscribeHash(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getHashSnapshot(): string {
  return typeof window === "undefined" ? "" : window.location.hash;
}

function getServerHashSnapshot(): string {
  return "";
}

export function ShareClient() {
  const { showToast } = useAppUI();
  const { createTopic } = useVault();

  const urlHash = useSyncExternalStore(
    subscribeHash,
    getHashSnapshot,
    getServerHashSnapshot
  );

  const [filePayload, setFilePayload] = useState<SharePayload | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [deselectedIndices, setDeselectedIndices] = useState<Set<number>>(
    new Set()
  );
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hashDecoded = useMemo<{
    payload: SharePayload | null;
    error: string | null;
  }>(() => {
    if (!urlHash || !urlHash.includes("v1=")) {
      return { payload: null, error: null };
    }
    try {
      return { payload: decodeShareHash(urlHash), error: null };
    } catch (err) {
      return {
        payload: null,
        error:
          err instanceof Error
            ? err.message
            : "Failed to decode shared link payload.",
      };
    }
  }, [urlHash]);

  const activePayload = filePayload ?? hashDecoded.payload;
  const activeError = fileError ?? hashDecoded.error;

  const selectedIndices = useMemo(() => {
    if (!activePayload) return [];
    return activePayload.items
      .map((_, idx) => idx)
      .filter((idx) => !deselectedIndices.has(idx));
  }, [activePayload, deselectedIndices]);

  const toggleItem = (idx: number) => {
    setDeselectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleLoadJsonFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setImportSummary(null);

    try {
      const text = await file.text();
      const parsed = parseShareJsonFile(text);
      setFilePayload(parsed);
      setDeselectedIndices(new Set());
    } catch (err) {
      setFileError(
        err instanceof Error ? err.message : "Could not read shared JSON file."
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleImportSelected = async () => {
    if (!activePayload || selectedIndices.length === 0) return;
    setIsImporting(true);
    setImportSummary(null);

    try {
      let added = 0;
      let skipped = 0;

      for (const idx of selectedIndices) {
        const item = activePayload.items[idx];
        if (!item) continue;

        const topicId = await createTopic(item.topic);
        const normalizedTerm =
          normalizeTerm(item.term) || item.term.trim().toLowerCase();

        const existing = await db.words
          .where("[term+topicId]")
          .equals([normalizedTerm, topicId])
          .first();

        if (existing) {
          skipped += 1;
          continue;
        }

        const now = Date.now();
        await db.words.add({
          term: normalizedTerm,
          topicId,
          phonetic: null,
          audioUrl: null,
          rawEntry: createMinimalEntryFromShare({
            term: normalizedTerm,
            conciseMeaning: item.conciseMeaning,
            example: item.example,
          }),
          savedMode: "concise",
          savedWithExamples: Boolean(item.example),
          dateKey: item.dateKey,
          createdAt: now,
          updatedAt: now,
        });
        added += 1;
      }

      const message = `Imported ${added} ${added === 1 ? "word" : "words"} into your Vault${skipped > 0 ? ` (${skipped} already existed)` : ""}.`;
      setImportSummary(message);
      showToast(message, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to import shared words.",
        "error"
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Share2 className="h-3.5 w-3.5" />
            <span>Zero-Database Shared Shelf</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {activePayload
              ? `Shared by ${activePayload.sharedBy}`
              : "Open a Shared Vocabulary Link"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activePayload
              ? `${activePayload.items.length} curated ${activePayload.items.length === 1 ? "word" : "words"} decoded locally from URL hash with zero server storage.`
              : "Open a /share#v1=... link or upload a shareable .json file."}
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleLoadJsonFile}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Load Share .json</span>
          </Button>
        </div>
      </div>

      {activeError ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/35 bg-card/90 p-4 text-sm text-destructive backdrop-blur-md"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Unable to load shared payload</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeError}
            </p>
          </div>
        </div>
      ) : null}

      {importSummary ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{importSummary}</span>
          </span>
          <Link
            href="/vault"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Open My Vault
          </Link>
        </div>
      ) : null}

      {!activePayload ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/80 p-10 text-center backdrop-blur-md">
          <Share2 className="mx-auto h-9 w-9 text-primary/70" />
          <h2 className="mt-4 text-base font-bold text-foreground">
            Nothing shared in this URL yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground sm:text-sm">
            Use the <strong>Share</strong> button in the header to create a
            compressed <code className="font-mono">#v1=</code> link or load a
            shareable <code className="font-mono">.json</code> file above.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-semibold text-white hover:bg-primary/90"
          >
            Back to Lookup
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/85 px-4 py-3 backdrop-blur-md">
            <span className="text-xs font-medium text-muted-foreground">
              {selectedIndices.length} of {activePayload.items.length} selected
              for import
            </span>

            <Button
              variant="primary"
              disabled={selectedIndices.length === 0 || isImporting}
              onClick={handleImportSelected}
            >
              <Download className="h-4 w-4" />
              <span>
                {isImporting
                  ? "Importing..."
                  : "Import Selected to My Vault"}
              </span>
            </Button>
          </div>

          <div className="space-y-3">
            {activePayload.items.map((item, idx) => {
              const isSelected = !deselectedIndices.has(idx);
              return (
                <label
                  key={`${item.term}-${item.topic}-${idx}`}
                  className={cn(
                    "block cursor-pointer rounded-2xl border p-5 backdrop-blur-md transition-all",
                    isSelected
                      ? "border-primary/45 bg-card/90 shadow-sm"
                      : "border-border/70 bg-card/55 opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItem(idx)}
                        className="h-4 w-4 rounded accent-[#1d9bf0]"
                      />
                      <h2 className="text-xl font-bold capitalize text-foreground">
                        {item.term}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">
                        <FolderOpen className="h-3 w-3 text-primary" />
                        <span>{item.topic}</span>
                      </Badge>
                      <Badge variant="secondary" className="text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatReadableDate(item.dateKey)}</span>
                      </Badge>
                    </div>
                  </div>

                  <p className="mt-3 pl-7 text-sm leading-relaxed text-foreground">
                    {item.conciseMeaning}
                  </p>
                  {item.example ? (
                    <p className="mt-2 ml-7 border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">
                      “{item.example}”
                    </p>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
