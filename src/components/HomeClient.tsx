"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  RotateCcw,
} from "lucide-react";
import { useAppUI } from "@/app/Providers";
import { useVault } from "@/hooks/useVault";
import { useWordLookup } from "@/hooks/useWordLookup";
import { getLocalDateKey, TYPING_SPEED_DELAY_MS } from "@/lib/db";
import {
  DictionaryNotFoundError,
  normalizeTerm,
  reshapeDictionaryEntry,
  type DisplayMode,
  type NormalizedDictionaryEntry,
} from "@/lib/dictionary";
import { formatDueBadge, isWordDue } from "@/lib/srs";
import { LookupBar } from "@/components/LookupBar";
import { TopicSelector } from "@/components/TopicSelector";
import { PreferenceBar } from "@/components/PreferenceBar";
import { WordCard } from "@/components/WordCard";

interface LookupTrigger {
  term: string;
  immediate: boolean;
  seq: number;
}

interface SessionCardItem {
  id: string;
  wordId: number;
  entry: NormalizedDictionaryEntry;
  topicName: string;
  dateKey: string;
  previousDateKey: string | null;
  wasExisting: boolean;
}

const SAMPLE_WORDS = [
  "eloquent",
  "ephemeral",
  "serendipity",
  "welkin",
  "mellifluous",
];

