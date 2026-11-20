"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import {
  DictionaryNotFoundError,
  fetchWordDefinition,
  normalizeTerm,
  reshapeDictionaryEntry,
  type DisplayMode,
  type NormalizedDictionaryEntry,
  type ReshapedWordView,
} from "@/lib/dictionary";

export interface WordLookupData {
  raw: NormalizedDictionaryEntry;
  view: ReshapedWordView;
}

interface UseWordLookupOptions {
  term: string;
  mode: DisplayMode;
  showExamples: boolean;
}

function isAbortLikeError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError")
  );
}

async function lookupOfflineCachedWord(
  normalizedTerm: string
): Promise<NormalizedDictionaryEntry | null> {
  try {
    const cached = await db.words.where("term").equals(normalizedTerm).first();
    return cached?.rawEntry ?? null;
  } catch {
    return null;
  }
}

async function fetchWithOfflineFallback(
  normalizedTerm: string,
  signal?: AbortSignal
): Promise<NormalizedDictionaryEntry> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const offlineEntry = await lookupOfflineCachedWord(normalizedTerm);
    if (offlineEntry) {
      return offlineEntry;
    }
    throw new Error(
      `You are offline and "${normalizedTerm}" is not cached in your Vault yet.`
    );
  }

  try {
    return await fetchWordDefinition(normalizedTerm, signal);
  } catch (error: unknown) {
    if (isAbortLikeError(error) || error instanceof DictionaryNotFoundError) {
      throw error;
    }
    const offlineEntry = await lookupOfflineCachedWord(normalizedTerm);
    if (offlineEntry) {
      return offlineEntry;
    }
    throw error;
  }
}

export function useWordLookup({
  term,
  mode,
  showExamples,
}: UseWordLookupOptions) {
  const normalizedTerm = normalizeTerm(term);

  const selectView = useCallback(
    (entry: NormalizedDictionaryEntry): WordLookupData => ({
      raw: entry,
      view: reshapeDictionaryEntry(entry, mode, showExamples),
    }),
    [mode, showExamples]
  );

  return useQuery<NormalizedDictionaryEntry, Error, WordLookupData>({
    queryKey: ["word", normalizedTerm],
    enabled: normalizedTerm.trim().length >= 2,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: false,
    queryFn: ({ signal }) => fetchWithOfflineFallback(normalizedTerm, signal),
    select: selectView,
  });
}
