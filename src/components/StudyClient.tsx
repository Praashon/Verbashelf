"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Eye,
  FolderOpen,
  GraduationCap,
  Headphones,
  Keyboard,
  Layers,
  Mic,
  RotateCcw,
  Shuffle,
  Sparkles,
  StickyNote,
  Volume2,
  XCircle,
} from "lucide-react";
import { useAppUI } from "@/app/Providers";
import { useVault } from "@/hooks/useVault";
import type { ReviewRating, WordRecord } from "@/lib/db";
import { reshapeDictionaryEntry } from "@/lib/dictionary";
import { speakWord, stopPronunciation } from "@/lib/pronunciation";
import {
  formatDueBadge,
  isWordDue,
  previewSrsIntervals,
  sortReviewQueue,
} from "@/lib/srs";
import { cn } from "@/lib/utils";
import { PronunciationPractice } from "@/components/PronunciationPractice";
import { StatsStrip } from "@/components/StatsStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type StudyMode = "srs" | "flashcard" | "def-to-word" | "listen" | "ipa";
type DeckScope = "due" | "all";

const STUDY_MODES: ReadonlyArray<{
  id: StudyMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "srs",
    label: "Smart Review",
    shortLabel: "Smart Review",
    description:
      "Hide definitions, test your memory, and bring words back right before you forget them.",
  },
  {
    id: "flashcard",
    label: "Word -> Definition",
    shortLabel: "Flashcards",
    description: "Classic two-sided flashcards for fast active recall.",
  },
  {
    id: "def-to-word",
    label: "Definition -> Word",
    shortLabel: "Def -> Word",
    description: "Read the meaning and type the matching vocabulary word.",
  },
  {
    id: "listen",
    label: "Listen -> Type",
    shortLabel: "Listen",
    description: "Hear pronunciation spoken aloud and spell the word.",
  },
  {
    id: "ipa",
    label: "Sound Spelling",
    shortLabel: "Sound Spelling",
    description:
      "Practice how a word sounds using pronunciation symbols (sound guide).",
  },
];

const COMMON_IPA_SYMBOLS = [
  "ˈ",
  "ˌ",
  "ː",
  "ə",
  "ɪ",
  "ɛ",
  "æ",
  "ʌ",
  "ɑ",
  "ɔ",
  "ʊ",
  "u",
  "i",
  "ɜ",
  "ʃ",
  "ʒ",
  "θ",
  "ð",
  "ŋ",
  "a",
  "e",
  "o",
  "t",
  "d",
  "k",
  "s",
  "z",
  "n",
  "l",
  "r",
] as const;

function parseStudyMode(raw: string | null): StudyMode {
  if (
    raw === "srs" ||
    raw === "flashcard" ||
    raw === "def-to-word" ||
    raw === "listen" ||
    raw === "ipa"
  ) {
    return raw;
  }
  return "srs";
}

function shuffleDeterministic<T>(items: ReadonlyArray<T>, seed: number): T[] {
  const result = [...items];
  let state = (seed * 1664525 + 1013904223) >>> 0;
  for (let i = result.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

function normalizeWordAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ");
}

function normalizeIpaAnswer(raw: string): string {
  return raw
    .trim()
    .replace(/^[/[\s]+|[/\]\s]+$/g, "")
    .replace(/[.\s]+/g, "")
    .toLowerCase();
}

function maskWordInText(text: string, targetWord: string): string {
  const clean = targetWord.trim();
  if (!clean) return text;
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "gi");
  return text.replace(pattern, "_____");
}

