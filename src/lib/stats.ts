import { getLocalDateKey, type DailyStatRecord, type WordRecord } from "@/lib/db";
import { getWordMasteryStatus, isWordDue } from "@/lib/srs";

export interface VaultStats {
  reviewedToday: number;
  addedToday: number;
  currentStreak: number;
  longestStreak: number;
  totalWords: number;
  masteredWords: number;
  dueToday: number;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const parts = dateKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return dateKey;
  }
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeVaultStats(
  words: ReadonlyArray<WordRecord>,
  dailyStats: ReadonlyArray<DailyStatRecord>,
  reviewNow: number
): VaultStats {
  const todayKey =
    reviewNow > 0 ? getLocalDateKey(new Date(reviewNow)) : "";

  const statsByDate = new Map<string, DailyStatRecord>();
  const activeDates = new Set<string>();

  for (const row of dailyStats) {
    statsByDate.set(row.dateKey, row);
    if (row.wordsAdded > 0 || row.wordsReviewed > 0) {
      activeDates.add(row.dateKey);
    }
  }

  let wordsAddedTodayFromRecords = 0;
  let masteredWords = 0;
  let dueToday = 0;

  for (const word of words) {
    if (word.dateKey) {
      activeDates.add(word.dateKey);
    }
    if (todayKey && word.dateKey === todayKey) {
      wordsAddedTodayFromRecords += 1;
    }
    if (reviewNow > 0) {
      if (getWordMasteryStatus(word, reviewNow) === "mastered") {
        masteredWords += 1;
      }
      if (isWordDue(word, reviewNow)) {
        dueToday += 1;
      }
    }
  }

  const todayRow = todayKey ? statsByDate.get(todayKey) : undefined;
  const reviewedToday = todayRow?.wordsReviewed ?? 0;
  const addedToday = Math.max(
    todayRow?.wordsAdded ?? 0,
    wordsAddedTodayFromRecords
  );

  let currentStreak = 0;
  if (todayKey) {
    const yesterdayKey = shiftDateKey(todayKey, -1);
    let cursor = activeDates.has(todayKey)
      ? todayKey
      : activeDates.has(yesterdayKey)
        ? yesterdayKey
        : "";

    while (cursor && activeDates.has(cursor)) {
      currentStreak += 1;
      cursor = shiftDateKey(cursor, -1);
    }
  }

  const sortedDates = Array.from(activeDates).sort((a, b) =>
    a.localeCompare(b)
  );
  let longestStreak = 0;
  let running = 0;
  let prevDate = "";

  for (const dateKey of sortedDates) {
    if (prevDate && shiftDateKey(prevDate, 1) === dateKey) {
      running += 1;
    } else {
      running = 1;
    }
    if (running > longestStreak) {
      longestStreak = running;
    }
    prevDate = dateKey;
  }

  return {
    reviewedToday,
    addedToday,
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    totalWords: words.length,
    masteredWords,
    dueToday,
  };
}
