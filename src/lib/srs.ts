import type { ReviewRating, WordRecord, WordSrsState } from "@/lib/db";

export const DEFAULT_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
export const MAX_EASE_FACTOR = 3.0;
export const MS_PER_DAY = 86_400_000;
export const HARD_RETRY_MS = 10 * 60 * 1000;

export type WordMasteryStatus = "new" | "due" | "learning" | "mastered";

export function computeNextSrsState(
  current: WordSrsState | undefined,
  rating: ReviewRating,
  now: number
): WordSrsState {
  const prev: WordSrsState = current ?? {
    repetitions: 0,
    intervalDays: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    nextReviewAt: now,
    lastReviewedAt: null,
    lapses: 0,
  };

  const ef = Math.max(MIN_EASE_FACTOR, Math.min(MAX_EASE_FACTOR, prev.easeFactor));

  if (rating === "hard") {
    return {
      repetitions: 0,
      intervalDays: 0,
      easeFactor: Math.max(MIN_EASE_FACTOR, Number((ef - 0.2).toFixed(2))),
      nextReviewAt: now + HARD_RETRY_MS,
      lastReviewedAt: now,
      lapses: prev.lapses + 1,
    };
  }

  if (rating === "good") {
    const repetitions = prev.repetitions + 1;
    const intervalDays =
      prev.repetitions === 0
        ? 1
        : prev.repetitions === 1
          ? 6
          : Math.max(1, Math.round(prev.intervalDays * ef));

    return {
      repetitions,
      intervalDays,
      easeFactor: ef,
      nextReviewAt: now + intervalDays * MS_PER_DAY,
      lastReviewedAt: now,
      lapses: prev.lapses,
    };
  }

  const repetitions = prev.repetitions + 1;
  const intervalDays =
    prev.repetitions === 0
      ? 4
      : prev.repetitions === 1
        ? 10
        : Math.max(2, Math.round(prev.intervalDays * ef * 1.3));

  return {
    repetitions,
    intervalDays,
    easeFactor: Math.min(MAX_EASE_FACTOR, Number((ef + 0.15).toFixed(2))),
    nextReviewAt: now + intervalDays * MS_PER_DAY,
    lastReviewedAt: now,
    lapses: prev.lapses,
  };
}

export function isWordDue(word: WordRecord, now: number): boolean {
  if (!word.srs) return true;
  return word.srs.nextReviewAt <= now;
}

export function getWordMasteryStatus(
  word: WordRecord,
  now: number
): WordMasteryStatus {
  if (!word.srs || word.srs.lastReviewedAt === null) {
    return "new";
  }
  if (word.srs.nextReviewAt <= now) {
    return "due";
  }
  if (word.srs.intervalDays >= 14 && word.srs.repetitions >= 3) {
    return "mastered";
  }
  return "learning";
}

export function formatIntervalLabel(nextReviewAt: number, now: number): string {
  const diffMs = Math.max(0, nextReviewAt - now);
  const diffMinutes = Math.round(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)} min`;
  }
  const diffHours = Math.round(diffMs / 3_600_000);
  if (diffHours < 24) {
    return `${diffHours} hr`;
  }
  const days = Math.round(diffMs / MS_PER_DAY);
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? "1 wk" : `${weeks} wks`;
  }
  const months = Math.round(days / 30);
  return months === 1 ? "1 mo" : `${months} mos`;
}

export function previewSrsIntervals(
  word: WordRecord,
  now: number
): Record<ReviewRating, string> {
  const hard = computeNextSrsState(word.srs, "hard", now);
  const good = computeNextSrsState(word.srs, "good", now);
  const easy = computeNextSrsState(word.srs, "easy", now);
  return {
    hard: formatIntervalLabel(hard.nextReviewAt, now),
    good: formatIntervalLabel(good.nextReviewAt, now),
    easy: formatIntervalLabel(easy.nextReviewAt, now),
  };
}

export function formatDueBadge(word: WordRecord, now: number): string {
  if (!word.srs || word.srs.lastReviewedAt === null) {
    return "New";
  }
  if (word.srs.nextReviewAt <= now) {
    return "Due now";
  }
  const diffMs = word.srs.nextReviewAt - now;
  const days = Math.ceil(diffMs / MS_PER_DAY);
  if (days <= 1) {
    const hours = Math.max(1, Math.ceil(diffMs / 3_600_000));
    return hours < 24 ? `In ${hours}h` : "In 1d";
  }
  if (days < 30) {
    return `In ${days}d`;
  }
  const months = Math.round(days / 30);
  return `In ${months}mo`;
}

export function sortReviewQueue(words: WordRecord[], now: number): WordRecord[] {
  return [...words].sort((a, b) => {
    const aDueReviewed = Boolean(a.srs && a.srs.lastReviewedAt !== null && a.srs.nextReviewAt <= now);
    const bDueReviewed = Boolean(b.srs && b.srs.lastReviewedAt !== null && b.srs.nextReviewAt <= now);
    const aNew = !a.srs || a.srs.lastReviewedAt === null;
    const bNew = !b.srs || b.srs.lastReviewedAt === null;

    const rank = (dueRev: boolean, isNewWord: boolean) =>
      dueRev ? 0 : isNewWord ? 1 : 2;
    const ra = rank(aDueReviewed, aNew);
    const rb = rank(bDueReviewed, bNew);
    if (ra !== rb) return ra - rb;

    if (ra === 0) {
      return (a.srs?.nextReviewAt ?? 0) - (b.srs?.nextReviewAt ?? 0);
    }
    if (ra === 1) {
      return b.updatedAt - a.updatedAt;
    }
    return (a.srs?.nextReviewAt ?? 0) - (b.srs?.nextReviewAt ?? 0);
  });
}

export function hasPersonalNotes(word: WordRecord): boolean {
  return Boolean(word.note?.trim() || word.customExample?.trim());
}
