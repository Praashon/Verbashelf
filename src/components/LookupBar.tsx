"use client";

import React, { useEffect, useRef } from "react";
import { ArrowRight, Loader2, Mic, MicOff, Search, X } from "lucide-react";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import {
  formatShortcutKeyLabel,
  isNonTypingShortcutKey,
  type TypingSpeed,
} from "@/lib/db";
import { cn } from "@/lib/utils";

interface LookupBarProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSubmitImmediate: (term: string) => void;
  typingSpeed?: TypingSpeed;
  pushToTalkKey?: string;
  isFetching?: boolean;
  disableGlobalShortcut?: boolean;
}

function isInteractiveShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    tag === "BUTTON" ||
    tag === "A" ||
    target.isContentEditable
  ) {
    return true;
  }
  return Boolean(
    target.closest(
      "button, a, input, textarea, select, [role='button'], [role='switch'], [role='option'], [role='tab']"
    )
  );
}

function matchesPushToTalkModifiers(
  event: KeyboardEvent,
  code: string
): boolean {
  const isCtrlKey = code === "ControlLeft" || code === "ControlRight";
  const isAltKey = code === "AltLeft" || code === "AltRight";
  const isShiftKey = code === "ShiftLeft" || code === "ShiftRight";
  const isMetaKey = code === "MetaLeft" || code === "MetaRight";

  if (!isCtrlKey && event.ctrlKey) return false;
  if (!isAltKey && event.altKey) return false;
  if (!isShiftKey && event.shiftKey) return false;
  if (!isMetaKey && event.metaKey) return false;
  return true;
}