function buildIpaChips(targetPhonetic: string): string[] {
  const set = new Set<string>(COMMON_IPA_SYMBOLS);
  for (const ch of targetPhonetic) {
    if (ch === "/" || ch === "[" || ch === "]" || ch === "." || /\s/.test(ch)) {
      continue;
    }
    set.add(ch);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function StudyClient() {
  const searchParams = useSearchParams();
  const {
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
    recordWordReview,
  } = useVault();

  const urlMode = parseStudyMode(searchParams.get("mode"));
  const urlTopicRaw = searchParams.get("topic");
  const urlTopicParsed = useMemo<number | "all">(() => {
    if (!urlTopicRaw) return "all";
    const parsed = Number(urlTopicRaw);
    if (Number.isInteger(parsed) && parsed > 0 && topicMap.has(parsed)) {
      return parsed;
    }
    return "all";
  }, [urlTopicRaw, topicMap]);

  const [modeOverride, setModeOverride] = useState<StudyMode | null>(null);
  const [topicOverride, setTopicOverride] = useState<number | "all" | null>(
    null
  );
  const [scopeOverride, setScopeOverride] = useState<DeckScope | null>(null);
  const [updateSrsOnQuiz, setUpdateSrsOnQuiz] = useState(true);
  const [showPhoneticHint, setShowPhoneticHint] = useState(true);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const [sessionQueueIds, setSessionQueueIds] = useState<number[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [typedInput, setTypedInput] = useState("");
  const [checkResult, setCheckResult] = useState<"correct" | "incorrect" | null>(
    null
  );
  const [counts, setCounts] = useState<Record<ReviewRating, number>>({
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [isGrading, setIsGrading] = useState(false);

  const answerInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPronunciation();
    };
  }, []);

  const activeMode = modeOverride ?? urlMode;
  const activeTopicFilter = topicOverride ?? urlTopicParsed;
  const activeScope: DeckScope =
    scopeOverride ??
    (activeMode === "srs" && activeTopicFilter === "all" ? "due" : "all");

  const wordById = useMemo(() => {
    const map = new Map<number, WordRecord>();
    for (const w of words) {
      if (w.id !== undefined) {
        map.set(w.id, w);
      }
    }
    return map;
  }, [words]);

  const scopedWords = useMemo(() => {
    return words.filter((word) =>
      activeTopicFilter === "all" ? true : word.topicId === activeTopicFilter
    );
  }, [words, activeTopicFilter]);

  const scopedDueCount = useMemo(() => {
    if (reviewNow === 0) return 0;
    return scopedWords.filter((w) => isWordDue(w, reviewNow)).length;
  }, [scopedWords, reviewNow]);

  const computedDeckIds = useMemo(() => {
    if (words.length === 0) return [];
    let pool = scopedWords;
    if (activeScope === "due") {
      if (reviewNow === 0) return [];
      pool = pool.filter((w) => isWordDue(w, reviewNow));
    }
    if (activeMode === "ipa") {
      pool = pool.filter((w) => Boolean(w.phonetic?.trim()));
    }

    const ordered =
      shuffleSeed > 0
        ? shuffleDeterministic(pool, shuffleSeed)
        : sortReviewQueue(pool, reviewNow || 1);

    return ordered
      .map((w) => w.id)
      .filter((id): id is number => id !== undefined);
  }, [words.length, scopedWords, activeScope, activeMode, shuffleSeed, reviewNow]);

  const activeQueueIds = sessionQueueIds ?? computedDeckIds;
  const totalCards = activeQueueIds.length;
  const isComplete = totalCards > 0 && currentIndex >= totalCards;
  const currentWordId =
    !isComplete && totalCards > 0 ? activeQueueIds[currentIndex] : undefined;
  const currentWord =
    currentWordId !== undefined ? wordById.get(currentWordId) : undefined;

  const resetSessionProgress = useCallback(() => {
    stopPronunciation();
    setIsSpeaking(false);
    setShowPractice(false);
    setSessionQueueIds(null);
    setCurrentIndex(0);
    setIsRevealed(false);
    setTypedInput("");
    setCheckResult(null);
    setCounts({ hard: 0, good: 0, easy: 0 });
  }, []);

  const handleModeChange = (nextMode: StudyMode) => {
    setModeOverride(nextMode);
    setShuffleSeed(0);
    resetSessionProgress();
  };

  const handleScopeChange = (nextScope: DeckScope) => {
    setScopeOverride(nextScope);
    resetSessionProgress();
  };

  const handleTopicChange = (nextTopic: number | "all") => {
    setTopicOverride(nextTopic);
    setShuffleSeed(0);
    resetSessionProgress();
  };

  const handleShuffle = () => {
    setShuffleSeed((s) => s + 1);
    resetSessionProgress();
  };

  const handleSpeakCurrent = useCallback(() => {
    if (!currentWord) return;
    if (isSpeaking) {
      stopPronunciation();
      setIsSpeaking(false);
      return;
    }

    void speakWord({
      word: currentWord.term,
      audioUrl: currentWord.audioUrl,
      onStart: () => {
        if (mountedRef.current) {
          setIsSpeaking(true);
        }
      },
      onEnd: () => {
        if (mountedRef.current) {
          setIsSpeaking(false);
        }
      },
    });
  }, [currentWord, isSpeaking]);

  useEffect(() => {
    if (activeMode !== "listen" || !currentWord || isRevealed) {
      return;
    }
    const timer = window.setTimeout(() => {
      void speakWord({
        word: currentWord.term,
        audioUrl: currentWord.audioUrl,
        onStart: () => {
          if (mountedRef.current) {
            setIsSpeaking(true);
          }
        },
        onEnd: () => {
          if (mountedRef.current) {
            setIsSpeaking(false);
          }
        },
      });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      stopPronunciation();
    };
  }, [activeMode, currentWord, isRevealed]);

  const handleRevealCard = useCallback(() => {
    if (!currentWord) return;
    if (sessionQueueIds === null) {
      setSessionQueueIds(computedDeckIds);
    }
    setIsRevealed(true);
  }, [currentWord, sessionQueueIds, computedDeckIds]);

  const handleCheckTypedAnswer = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!currentWord) return;

    if (sessionQueueIds === null) {
      setSessionQueueIds(computedDeckIds);
    }

    let isMatch = false;
    if (activeMode === "ipa") {
      isMatch =
        normalizeIpaAnswer(typedInput) !== "" &&
        normalizeIpaAnswer(typedInput) ===
          normalizeIpaAnswer(currentWord.phonetic ?? "");
    } else {
      isMatch =
        normalizeWordAnswer(typedInput) !== "" &&
        normalizeWordAnswer(typedInput) ===
          normalizeWordAnswer(currentWord.term);
    }

    setCheckResult(isMatch ? "correct" : "incorrect");
    setIsRevealed(true);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleGrade = useCallback(
    async (rating: ReviewRating) => {
      if (!currentWord || currentWord.id === undefined || isGrading) return;

      const queue = sessionQueueIds ?? computedDeckIds;
      if (sessionQueueIds === null) {
        setSessionQueueIds(queue);
      }

      stopPronunciation();
      setIsSpeaking(false);
      setIsGrading(true);
      try {
        if (activeMode === "srs" || updateSrsOnQuiz) {
          await recordWordReview(currentWord.id, rating);
        }
        setCounts((prev) => ({
          ...prev,
          [rating]: prev[rating] + 1,
        }));
        setCurrentIndex((prev) => prev + 1);
        setIsRevealed(false);
        setShowPractice(false);
        setTypedInput("");
        setCheckResult(null);
      } finally {
        if (mountedRef.current) {
          setIsGrading(false);
        }
      }
    },
    [
      currentWord,
      isGrading,
      sessionQueueIds,
      computedDeckIds,
      activeMode,
      updateSrsOnQuiz,
      recordWordReview,
    ]
  );

  const modalOpen =
    isProfileOpen ||
    isSettingsOpen ||
    isShareOpen ||
    isOnboardingOpen ||
    isCommandOpen;

  useEffect(() => {
    if (modalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
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

      if (!currentWord || isComplete) return;

      if (event.code === "Space" && !isRevealed) {
        event.preventDefault();
        handleRevealCard();
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        handleSpeakCurrent();
        return;
      }

      if (isRevealed) {
        if (event.key === "1") {
          event.preventDefault();
          void handleGrade("hard");
        } else if (event.key === "2") {
          event.preventDefault();
          void handleGrade("good");
        } else if (event.key === "3") {
          event.preventDefault();
          void handleGrade("easy");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    modalOpen,
    currentWord,
    isComplete,
    isRevealed,
    handleRevealCard,
    handleSpeakCurrent,
    handleGrade,
  ]);

  const reshapedCurrent = useMemo(() => {
    if (!currentWord) return null;
    return reshapeDictionaryEntry(
      currentWord.rawEntry,
      profile.defaultMode,
      profile.defaultExamples
    );
  }, [currentWord, profile.defaultMode, profile.defaultExamples]);

  const intervalPreview = useMemo(() => {
    if (!currentWord || reviewNow === 0) {
      return { hard: "10 min", good: "1 day", easy: "4 days" };
    }
    return previewSrsIntervals(currentWord, reviewNow);
  }, [currentWord, reviewNow]);

  const ipaChips = useMemo(() => {
    if (activeMode !== "ipa" || !currentWord?.phonetic) return [];
    return buildIpaChips(currentWord.phonetic);
  }, [activeMode, currentWord]);

  const activeModeInfo =
    STUDY_MODES.find((m) => m.id === activeMode) ?? STUDY_MODES[0];

  const totalReviewed = counts.hard + counts.good + counts.easy;
  const progressPercent =
    totalCards > 0
      ? Math.min(100, Math.round((Math.min(currentIndex, totalCards) / totalCards) * 100))
      : 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-3.5 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Smart Review &amp; Practice Games</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Study &amp; Active Recall
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dueWords.length > 0
              ? `${dueWords.length} ${dueWords.length === 1 ? "word" : "words"} due for review today across ${words.length} saved.`
              : `All caught up across ${words.length} saved ${words.length === 1 ? "word" : "words"}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShuffle}
            disabled={totalCards < 2}
          >
            <Shuffle className="h-3.5 w-3.5 text-primary" />
            <span>Shuffle</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetSessionProgress}
            disabled={totalCards === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restart</span>
          </Button>
        </div>
      </div>

      <StatsStrip />

      <section className="mb-6 space-y-3 rounded-2xl border border-border/80 bg-card/85 p-3.5 shadow-xs backdrop-blur-md sm:p-4">
        <div
          role="tablist"
          aria-label="Study mode"
          className="flex flex-wrap gap-1.5"
        >
          {STUDY_MODES.map((item) => {
            const active = activeMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleModeChange(item.id)}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                  active
                    ? "border-primary bg-primary text-white shadow-xs"
                    : "border-border/70 bg-background/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">{activeModeInfo.description}</p>

        <div className="flex flex-col gap-2.5 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-border bg-muted/60 p-0.5">
              <button
                type="button"
                onClick={() => handleScopeChange("due")}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  activeScope === "due"
                    ? "bg-card-solid text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Due Today ({scopedDueCount})
              </button>
              <button
                type="button"
                onClick={() => handleScopeChange("all")}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  activeScope === "all"
                    ? "bg-card-solid text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Words ({scopedWords.length})
              </button>
            </div>

            <select
              value={activeTopicFilter === "all" ? "all" : String(activeTopicFilter)}
              onChange={(e) => {
                const val = e.target.value;
                handleTopicChange(val === "all" ? "all" : Number(val));
              }}
              aria-label="Filter study deck by topic"
              className="h-8 rounded-full border border-border bg-background/85 px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
            >
              <option value="all">All Topics ({words.length})</option>
              {topics.map((topic) =>
                topic.id !== undefined ? (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ) : null
              )}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            {(activeMode === "srs" || activeMode === "flashcard") ? (
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-foreground">
                <span className="text-muted-foreground">Show sound guide</span>
                <Switch
                  checked={showPhoneticHint}
                  onCheckedChange={setShowPhoneticHint}
                  aria-label="Show pronunciation sound guide on card front"
                />
              </label>
            ) : null}

            {activeMode !== "srs" ? (
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-foreground">
                <span className="text-muted-foreground">Save to my review schedule</span>
                <Switch
                  checked={updateSrsOnQuiz}
                  onCheckedChange={setUpdateSrsOnQuiz}
                  aria-label="Save quiz results to your review schedule"
                />
              </label>
            ) : null}
          </div>
        </div>
      </section>

      {words.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/80 p-10 text-center backdrop-blur-md sm:p-12">
          <BookOpen className="mx-auto h-10 w-10 text-primary/70" />
          <h2 className="mt-4 text-lg font-bold text-foreground">
            Save your first word to start studying
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Look up words on the home page and they will automatically appear in
            your Spaced Repetition deck and quiz modes.
          </p>
          <div className="mt-5">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              Look up a word
            </Link>
          </div>
        </div>
      ) : totalCards === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/80 p-10 text-center backdrop-blur-md sm:p-12">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h2 className="mt-4 text-lg font-bold text-foreground">
            {activeMode === "ipa"
              ? "No words with a sound guide match this filter"
              : activeScope === "due"
                ? "All caught up for today!"
                : "No words match the selected topic"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {activeMode === "ipa"
              ? "Try switching to All Topics or try Definition -> Word or Listen -> Type mode."
              : activeScope === "due"
                ? "Every word in this scope is scheduled for later. You can still practice all words anytime without waiting."
                : "Select All Topics or add more vocabulary words on the Lookup page."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {activeScope === "due" ? (
              <Button
                variant="primary"
                onClick={() => handleScopeChange("all")}
              >
                <span>Study All {scopedWords.length} Words</span>
              </Button>
            ) : null}
            {activeMode === "ipa" ? (
              <Button
                variant="outline"
                onClick={() => handleModeChange("listen")}
              >
                <span>Switch to Listen -&gt; Type</span>
              </Button>
            ) : null}
            {activeTopicFilter !== "all" ? (
              <Button
                variant="outline"
                onClick={() => handleTopicChange("all")}
              >
                <span>Show All Topics</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : isComplete ? (
        <div className="rounded-3xl border border-border bg-card/90 p-8 text-center shadow-lg backdrop-blur-md animate-word-drop sm:p-10">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-2xl font-extrabold text-foreground">
            Session Complete!
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You reviewed {totalReviewed} {totalReviewed === 1 ? "card" : "cards"} in{" "}
            <strong className="text-foreground">{activeModeInfo.label}</strong>.
          </p>

          <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-lg font-extrabold text-amber-700 dark:text-amber-300">
                {counts.hard}
              </p>
              <p className="text-xs font-medium text-muted-foreground">Hard</p>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
              <p className="text-lg font-extrabold text-primary">{counts.good}</p>
              <p className="text-xs font-medium text-muted-foreground">Good</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-300">
                {counts.easy}
              </p>
              <p className="text-xs font-medium text-muted-foreground">Easy</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" onClick={resetSessionProgress}>
              <RotateCcw className="h-4 w-4" />
              <span>Practice Again</span>
            </Button>
            {activeScope === "due" ? (
              <Button
                variant="outline"
                onClick={() => handleScopeChange("all")}
              >
                <Layers className="h-4 w-4" />
                <span>Study All Words</span>
              </Button>
            ) : null}
            <Link
              href="/vault"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background/70 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
            >
              <span>Back to Vault</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : currentWord && reshapedCurrent ? (
        <div className="space-y-4">
          <div className="space-y-2 px-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
              <span>
                Card <strong className="text-foreground">{currentIndex + 1}</strong>{" "}
                of <strong className="text-foreground">{totalCards}</strong>
              </span>
              <div className="flex items-center gap-3">
                <span>Hard: {counts.hard}</span>
                <span>Good: {counts.good}</span>
                <span>Easy: {counts.easy}</span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(4, progressPercent)}%` }}
              />
            </div>
          </div>

          <article className="rounded-3xl border border-border/90 bg-card/95 p-5 shadow-lg backdrop-blur-md animate-word-drop sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  <FolderOpen className="h-3 w-3 text-primary" />
                  <span>{topicNameById.get(currentWord.topicId) ?? "General"}</span>
                </Badge>
                {reviewNow > 0 ? (
                  <Badge variant="violet">
                    <span>{formatDueBadge(currentWord, reviewNow)}</span>
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSpeakCurrent}
                  aria-label={`Pronounce ${currentWord.term}`}
                  title="Listen to pronunciation (shortcut: R)"
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                    isSpeaking
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-card-solid text-foreground hover:border-primary/50 hover:text-primary"
                  )}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>{isSpeaking ? "Speaking..." : "Pronounce (R)"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPractice((prev) => !prev)}
                  aria-expanded={showPractice}
                  aria-label={`Practice speaking ${currentWord.term}`}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                    showPractice
                      ? "border-primary bg-primary/12 text-primary"
                      : "border-border bg-card-solid text-muted-foreground hover:border-primary/50 hover:text-primary"
                  )}
                >
                  <Mic className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Practice Speaking</span>
                </button>
              </div>
            </div>

            {showPractice ? (
              <PronunciationPractice
                word={currentWord.term}
                audioUrl={currentWord.audioUrl}
                phonetic={currentWord.phonetic}
                onClose={() => setShowPractice(false)}
              />
            ) : null}

            {(activeMode === "srs" || activeMode === "flashcard") ? (
              <div className="py-6 text-center">
                <h2 className="text-3xl font-extrabold tracking-tight capitalize text-foreground sm:text-5xl">
                  {currentWord.term}
                </h2>
                {showPhoneticHint && currentWord.phonetic ? (
                  <p className="mt-2 font-mono text-sm text-muted-foreground sm:text-base">
                    {currentWord.phonetic}
                  </p>
                ) : null}
                {!isRevealed ? (
                  <div className="mt-6">
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleRevealCard}
                    >
                      <Eye className="h-4 w-4" />
                      <span>Reveal Definition (Space)</span>
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : activeMode === "def-to-word" ? (
              <div className="space-y-4 py-5">
                <div className="space-y-2 rounded-2xl border border-primary/25 bg-primary/8 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary">
                      {reshapedCurrent.meanings[0]?.partOfSpeech ?? "word"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {currentWord.term.length} letters
                    </span>
                  </div>
                  <p className="text-base font-medium leading-relaxed text-foreground">
                    {maskWordInText(
                      reshapedCurrent.simpleDefinition ||
                        reshapedCurrent.meanings[0]?.definitions[0]?.definition ||
                        "",
                      currentWord.term
                    )}
                  </p>
                  {currentWord.note?.trim() ? (
                    <p className="text-xs italic text-muted-foreground">
                      Hint: {maskWordInText(currentWord.note, currentWord.term)}
                    </p>
                  ) : null}
                </div>

                {!isRevealed ? (
                  <form
                    onSubmit={handleCheckTypedAnswer}
                    className="flex flex-col gap-2 sm:flex-row"
                  >
                    <input
                      ref={answerInputRef}
                      type="text"
                      value={typedInput}
                      onChange={(e) => setTypedInput(e.target.value)}
                      placeholder="Type the matching word..."
                      aria-label="Type the matching vocabulary word"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      autoFocus
                      className="h-11 flex-1 rounded-xl border border-border bg-background/90 px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="flex-1 sm:flex-initial"
                      >
                        <Check className="h-4 w-4" />
                        <span>Check</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={handleRevealCard}
                      >
                        <span>Show</span>
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : activeMode === "listen" ? (
              <div className="space-y-4 py-5 text-center">
                <button
                  type="button"
                  onClick={handleSpeakCurrent}
                  className={cn(
                    "mx-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border transition-all",
                    isSpeaking
                      ? "border-primary bg-primary text-white scale-105 shadow-lg"
                      : "border-primary/40 bg-primary/12 text-primary hover:bg-primary hover:text-white"
                  )}
                  aria-label="Listen to spoken word"
                >
                  <Headphones className="h-7 w-7" />
                </button>
                <p className="text-xs text-muted-foreground">
                  Part of speech:{" "}
                  <strong className="text-foreground">
                    {reshapedCurrent.meanings[0]?.partOfSpeech ?? "word"}
                  </strong>{" "}
                  &middot; Press <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">R</kbd> to replay audio
                </p>

                {!isRevealed ? (
                  <form
                    onSubmit={handleCheckTypedAnswer}
                    className="mx-auto flex max-w-md flex-col gap-2 sm:flex-row"
                  >
                    <input
                      ref={answerInputRef}
                      type="text"
                      value={typedInput}
                      onChange={(e) => setTypedInput(e.target.value)}
                      placeholder="Type the word you heard..."
                      aria-label="Type the spoken word"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      autoFocus
                      className="h-11 flex-1 rounded-xl border border-border bg-background/90 px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <Button type="submit" variant="primary" size="lg">
                        <Check className="h-4 w-4" />
                        <span>Check</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={handleRevealCard}
                      >
                        <span>Show</span>
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4 py-5">
                <div className="text-center">
                  <h2 className="text-3xl font-extrabold tracking-tight capitalize text-foreground sm:text-4xl">
                    {currentWord.term}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Type or tap the pronunciation symbols below to match how this word sounds (slashes optional)
                  </p>
                </div>

                {!isRevealed ? (
                  <div className="space-y-3">
                    <form
                      onSubmit={handleCheckTypedAnswer}
                      className="flex flex-col gap-2 sm:flex-row"
                    >
                      <input
                        ref={answerInputRef}
                        type="text"
                        value={typedInput}
                        onChange={(e) => setTypedInput(e.target.value)}
                        placeholder="e.g. ˈdʒʌstɪs"
                        aria-label="Type the pronunciation sound guide"
                        autoComplete="off"
                        spellCheck={false}
                        autoFocus
                        className="h-11 flex-1 rounded-xl border border-border bg-background/90 px-3.5 font-mono text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <Button type="submit" variant="primary" size="lg">
                          <Check className="h-4 w-4" />
                          <span>Check</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={handleRevealCard}
                        >
                          <span>Show</span>
                        </Button>
                      </div>
                    </form>

                    <div className="flex flex-wrap justify-center gap-1.5 rounded-2xl border border-border/70 bg-muted/40 p-2.5">
                      {ipaChips.map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => {
                            setTypedInput((prev) => prev + sym);
                            answerInputRef.current?.focus();
                          }}
                          className="h-8 min-w-[2rem] cursor-pointer rounded-lg border border-border bg-card-solid px-2 font-mono text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {isRevealed ? (
              <div className="space-y-4 border-t border-border/60 pt-5 animate-word-drop">
                {checkResult ? (
                  <div
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold sm:text-sm",
                      checkResult === "correct"
                        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-destructive/35 bg-destructive/10 text-destructive"
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      {checkResult === "correct" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        {checkResult === "correct"
                          ? "Exact match!"
                          : `Your answer: "${typedInput.trim() || "(blank)"}"`}
                      </span>
                    </span>
                    <span className="font-bold text-foreground">
                      {activeMode === "ipa"
                        ? currentWord.phonetic
                        : currentWord.term}
                    </span>
                  </div>
                ) : null}

                {(activeMode === "def-to-word" || activeMode === "listen") ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-2xl font-extrabold capitalize text-foreground">
                      {currentWord.term}
                    </h3>
                    {currentWord.phonetic ? (
                      <span className="rounded-lg bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
                        {currentWord.phonetic}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {activeMode === "ipa" && currentWord.phonetic ? (
                  <p className="rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-2 font-mono text-sm font-semibold text-primary">
                    Sound guide: {currentWord.phonetic}
                  </p>
                ) : null}

                {reshapedCurrent.simpleDefinition ? (
                  <p className="rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-2.5 text-sm text-foreground">
                    <span className="mr-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                      In plain English:
                    </span>
                    {reshapedCurrent.simpleDefinition}
                  </p>
                ) : null}

                <div className="space-y-4">
                  {reshapedCurrent.meanings.map((meaning, mIdx) => (
                    <div
                      key={`${meaning.partOfSpeech}-${mIdx}`}
                      className="space-y-2"
                    >
                      <span className="inline-flex rounded-md bg-primary/14 px-2 py-0.5 text-xs font-semibold uppercase text-primary">
                        {meaning.partOfSpeech}
                      </span>
                      <ol className="space-y-1.5 pl-1">
                        {meaning.definitions.map((def, dIdx) => (
                          <li key={`${mIdx}-${dIdx}`} className="text-sm text-foreground">
                            <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                              {dIdx + 1}.
                            </span>
                            {def.definition}
                            {def.example ? (
                              <p className="mt-1 border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">
                                &ldquo;{def.example}&rdquo;
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>

                {(currentWord.note?.trim() || currentWord.customExample?.trim()) ? (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      <StickyNote className="h-3 w-3" />
                      <span>My Note &amp; Mnemonic</span>
                    </span>
                    {currentWord.note?.trim() ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {currentWord.note}
                      </p>
                    ) : null}
                    {currentWord.customExample?.trim() ? (
                      <p className="mt-1 border-l-2 border-amber-500/50 pl-2.5 text-xs italic text-muted-foreground">
                        My example: &ldquo;{currentWord.customExample}&rdquo;
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="border-t border-border/60 pt-4">
                  <p className="mb-2.5 text-center text-xs font-medium text-muted-foreground">
                    How well did you recall this word?
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      disabled={isGrading}
                      onClick={() => void handleGrade("hard")}
                      className="flex cursor-pointer flex-col items-center rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-center transition-all hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-300 sm:text-sm">
                        1 &middot; Hard
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {activeMode === "srs" || updateSrsOnQuiz
                          ? intervalPreview.hard
                          : "Practice"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isGrading}
                      onClick={() => void handleGrade("good")}
                      className="flex cursor-pointer flex-col items-center rounded-2xl border border-primary/40 bg-primary/12 px-3 py-2.5 text-center transition-all hover:bg-primary/20 disabled:opacity-50"
                    >
                      <span className="text-xs font-bold text-primary sm:text-sm">
                        2 &middot; Good
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {activeMode === "srs" || updateSrsOnQuiz
                          ? intervalPreview.good
                          : "Continue"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isGrading}
                      onClick={() => void handleGrade("easy")}
                      className="flex cursor-pointer flex-col items-center rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 text-center transition-all hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 sm:text-sm">
                        3 &middot; Easy
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {activeMode === "srs" || updateSrsOnQuiz
                          ? intervalPreview.easy
                          : "Next"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </article>

          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Keyboard className="h-3.5 w-3.5 text-primary" />
              <span>Keyboard:</span>
            </span>
            <span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                Space
              </kbd>{" "}
              reveal
            </span>
            <span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                R
              </kbd>{" "}
              pronounce
            </span>
            <span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                1
              </kbd>{" "}
              /{" "}
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                2
              </kbd>{" "}
              /{" "}
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                3
              </kbd>{" "}
              grade
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
