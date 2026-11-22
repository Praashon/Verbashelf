"use client";

import { BookMarked, EyeOff, Flame, Sparkles, Trophy } from "lucide-react";
import { useVault } from "@/hooks/useVault";

export function StatsStrip() {
  const { profile, words, stats, updateProfile } = useVault();

  if (!profile.showStats || words.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Local learning statistics"
      className="mb-5 rounded-2xl border border-border/80 bg-card/80 px-3.5 py-2.5 shadow-xs backdrop-blur-md sm:px-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold tabular-nums text-foreground sm:text-sm">
                {stats.reviewedToday}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Reviewed today
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-300">
              <Flame className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold tabular-nums text-foreground sm:text-sm">
                {stats.currentStreak}{" "}
                {stats.currentStreak === 1 ? "day" : "days"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Current streak
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-[#5227cc] dark:text-violet-300">
              <BookMarked className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold tabular-nums text-foreground sm:text-sm">
                {stats.totalWords}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Saved words
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
              <Trophy className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold tabular-nums text-foreground sm:text-sm">
                {stats.masteredWords}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Mastered
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void updateProfile({ showStats: false })}
          title="Hide stats strip (re-enable anytime in Settings)"
          aria-label="Hide local statistics strip"
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <EyeOff className="h-3 w-3" />
          <span className="hidden sm:inline">Hide</span>
        </button>
      </div>
    </section>
  );
}