export function LookupBar({
  value,
  onChange,
  onSubmitImmediate,
  typingSpeed = "balanced",
  pushToTalkKey = "Space",
  isFetching = false,
  disableGlobalShortcut = false,
}: LookupBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const heldKeyCodeRef = useRef<string | null>(null);
  const pttLabel = formatShortcutKeyLabel(pushToTalkKey);

  const {
    isSupported,
    isListening,
    isPushToTalk,
    isProcessing,
    downloadProgress,
    statusMessage,
    errorMessage: voiceError,
    startListening,
    finishListening,
    stopListening,
    clearError,
  } = useVoiceSearch((cleanedTerm) => {
    onChange(cleanedTerm);
    onSubmitImmediate(cleanedTerm);
  });

  useEffect(() => {
    if (disableGlobalShortcut) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
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

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disableGlobalShortcut]);

  useEffect(() => {
    if (disableGlobalShortcut || !isSupported || !pushToTalkKey) {
      return;
    }

    const allowInsideInput = isNonTypingShortcutKey(pushToTalkKey);

    const handlePushKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== pushToTalkKey ||
        event.repeat ||
        !matchesPushToTalkModifiers(event, pushToTalkKey)
      ) {
        return;
      }

      if (!allowInsideInput && isInteractiveShortcutTarget(event.target)) {
        return;
      }

      event.preventDefault();
      heldKeyCodeRef.current = pushToTalkKey;
      clearError();
      startListening({ pushToTalk: true, keyLabel: pttLabel });
    };

    const handlePushKeyUp = (event: KeyboardEvent) => {
      if (
        !heldKeyCodeRef.current ||
        event.code !== heldKeyCodeRef.current
      ) {
        return;
      }
      event.preventDefault();
      heldKeyCodeRef.current = null;
      finishListening();
    };

    const handleWindowBlur = () => {
      if (!heldKeyCodeRef.current) return;
      heldKeyCodeRef.current = null;
      finishListening();
    };

    window.addEventListener("keydown", handlePushKeyDown);
    window.addEventListener("keyup", handlePushKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handlePushKeyDown);
      window.removeEventListener("keyup", handlePushKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [
    disableGlobalShortcut,
    isSupported,
    pushToTalkKey,
    pttLabel,
    startListening,
    finishListening,
    clearError,
  ]);

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (value.trim().length >= 2) {
      onSubmitImmediate(value);
    }
  };

  const canSubmitManual =
    typingSpeed === "manual" && value.trim().length >= 2;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={handleFormSubmit}
        role="search"
        aria-label="Dictionary word search"
        className={cn(
          "relative flex items-center gap-2 rounded-full p-2 pl-5 transition-all duration-200",
          "bg-[#141414] text-zinc-100 border border-black/15",
          "shadow-[0_18px_40px_-14px_rgba(15,20,25,0.45)]",
          "focus-within:ring-2 focus-within:ring-primary/70 focus-within:border-primary/60",
          "dark:bg-[#16181c] dark:border-[#2f3336] dark:shadow-[0_18px_40px_-14px_rgba(0,0,0,0.85)]",
          isListening && "ring-2 ring-primary animate-pulse"
        )}
      >
        <span className="flex shrink-0 items-center text-zinc-400">
          {isFetching || isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </span>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            if (voiceError) {
              clearError();
            }
            onChange(e.target.value);
          }}
          placeholder={
            isListening
              ? isPushToTalk
                ? `Listening... release ${pttLabel} to search`
                : "Listening... speak a word"
              : isProcessing
                ? "Transcribing locally..."
                : typingSpeed === "manual"
                  ? "Type a word and press Enter..."
                  : "Look up any word..."
          }
          aria-label="Search vocabulary word"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-10 w-full min-w-0 bg-transparent text-base font-normal text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
        />

        {canSubmitManual ? (
          <button
            type="submit"
            title="Search now (Enter)"
            aria-label="Search entered word"
            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <span>Go</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search input"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd
            title="Press / anywhere to focus search"
            className="hidden shrink-0 items-center rounded-md border border-zinc-700 bg-zinc-800/90 px-2 py-0.5 font-mono text-[11px] text-zinc-400 sm:inline-flex"
          >
            /
          </kbd>
        )}

        <button
          type="button"
          disabled={!isSupported}
          onClick={() => startListening()}
          title={
            !isSupported
              ? "Microphone is unavailable in this browser."
              : isListening
                ? "Tap to stop listening"
                : isProcessing
                  ? "Tap to cancel voice transcription"
                  : pushToTalkKey
                    ? `Voice search (or hold ${pttLabel} to talk)`
                    : "Voice search"
          }
          aria-label={
            !isSupported
              ? "Voice search unavailable in this browser"
              : isListening
                ? "Stop listening"
                : "Start voice search"
          }
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-150",
            !isSupported
              ? "cursor-not-allowed bg-zinc-700 text-zinc-400 opacity-60"
              : isListening
                ? "cursor-pointer bg-primary text-white shadow-[0_0_0_4px_rgba(29,155,240,0.3)]"
                : isProcessing
                  ? "cursor-pointer bg-primary/20 text-primary"
                  : "cursor-pointer bg-[#f4f4f5] text-[#141414] hover:bg-white hover:scale-105 active:scale-95"
          )}
        >
          {!isSupported ? (
            <MicOff className="h-4 w-4" />
          ) : isProcessing && !isListening ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>
      </form>

      {downloadProgress !== null ? (
        <div className="mx-auto mt-2.5 max-w-md space-y-1.5 rounded-2xl border border-border/80 bg-card/85 px-4 py-2.5 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-foreground">
            <span>Downloading local voice engine (cached offline)</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-primary">
                {downloadProgress}%
              </span>
              <button
                type="button"
                onClick={stopListening}
                className="cursor-pointer rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-200"
              style={{ width: `${Math.max(4, downloadProgress)}%` }}
            />
          </div>
        </div>
      ) : statusMessage ? (
        <div
          role="status"
          className="mt-2 flex items-center justify-center gap-2 text-center text-xs font-medium text-primary"
        >
          {(isProcessing || !isListening) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={stopListening}
            aria-label="Cancel voice search"
            className="cursor-pointer rounded-full border border-primary/30 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10"
          >
            Cancel
          </button>
        </div>
      ) : voiceError ? (
        <div
          role="alert"
          className="mt-2.5 flex items-center justify-center gap-2 text-center text-xs font-medium text-destructive"
        >
          <span>{voiceError}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss voice error"
            className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-destructive/15"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : isSupported ? (
        <p className="mt-2 hidden items-center justify-center gap-2 text-[11px] text-muted-foreground sm:flex">
          <span>
            Press{" "}
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
              /
            </kbd>{" "}
            to type
          </span>
          {pushToTalkKey ? (
            <>
              <span aria-hidden="true">|</span>
              <span>
                Hold{" "}
                <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                  {pttLabel}
                </kbd>{" "}
                for push-to-talk voice
              </span>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
