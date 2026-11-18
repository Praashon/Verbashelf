"use client";

import type { DisplayMode } from "@/lib/dictionary";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface PreferenceBarProps {
  mode: DisplayMode;
  onModeChange: (mode: DisplayMode) => void;
  showExamples: boolean;
  onShowExamplesChange: (show: boolean) => void;
  autoClearSearch?: boolean;
  onAutoClearSearchChange?: (enabled: boolean) => void;
}

export function PreferenceBar({
  mode,
  onModeChange,
  showExamples,
  onShowExamplesChange,
  autoClearSearch,
  onAutoClearSearchChange,
}: PreferenceBarProps) {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:gap-2.5">
      <div
        role="group"
        aria-label="Definition detail mode"
        className="inline-flex items-center rounded-full border border-border/80 bg-card/85 p-0.5 shadow-xs backdrop-blur-md"
      >
        <button
          type="button"
          onClick={() => onModeChange("concise")}
          className={cn(
            "cursor-pointer rounded-full px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3 sm:py-1",
            mode === "concise"
              ? "bg-primary text-white shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Concise
        </button>
        <button
          type="button"
          onClick={() => onModeChange("comprehensive")}
          className={cn(
            "cursor-pointer rounded-full px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3 sm:py-1",
            mode === "comprehensive"
              ? "bg-primary text-white shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Comprehensive
        </button>
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/80 bg-card/85 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xs backdrop-blur-md sm:px-3 sm:py-1">
        <span>Examples</span>
        <Switch
          checked={showExamples}
          onCheckedChange={onShowExamplesChange}
          aria-label="Toggle usage examples"
        />
      </label>

      {autoClearSearch !== undefined && onAutoClearSearchChange ? (
        <label
          title="Clear the search input right after your answer arrives and drop cards into faded hover-to-pop-up mode below"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/80 bg-card/85 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xs backdrop-blur-md sm:px-3 sm:py-1"
        >
          <span>Auto-clear</span>
          <Switch
            checked={autoClearSearch}
            onCheckedChange={onAutoClearSearchChange}
            aria-label="Auto-clear search input after answer resolves"
          />
        </label>
      ) : null}
    </div>
  );
}
