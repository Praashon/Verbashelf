"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Keyboard,
  Moon,
  Play,
  Scale,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import { useAppUI } from "@/app/Providers";
import { useVault } from "@/hooks/useVault";
import { formatShortcutKeyLabel, type TypingSpeed } from "@/lib/db";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { triggerPwaInstall, usePwaStatus } from "@/lib/pwa";
import {
  exportVaultBackup,
  importVaultBackup,
  wipeVaultData,
} from "@/lib/backup";
import {
  exportWordsAsAnkiTxt,
  exportWordsAsCsv,
  importWordListRows,
  parseWordListFile,
} from "@/lib/portability";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function SettingsDrawer() {
  const {
    theme,
    setTheme,
    isSettingsOpen,
    setIsSettingsOpen,
    storedTopicId,
    setActiveTopicId,
    openOnboarding,
    openCommandPalette,
    showToast,
  } = useAppUI();
  const { profile, updateProfile, topics, words, topicNameById } = useVault();
  const pwa = usePwaStatus();

  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [fetchOnListImport, setFetchOnListImport] = useState(true);
  const [listImportProgress, setListImportProgress] = useState<string | null>(
    null
  );
  const [listImportStatus, setListImportStatus] = useState<string | null>(null);
  const [listImportError, setListImportError] = useState<string | null>(null);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isCapturingKey, setIsCapturingKey] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const listFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isCapturingKey || !isSettingsOpen) return;

    const handleCaptureKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.code === "Escape") {
        setIsCapturingKey(false);
        setShortcutError(null);
        return;
      }

      const blockedCodes = new Set([
        "Slash",
        "Enter",
        "NumpadEnter",
        "Tab",
        "Backspace",
        "Delete",
      ]);

      if (blockedCodes.has(event.code)) {
        setShortcutError(
          `"${formatShortcutKeyLabel(event.code)}" is reserved for typing or navigation. Try another key.`
        );
        return;
      }

      setShortcutError(null);
      setIsCapturingKey(false);
      void updateProfile({ pushToTalkKey: event.code });
    };

    window.addEventListener("keydown", handleCaptureKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleCaptureKey, { capture: true });
  }, [isCapturingKey, isSettingsOpen, updateProfile]);

  if (!isSettingsOpen) {
    return null;
  }

  const handleExport = async () => {
    setIsBusy(true);
    try {
      const filename = await exportVaultBackup();
      showToast(`Exported ${filename}`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to export backup.",
        "error"
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportStatus(null);
    setIsBusy(true);

    try {
      const text = await file.text();
      const result = await importVaultBackup(text, importMode);
      const summary = `Imported ${result.wordsAdded} words and ${result.topicsAdded} topics (${result.wordsSkipped} skipped).`;
      setImportStatus(summary);
      showToast(summary, "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to import backup JSON.";
      setImportError(message);
      showToast(message, "error");
    } finally {
      event.target.value = "";
      setIsBusy(false);
    }
  };

  const handleExportAnki = () => {
    if (words.length === 0) {
      showToast("Save at least one word before exporting.", "info");
      return;
    }
    const filename = exportWordsAsAnkiTxt(words, topicNameById);
    showToast(`Exported ${filename}`, "success");
  };

  const handleExportCsv = () => {
    if (words.length === 0) {
      showToast("Save at least one word before exporting.", "info");
      return;
    }
    const filename = exportWordsAsCsv(words, topicNameById);
    showToast(`Exported ${filename}`, "success");
  };

  const handleImportWordListFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setListImportError(null);
    setListImportStatus(null);
    setListImportProgress(null);
    setIsBusy(true);

    try {
      const text = await file.text();
      const rows = parseWordListFile(text, file.name);
      if (rows.length === 0) {
        throw new Error(
          "No valid words found. Provide one word per line or a CSV/TSV with a word column."
        );
      }

      const defaultTopicId =
        (storedTopicId !== null && topics.some((t) => t.id === storedTopicId)
          ? storedTopicId
          : topics[0]?.id) ?? 1;

      const result = await importWordListRows({
        rows,
        defaultTopicId,
        fetchDefinitions: fetchOnListImport,
        onProgress: (done, total, currentWord) => {
          setListImportProgress(
            `Importing ${done}/${total}: ${currentWord}...`
          );
        },
      });

      const summary = `Added ${result.added} words (${result.enriched} enriched online, ${result.topicsCreated} topics created, ${result.skipped} skipped).`;
      setListImportStatus(summary);
      showToast(summary, "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to import word list.";
      setListImportError(message);
      showToast(message, "error");
    } finally {
      event.target.value = "";
      setListImportProgress(null);
      setIsBusy(false);
    }
  };

  const handleWipe = async () => {
    if (wipeConfirmText.trim() !== "DELETE") return;
    setIsBusy(true);
    try {
      await wipeVaultData();
      setWipeConfirmText("");
      setImportStatus(null);
      setImportError(null);
      const firstTopicId = topics[0]?.id;
      if (firstTopicId !== undefined) {
        setActiveTopicId(firstTopicId);
      }
      showToast("All local vault data wiped cleanly.", "info");
      setIsSettingsOpen(false);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsSettingsOpen(false);
        }
      }}
    >
      <aside className="flex h-[100dvh] w-full max-w-md flex-col border-l border-border bg-card-solid shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5 sm:px-6 sm:py-4">
          <div>
            <h2
              id="settings-drawer-title"
              className="text-lg font-bold text-foreground"
            >
              Settings & Vault Data
            </h2>
            <p className="text-xs text-muted-foreground">
              {words.length} words · {topics.length} topics stored locally
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(false)}
            aria-label="Close settings drawer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 pb-8 sm:px-6 sm:py-5">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Appearance
              </h3>
              <p className="text-xs text-muted-foreground">
                Light theme is default; switch anytime for low-light reading.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 text-left transition-all",
                  theme === "light"
                    ? "border-primary bg-primary/8 ring-1 ring-primary/40"
                    : "border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sun className="h-4 w-4 text-amber-500" />
                    Light
                  </span>
                  <span
                    className={cn(
                      "h-3.5 w-3.5 rounded-full border-2",
                      theme === "light"
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    )}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  Crisp white & soft violet glow
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 text-left transition-all",
                  theme === "dark"
                    ? "border-primary bg-primary/12 ring-1 ring-primary/40"
                    : "border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Moon className="h-4 w-4 text-primary" />
                    Dark
                  </span>
                  <span
                    className={cn(
                      "h-3.5 w-3.5 rounded-full border-2",
                      theme === "dark"
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    )}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  Obsidian surfaces & sky blue
                </span>
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Lookup Defaults
            </h3>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Detail Mode
                </p>
                <p className="text-xs text-muted-foreground">
                  Reshapes definitions in 0 ms
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
                <button
                  type="button"
                  onClick={() => updateProfile({ defaultMode: "concise" })}
                  className={cn(
                    "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    profile.defaultMode === "concise"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Concise
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateProfile({ defaultMode: "comprehensive" })
                  }
                  className={cn(
                    "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    profile.defaultMode === "comprehensive"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Full
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <label
                htmlFor="settings-show-examples"
                className="flex-1 cursor-pointer"
              >
                <p className="text-sm font-medium text-foreground">
                  Show Examples
                </p>
                <p className="text-xs text-muted-foreground">
                  Include usage sentences on cards
                </p>
              </label>
              <Switch
                id="settings-show-examples"
                checked={profile.defaultExamples}
                onCheckedChange={(checked) => {
                  void updateProfile({ defaultExamples: checked });
                }}
                aria-label="Default show examples"
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <label
                htmlFor="settings-auto-clear"
                className="flex-1 cursor-pointer"
              >
                <p className="text-sm font-medium text-foreground">
                  Auto-clear & Faded Stream
                </p>
                <p className="text-xs text-muted-foreground">
                  Clear the search bar once the answer arrives and drop cards into faded hover-to-pop-up mode below
                </p>
              </label>
              <Switch
                id="settings-auto-clear"
                checked={profile.autoClearSearch}
                onCheckedChange={(checked) => {
                  void updateProfile({ autoClearSearch: checked });
                }}
                aria-label="Auto-clear search bar after answer resolves"
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <label
                htmlFor="settings-show-stats"
                className="flex-1 cursor-pointer"
              >
                <p className="text-sm font-medium text-foreground">
                  Show Learning Stats
                </p>
                <p className="text-xs text-muted-foreground">
                  Display local daily review count, streak, and mastery strip in Vault &amp; Study
                </p>
              </label>
              <Switch
                id="settings-show-stats"
                checked={profile.showStats}
                onCheckedChange={(checked) => {
                  void updateProfile({ showStats: checked });
                }}
                aria-label="Show local learning stats strip"
              />
            </div>

            <div className="space-y-2 border-t border-border/60 pt-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Typing Speed (Lookup Delay)
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile.typingSpeed === "fast"
                    ? "Fast: searches 450 ms after you pause typing."
                    : profile.typingSpeed === "balanced"
                      ? "Balanced: searches 950 ms after you pause (recommended)."
                      : profile.typingSpeed === "relaxed"
                        ? "Relaxed: waits 1.6 s so you can finish long words cleanly."
                        : "Manual: press Enter, Go, or use Voice Mic to search."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/60 p-1 sm:grid-cols-4">
                {(
                  [
                    { value: "fast", label: "Fast" },
                    { value: "balanced", label: "Balanced" },
                    { value: "relaxed", label: "Relaxed" },
                    { value: "manual", label: "Manual" },
                  ] as Array<{ value: TypingSpeed; label: string }>
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      void updateProfile({ typingSpeed: option.value })
                    }
                    className={cn(
                      "cursor-pointer rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                      profile.typingSpeed === option.value
                        ? "bg-primary text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 border-t border-border/60 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Push-to-Talk Shortcut
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hold this key to talk, release to search.
                  </p>
                </div>

                <Button
                  variant={isCapturingKey ? "primary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setShortcutError(null);
                    setIsCapturingKey((prev) => !prev);
                  }}
                >
                  <Keyboard className="h-3.5 w-3.5" />
                  <span>
                    {isCapturingKey
                      ? "Press any key..."
                      : `Key: ${formatShortcutKeyLabel(profile.pushToTalkKey)}`}
                  </span>
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { code: "Space", label: "Space" },
                    { code: "KeyV", label: "V" },
                    { code: "Backquote", label: "`" },
                    { code: "AltRight", label: "Right Alt" },
                    { code: "", label: "Off" },
                  ] as const
                ).map((preset) => {
                  const active = profile.pushToTalkKey === preset.code;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setIsCapturingKey(false);
                        setShortcutError(null);
                        void updateProfile({ pushToTalkKey: preset.code });
                      }}
                      className={cn(
                        "cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/12 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {isCapturingKey ? (
                <p className="text-xs font-medium text-primary">
                  Press any key now to bind it (Esc to cancel).
                </p>
              ) : null}
              {shortcutError ? (
                <p className="text-xs font-medium text-destructive">
                  {shortcutError}
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Guide &amp; Shortcuts
                </h3>
                <p className="text-xs text-muted-foreground">
                  Replay the demo or view keyboard shortcuts.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    openCommandPalette("shortcuts");
                  }}
                >
                  <Keyboard className="h-3.5 w-3.5 text-primary" />
                  <span>?</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    openOnboarding();
                  }}
                >
                  <Play className="h-3.5 w-3.5 text-primary" />
                  <span>Demo</span>
                </Button>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span>App Install &amp; Offline (PWA)</span>
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Saved Vault words, smart review sessions, pronunciation speech,
                  and cached Whisper AI work without internet.
                </p>
              </div>
              {!pwa.isOnline ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  <WifiOff className="h-3 w-3" />
                  <span>Offline</span>
                </span>
              ) : null}
            </div>

            {pwa.isStandalone ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Installed as a standalone offline-ready app</span>
              </div>
            ) : pwa.canInstall ? (
              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={() => {
                  void triggerPwaInstall().then((outcome) => {
                    if (outcome === "accepted") {
                      showToast("VerbaShelf installed on your device.", "success");
                    }
                  });
                }}
              >
                <Download className="h-4 w-4" />
                <span>Install VerbaShelf App</span>
              </Button>
            ) : pwa.isIos ? (
              <p className="rounded-xl border border-border/70 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                On iPhone or iPad, tap Safari&apos;s <strong className="text-foreground">Share</strong> button and choose{" "}
                <strong className="text-foreground">Add to Home Screen</strong>.
              </p>
            ) : (
              <p className="rounded-xl border border-border/70 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Install anytime from your browser&apos;s address bar or menu to run
                VerbaShelf in its own app window.
              </p>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-border p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Import &amp; Export
              </h3>
              <p className="text-xs text-muted-foreground">
                Export JSON backups, Anki decks, or CSV spreadsheets, and import word lists.
              </p>
            </div>

            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={handleExport}
              disabled={isBusy}
            >
              <Download className="h-4 w-4" />
              <span>Export Full Backup (.json)</span>
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="justify-center"
                onClick={handleExportAnki}
                disabled={isBusy || words.length === 0}
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                <span>Export Anki (.txt)</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-center"
                onClick={handleExportCsv}
                disabled={isBusy || words.length === 0}
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                <span>Export CSV (.csv)</span>
              </Button>
            </div>

            <div className="space-y-2 border-t border-border/60 pt-3">
              <div className="flex flex-col items-stretch gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-foreground">JSON Backup Import</span>
                <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/60 p-0.5 sm:inline-flex">
                  <button
                    type="button"
                    onClick={() => setImportMode("merge")}
                    className={cn(
                      "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      importMode === "merge"
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Merge (skip existing)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("replace")}
                    className={cn(
                      "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      importMode === "replace"
                        ? "bg-destructive text-white"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Replace All
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
              >
                <Upload className="h-4 w-4" />
                <span>
                  Import JSON ({importMode === "merge" ? "Merge" : "Replace All"})
                </span>
              </Button>

              {importStatus ? (
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {importStatus}
                </p>
              ) : null}
              {importError ? (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                >
                  {importError}
                </p>
              ) : null}
            </div>

            <div className="space-y-2 border-t border-border/60 pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">
                  Import Word List (.txt / .csv)
                </span>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={fetchOnListImport}
                  onChange={(e) => setFetchOnListImport(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span>Auto-fetch definitions for plain word lists</span>
              </label>

              <input
                ref={listFileInputRef}
                type="file"
                accept=".txt,.csv,.tsv,text/plain,text/csv"
                onChange={handleImportWordListFile}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => listFileInputRef.current?.click()}
                disabled={isBusy}
              >
                <Upload className="h-4 w-4 text-primary" />
                <span>Import Word List (.txt / .csv / .tsv)</span>
              </Button>

              {listImportProgress ? (
                <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                  {listImportProgress}
                </p>
              ) : null}
              {listImportStatus ? (
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {listImportStatus}
                </p>
              ) : null}
              {listImportError ? (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                >
                  {listImportError}
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Privacy &amp; Legal
              </h3>
              <p className="text-xs text-muted-foreground">
                Transparent local-first policies &amp; operator details
              </p>
            </div>

            <div className="space-y-1.5">
              <Link
                href="/privacy"
                onClick={() => setIsSettingsOpen(false)}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/70"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>Privacy Policy</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>

              <Link
                href="/terms"
                onClick={() => setIsSettingsOpen(false)}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/70"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Terms of Service</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>

              <Link
                href="/legal"
                onClick={() => setIsSettingsOpen(false)}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/70"
              >
                <span className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  <span>Legal Notice, Cookies &amp; Storage</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </div>

            <div className="border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
              <p>
                Operated by {LEGAL_OPERATOR.name} &middot;{" "}
                {LEGAL_OPERATOR.location}
              </p>
              <a
                href={`mailto:${LEGAL_OPERATOR.email}`}
                className="font-medium text-primary hover:underline"
              >
                {LEGAL_OPERATOR.email}
              </a>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-destructive/35 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <h3 className="text-sm font-semibold text-destructive">
                  Danger Zone: Wipe Local Vault
                </h3>
                <p className="text-xs text-muted-foreground">
                  Permanently clears all saved words, custom topics, and profile settings from this browser. Type <code className="font-mono font-bold text-foreground">DELETE</code> to confirm.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value)}
                placeholder="Type DELETE"
                aria-label="Type DELETE to confirm wiping all local vault data"
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background/90 px-3 font-mono text-base text-foreground focus:border-destructive focus:outline-none sm:h-9 sm:text-xs"
              />
              <Button
                variant="destructive"
                size="sm"
                disabled={wipeConfirmText.trim() !== "DELETE" || isBusy}
                onClick={handleWipe}
                className="w-full justify-center sm:w-auto"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Wipe All</span>
              </Button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
