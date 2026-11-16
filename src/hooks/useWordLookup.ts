"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
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
    queryFn: ({ signal }) => fetchWordDefinition(normalizedTerm, signal),
    select: selectView,
  });
}