export function HomeClient() {
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q");

  const {
    storedTopicId,
    setActiveTopicId,
    isProfileOpen,
    isSettingsOpen,
    isShareOpen,
    isOnboardingOpen,
    isCommandOpen,
  } = useAppUI();

  const {
    topics,
    words,
    dueWords,
    reviewNow,
    profile,
    topicMap,
    topicNameById,
    upsertWord,
    createTopic,
    updateWordNotes,
    updateProfile,
  } = useVault();

  const [inputValue, setInputValue] = useState("");
  const [lookupTrigger, setLookupTrigger] = useState<LookupTrigger | null>(
    null
  );
  const [sessionCards, setSessionCards] = useState<SessionCardItem[]>([]);
  const [hideRecentPreview, setHideRecentPreview] = useState(false);

  const seqRef = useRef(0);
  const debounceTimerRef = useRef<number | undefined>(undefined);
  const autoClearTimerRef = useRef<number | undefined>(undefined);
  const lastSavedGuardRef = useRef<string | null>(null);
  const lastHandledQueryRef = useRef<string | null>(null);
  const inputValueRef = useRef(inputValue);
  const autoClearRef = useRef(profile.autoClearSearch);

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    autoClearRef.current = profile.autoClearSearch;
  }, [profile.autoClearSearch]);

  useEffect(() => {
    return () => {
      window.clearTimeout(debounceTimerRef.current);
      window.clearTimeout(autoClearTimerRef.current);
    };
  }, []);

  const activeTopicId = useMemo(() => {
    if (storedTopicId !== null && topicMap.has(storedTopicId)) {
      return storedTopicId;
    }
    return topics[0]?.id ?? null;
  }, [storedTopicId, topicMap, topics]);

  const mode: DisplayMode = profile.defaultMode;
  const showExamples = profile.defaultExamples;
  const autoClearSearch = profile.autoClearSearch;
  const typingSpeed = profile.typingSpeed;

  const lookupQuery = useWordLookup({
    term: lookupTrigger?.term ?? "",
    mode,
    showExamples,
  });

  useEffect(() => {
    const data = lookupQuery.data;
    if (!data || !lookupTrigger || activeTopicId === null) return;

    if (
      !lookupTrigger.immediate &&
      normalizeTerm(inputValueRef.current) !== lookupTrigger.term
    ) {
      return;
    }

    const guardKey = `${lookupTrigger.seq}:${lookupTrigger.term}:${activeTopicId}`;
    if (lastSavedGuardRef.current === guardKey) return;
    lastSavedGuardRef.current = guardKey;

    let cancelled = false;
    const resolvedTopicName = topicNameById.get(activeTopicId) ?? "General";

    void upsertWord({
      entry: data.raw,
      topicId: activeTopicId,
      savedMode: mode,
      savedWithExamples: showExamples,
    }).then((saveResult) => {
      if (cancelled) return;
      const todayKey = getLocalDateKey();

      setSessionCards((prev) => {
        const nextCard: SessionCardItem = {
          id: `${lookupTrigger.seq}-${data.raw.word}`,
          wordId: saveResult.wordId,
          entry: data.raw,
          topicName: resolvedTopicName,
          dateKey: todayKey,
          previousDateKey: saveResult.previousDateKey,
          wasExisting: saveResult.wasExisting,
        };
        const normalizedWord = normalizeTerm(data.raw.word);
        const filtered = prev.filter(
          (item) => normalizeTerm(item.entry.word) !== normalizedWord
        );
        return [nextCard, ...filtered];
      });

      if (autoClearRef.current) {
        const clearDelay = lookupTrigger.immediate ? 140 : 650;
        window.clearTimeout(autoClearTimerRef.current);
        autoClearTimerRef.current = window.setTimeout(() => {
          if (
            lookupTrigger.immediate ||
            normalizeTerm(inputValueRef.current) === lookupTrigger.term
          ) {
            setInputValue("");
          }
        }, clearDelay);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    lookupQuery.data,
    lookupTrigger,
    activeTopicId,
    mode,
    showExamples,
    topicNameById,
    upsertWord,
  ]);

  const handleInputChange = (nextValue: string) => {
    setInputValue(nextValue);
    window.clearTimeout(debounceTimerRef.current);
    window.clearTimeout(autoClearTimerRef.current);

    const normalized = normalizeTerm(nextValue);
    const delayMs = TYPING_SPEED_DELAY_MS[typingSpeed];
    if (delayMs === null || normalized.length < 2) {
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      seqRef.current += 1;
      setLookupTrigger({
        term: normalized,
        immediate: false,
        seq: seqRef.current,
      });
    }, delayMs);
  };

  const handleImmediateSubmit = (rawTerm: string) => {
    window.clearTimeout(debounceTimerRef.current);
    window.clearTimeout(autoClearTimerRef.current);

    const normalized = normalizeTerm(rawTerm);
    if (normalized.length < 2) return;

    setInputValue(normalized);
    seqRef.current += 1;
    setLookupTrigger({
      term: normalized,
      immediate: true,
      seq: seqRef.current,
    });
  };

  const handleClearWorkspace = () => {
    window.clearTimeout(debounceTimerRef.current);
    window.clearTimeout(autoClearTimerRef.current);
    setInputValue("");
    setLookupTrigger(null);
    setSessionCards([]);
    setHideRecentPreview(true);
    lastSavedGuardRef.current = null;
  };

  const submitRef = useRef(handleImmediateSubmit);
  useEffect(() => {
    submitRef.current = handleImmediateSubmit;
  });

  useEffect(() => {
    if (!queryParam) return;
    const normalized = normalizeTerm(queryParam);
    if (normalized.length < 2 || lastHandledQueryRef.current === normalized) {
      return;
    }
    lastHandledQueryRef.current = normalized;
    const timer = window.setTimeout(() => {
      submitRef.current(normalized);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [queryParam]);

  const recentVaultFallback = useMemo(
    () => words.slice(0, 3),
    [words]
  );

  const wordById = useMemo(() => {
    const map = new Map<number, (typeof words)[number]>();
    for (const w of words) {
      if (w.id !== undefined) {
        map.set(w.id, w);
      }
    }
    return map;
  }, [words]);

  const modalOpen =
    isProfileOpen ||
    isSettingsOpen ||
    isShareOpen ||
    isOnboardingOpen ||
    isCommandOpen;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-3.5 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-14">
      <div className="mb-5 space-y-2.5 text-center sm:mb-8 sm:space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#63e]/25 bg-white/75 px-3.5 py-1 text-xs font-medium text-[#5227cc] shadow-xs backdrop-blur-md dark:border-violet-400/25 dark:bg-zinc-900/80 dark:text-violet-300">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-primary"
          />
          <span>100% Local-First Vocabulary Vault</span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Look up. Speak. Remember.
        </h1>

        <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
          Instant definitions saved straight into your browser&apos;s IndexedDB
          folders. Zero accounts, zero tracking, instant sharing.
        </p>
      </div>

      <LookupBar
        value={inputValue}
        onChange={handleInputChange}
        onSubmitImmediate={handleImmediateSubmit}
        typingSpeed={typingSpeed}
        pushToTalkKey={profile.pushToTalkKey}
        isFetching={lookupQuery.isFetching}
        disableGlobalShortcut={modalOpen}
      />

      <div className="mt-3.5 flex w-full max-w-2xl flex-col items-center gap-2 sm:mt-4 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-2.5">
        <TopicSelector
          topics={topics}
          words={words}
          activeTopicId={activeTopicId}
          onSelectTopic={setActiveTopicId}
          onCreateTopic={createTopic}
        />

        <PreferenceBar
          mode={mode}
          onModeChange={(nextMode) => void updateProfile({ defaultMode: nextMode })}
          showExamples={showExamples}
          onShowExamplesChange={(checked) =>
            void updateProfile({ defaultExamples: checked })
          }
          autoClearSearch={autoClearSearch}
          onAutoClearSearchChange={(checked) =>
            void updateProfile({ autoClearSearch: checked })
          }
        />
      </div>

      {dueWords.length > 0 ? (
        <div className="mt-3 flex justify-center">
          <Link
            href="/study?mode=srs"
            prefetch={true}
            className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary shadow-xs backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-primary hover:text-white"
          >
            <GraduationCap className="h-3.5 w-3.5" />
            <span>
              Review {dueWords.length} due{" "}
              {dueWords.length === 1 ? "word" : "words"}
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}

      {lookupQuery.isError && lookupTrigger ? (
        <div
          role="alert"
          className="mt-5 flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-destructive/30 bg-card/90 p-4 text-sm text-foreground shadow-md backdrop-blur-md animate-word-drop sm:mt-6 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="font-semibold text-destructive">
                {lookupQuery.error instanceof DictionaryNotFoundError
                  ? `No entry found for "${lookupTrigger.term}"`
                  : "Lookup error"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {lookupQuery.error.message}
              </p>
              {lookupQuery.error instanceof DictionaryNotFoundError &&
              lookupQuery.error.suggestions.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Did you mean:
                  </span>
                  {lookupQuery.error.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleImmediateSubmit(suggestion)}
                      className="cursor-pointer rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-white"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearWorkspace}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 self-end rounded-full border border-border bg-card-solid px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive sm:self-auto"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Clear</span>
          </button>
        </div>
      ) : null}

      {sessionCards.length > 0 ? (
        <section
          aria-label="Recent lookups"
          className="mt-6 w-full max-w-2xl space-y-4 sm:mt-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-medium text-muted-foreground">
            <span>
              {autoClearSearch ? (
                <>
                  <span className="hidden sm:inline">
                    Hover any faded card below to pop it into full color
                  </span>
                  <span className="sm:hidden">
                    Latest lookup, auto-saved to your active topic
                  </span>
                </>
              ) : (
                "Latest lookup, auto-saved to your active topic"
              )}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClearWorkspace}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border/80 bg-card/80 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear</span>
              </button>
              <Link
                href="/vault"
                prefetch={true}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                <span>Open Vault</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {sessionCards.map((item, idx) => {
            const reshaped = reshapeDictionaryEntry(
              item.entry,
              mode,
              showExamples
            );
            const isFaded =
              idx > 0 || (autoClearSearch && inputValue.trim() === "");
            const liveRecord = wordById.get(item.wordId);

            return (
              <WordCard
                key={item.id}
                view={reshaped}
                topicName={item.topicName}
                dateKey={item.dateKey}
                previousDateKey={item.previousDateKey}
                wasExisting={item.wasExisting}
                note={liveRecord?.note}
                customExample={liveRecord?.customExample}
                dueBadge={
                  liveRecord && reviewNow > 0
                    ? formatDueBadge(liveRecord, reviewNow)
                    : undefined
                }
                isDue={
                  liveRecord && reviewNow > 0
                    ? isWordDue(liveRecord, reviewNow)
                    : false
                }
                onSaveNotes={(patch) => updateWordNotes(item.wordId, patch)}
                faded={isFaded}
                animateDrop={idx === 0}
                onWordClick={handleImmediateSubmit}
              />
            );
          })}
        </section>
      ) : (
        <div className="mt-6 w-full max-w-2xl space-y-6 sm:mt-8 sm:space-y-8">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Try looking up:
            </span>
            {SAMPLE_WORDS.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => handleImmediateSubmit(word)}
                className="cursor-pointer rounded-full border border-border/80 bg-card/80 px-3 py-1 text-xs font-medium text-foreground shadow-xs backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary"
              >
                {word}
              </button>
            ))}
          </div>

          {recentVaultFallback.length > 0 && !hideRecentPreview ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpenCheck className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Recently in your Vault
                    <span className="hidden sm:inline">
                      {" "}
                      (hover to bring into focus)
                    </span>
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClearWorkspace}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border/80 bg-card/80 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Clear</span>
                  </button>
                  <Link
                    href="/vault"
                    prefetch={true}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    <span>View all {words.length}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {recentVaultFallback.map((word) => (
                <WordCard
                  key={word.id}
                  view={reshapeDictionaryEntry(
                    word.rawEntry,
                    mode,
                    showExamples
                  )}
                  topicName={topicNameById.get(word.topicId) ?? "General"}
                  dateKey={word.dateKey}
                  note={word.note}
                  customExample={word.customExample}
                  dueBadge={
                    reviewNow > 0 ? formatDueBadge(word, reviewNow) : undefined
                  }
                  isDue={reviewNow > 0 ? isWordDue(word, reviewNow) : false}
                  onSaveNotes={
                    word.id !== undefined
                      ? (patch) => updateWordNotes(word.id!, patch)
                      : undefined
                  }
                  faded
                  onWordClick={handleImmediateSubmit}
                />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
