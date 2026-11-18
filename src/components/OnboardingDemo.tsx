"use client";

import { useEffect, useMemo, useState } from "react";
import LZString from "lz-string";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderOpen,
  GripVertical,
  Loader2,
  Mic,
  MousePointerClick,
  Play,
  RotateCcw,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useAppUI } from "@/app/Providers";
import { useVault } from "@/hooks/useVault";
import type { TypingSpeed } from "@/lib/db";
import { URL_SAFE_LIMIT } from "@/lib/share";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const STAGE_TITLES = [
  "Live Search & Voice",
  "Auto-Clear & Hover",
  "Drag Folders & Trash",
  "Share & Typing Speed",
];

function StageOneLookup() {
  const [typedText, setTypedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeDemoWord, setActiveDemoWord] = useState<"eloquent" | "serendipity">(
    "eloquent"
  );
  const [resultVisible, setResultVisible] = useState(false);
  const [mode, setMode] = useState<"concise" | "comprehensive">("concise");
  const [showExamples, setShowExamples] = useState(true);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const targetWord = "eloquent";
    let index = 0;
    let finishTimer: number | undefined;

    const typeInterval = window.setInterval(() => {
      index += 1;
      setTypedText(targetWord.slice(0, index));
      if (index >= targetWord.length) {
        window.clearInterval(typeInterval);
        setIsLoading(true);
        finishTimer = window.setTimeout(() => {
          setIsLoading(false);
          setActiveDemoWord("eloquent");
          setResultVisible(true);
        }, 420);
      }
    }, 85);

    return () => {
      window.clearInterval(typeInterval);
      if (finishTimer !== undefined) {
        window.clearTimeout(finishTimer);
      }
    };
  }, [runId]);

  const handleReplayTyping = () => {
    setResultVisible(false);
    setIsListening(false);
    setIsLoading(false);
    setTypedText("");
    setActiveDemoWord("eloquent");
    setRunId((n) => n + 1);
  };

  const handleSimulateVoice = () => {
    setResultVisible(false);
    setIsLoading(false);
    setIsListening(true);
    setTypedText("Listening...");

    window.setTimeout(() => {
      setIsListening(false);
      setTypedText("serendipity");
      setIsLoading(true);
      window.setTimeout(() => {
        setIsLoading(false);
        setActiveDemoWord("serendipity");
        setResultVisible(true);
      }, 360);
    }, 750);
  };

  const demoEntry =
    activeDemoWord === "eloquent"
      ? {
          word: "eloquent",
          phonetic: "/ˈɛl.əˌkwənt/",
          pos: "adjective",
          simple: "An eloquent person speaks fluently and persuasively.",
          defs: [
            {
              text: "Fluently persuasive and articulate in speech or writing.",
              example: "She gave an eloquent speech that moved the entire hall.",
            },
            {
              text: "Vividly or movingly expressive.",
              example: "His quiet expression was an eloquent plea for help.",
            },
            {
              text: "Relating to brain regions linked to speech and language.",
              example: "Neurosurgeons carefully map eloquent cortex areas.",
            },
          ],
        }
      : {
          word: "serendipity",
          phonetic: "/ˌsɛr.ənˈdɪp.ə.ti/",
          pos: "noun",
          simple: "Finding valuable or pleasant things purely by lucky chance.",
          defs: [
            {
              text: "The occurrence of finding fortunate things by unexpected luck.",
              example: "Meeting my mentor on that delayed train was pure serendipity.",
            },
            {
              text: "An aptitude for making desirable discoveries by accident.",
              example: "Scientific breakthroughs often combine rigor with serendipity.",
            },
            {
              text: "Coined in 1754 from the Persian fairy tale The Three Princes of Serendip.",
              example: "Literary historians trace serendipity back to Horace Walpole.",
            },
          ],
        };

  const visibleDefs =
    mode === "concise" ? demoEntry.defs.slice(0, 1) : demoEntry.defs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Watch the search pill resolve automatically, or try Voice and instant
          0 ms reshaping below.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReplayTyping}>
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Replay</span>
          </Button>
          <Button variant="primary" size="sm" onClick={handleSimulateVoice}>
            <Mic className="h-3.5 w-3.5" />
            <span>Try Voice</span>
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "mx-auto flex max-w-lg items-center gap-2 rounded-full border border-black/15 bg-[#141414] p-2 pl-4 text-zinc-100 shadow-lg transition-all dark:border-[#2f3336] dark:bg-[#16181c]",
          isListening && "ring-2 ring-primary animate-pulse"
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
        )}
        <span className="flex-1 truncate text-sm font-medium text-zinc-100">
          {typedText || <span className="text-zinc-500">Typing...</span>}
        </span>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
            isListening
              ? "bg-primary text-white"
              : "bg-[#f4f4f5] text-[#141414]"
          )}
        >
          <Mic className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="inline-flex rounded-full border border-border bg-muted/60 p-0.5">
          <button
            type="button"
            onClick={() => setMode("concise")}
            className={cn(
              "cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              mode === "concise"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Concise
          </button>
          <button
            type="button"
            onClick={() => setMode("comprehensive")}
            className={cn(
              "cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              mode === "comprehensive"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Comprehensive
          </button>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground">
          <span>Examples</span>
          <Switch
            checked={showExamples}
            onCheckedChange={setShowExamples}
            aria-label="Toggle demo examples"
          />
        </label>
      </div>

      <div className="min-h-[190px]">
        {resultVisible ? (
          <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-md animate-word-drop">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl font-bold capitalize text-foreground">
                  {demoEntry.word}
                </h3>
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {demoEntry.phonetic}
                </span>
              </div>
              <Badge variant="violet">Auto-saved to General</Badge>
            </div>

            <p className="mt-2.5 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2 text-xs text-foreground">
              <span className="mr-1 font-semibold uppercase text-primary">
                In plain English:
              </span>
              {demoEntry.simple}
            </p>

            <div className="mt-3 space-y-2">
              <span className="inline-block rounded bg-primary/14 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                {demoEntry.pos}
              </span>
              {visibleDefs.map((def, i) => (
                <div key={def.text} className="space-y-1 text-xs sm:text-sm">
                  <p className="text-foreground">
                    <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                      {i + 1}.
                    </span>
                    {def.text}
                  </p>
                  {showExamples ? (
                    <p className="border-l-2 border-primary/40 pl-2.5 text-xs italic text-muted-foreground">
                      &ldquo;{def.example}&rdquo;
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-[190px] items-center justify-center rounded-2xl border border-dashed border-border text-xs text-muted-foreground">
            {isListening
              ? "Listening for spoken word..."
              : isLoading
                ? "Fetching multi-source definitions..."
                : "Typing word..."}
          </div>
        )}
      </div>
    </div>
  );
}

function StageTwoFaded() {
  const [barText, setBarText] = useState("ephemeral");
  const [dropped, setDropped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      setBarText("");
      setDropped(true);
    }, 650);

    return () => window.clearTimeout(t1);
  }, [runId]);

  const handleReplay = () => {
    setDropped(false);
    setHovered(false);
    setBarText("ephemeral");
    setRunId((n) => n + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground sm:text-sm">
          With <strong>Auto-clear</strong> enabled, the pill clears after your
          answer arrives and drops cards below in a faded stream.
        </p>
        <Button variant="outline" size="sm" onClick={handleReplay}>
          <Play className="h-3.5 w-3.5" />
          <span>Replay Auto-Clear</span>
        </Button>
      </div>

      <div className="mx-auto flex max-w-lg items-center justify-between gap-2 rounded-full border border-black/15 bg-[#141414] px-4 py-2.5 text-sm text-zinc-100 shadow-md dark:border-[#2f3336] dark:bg-[#16181c]">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-zinc-400" />
          <span className={barText ? "text-zinc-100" : "text-zinc-500"}>
            {barText || "Cleared! Ready for your next word..."}
          </span>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
          {dropped ? "Auto-cleared" : "Saving..."}
        </span>
      </div>

      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5 text-primary" />
            <span>Hover or tap the faded card below to test the pop-up</span>
          </span>
          <Badge variant={hovered ? "primary" : "secondary"}>
            {hovered ? "Full color unlocked!" : "Waiting for hover"}
          </Badge>
        </div>

        {dropped ? (
          <div
            onMouseEnter={() => setHovered(true)}
            onClick={() => setHovered(true)}
            className={cn(
              "group cursor-pointer rounded-2xl border p-5 backdrop-blur-md transition-all duration-300 ease-out animate-word-drop",
              "border-slate-200/80 bg-white/55 opacity-60 saturate-[0.14] scale-[0.985]",
              "dark:border-zinc-800/80 dark:bg-[#16181c]/55",
              "hover:opacity-100 hover:saturate-100 hover:scale-[1.02] hover:-translate-y-1.5",
              "hover:border-primary/60 hover:bg-white/95 hover:shadow-[0_22px_48px_-14px_rgba(29,155,240,0.34)]",
              "dark:hover:bg-[#16181c]/95"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl font-bold capitalize text-slate-600 transition-colors group-hover:text-foreground dark:text-zinc-300 dark:group-hover:text-white">
                  ephemeral
                </h3>
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors group-hover:bg-primary/12 group-hover:text-primary">
                  /ɪˈfɛm.ər.əl/
                </span>
              </div>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary">
                Daily Reading
              </span>
            </div>

            <p className="mt-2.5 text-sm text-slate-700 transition-colors group-hover:text-foreground dark:text-zinc-300 dark:group-hover:text-zinc-100">
              Lasting for a very short time; fleeting or transitory.
            </p>
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-border text-xs text-muted-foreground">
            Resolving &quot;ephemeral&quot;...
          </div>
        )}
      </div>
    </div>
  );
}

function StageThreeDragTrash() {
  const [folder, setFolder] = useState<"general" | "lotr" | "trash">("general");
  const [isOverLotr, setIsOverLotr] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Drag <strong>welkin</strong> from <strong>General</strong> onto{" "}
          <strong>Lord of the Rings</strong>, or test deleting and restoring from{" "}
          <strong>Trash</strong>.
        </p>
        <Badge variant="outline">
          Location:{" "}
          {folder === "general"
            ? "General"
            : folder === "lotr"
              ? "Lord of the Rings"
              : "Trash"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setFolder("general");
          }}
          className="rounded-2xl border border-border bg-card/80 p-3.5"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <FolderOpen className="h-3.5 w-3.5 text-primary" />
              <span>General</span>
            </span>
            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {folder === "general" ? 1 : 0}
            </span>
          </div>

          {folder === "general" ? (
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", "welkin");
              }}
              className="cursor-grab rounded-xl border border-border bg-card-solid p-3 shadow-xs transition-transform hover:-translate-y-0.5 active:cursor-grabbing"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-bold capitalize text-foreground">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>welkin</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFolder("trash")}
                  title="Move to Trash"
                  className="cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The sky or upper atmosphere; heaven.
              </p>
              <button
                type="button"
                onClick={() => setFolder("lotr")}
                className="mt-2 cursor-pointer text-[11px] font-semibold text-primary hover:underline"
              >
                Or tap to move to Lord of the Rings
              </button>
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
              {folder === "lotr" ? "Moved to LotR!" : "Moved to Trash"}
            </div>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsOverLotr(true);
          }}
          onDragLeave={() => setIsOverLotr(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsOverLotr(false);
            setFolder("lotr");
          }}
          className={cn(
            "rounded-2xl border p-3.5 transition-all",
            isOverLotr
              ? "border-primary bg-primary/10 ring-2 ring-primary/40 scale-[1.02]"
              : "border-border bg-card/80"
          )}
        >
          <div className="mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <FolderOpen className="h-3.5 w-3.5 text-primary" />
              <span>Lord of the Rings</span>
            </span>
            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {folder === "lotr" ? 1 : 0}
            </span>
          </div>

          {folder === "lotr" ? (
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", "welkin");
              }}
              className="cursor-grab rounded-xl border border-primary/40 bg-card-solid p-3 shadow-xs animate-word-drop active:cursor-grabbing"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-bold capitalize text-foreground">
                  <GripVertical className="h-3.5 w-3.5 text-primary" />
                  <span>welkin</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFolder("trash")}
                  title="Move to Trash"
                  className="cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The sky or upper atmosphere; heaven.
              </p>
              <button
                type="button"
                onClick={() => setFolder("general")}
                className="mt-2 cursor-pointer text-[11px] font-semibold text-muted-foreground hover:text-primary hover:underline"
              >
                Move back to General
              </button>
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-primary/40 text-xs font-medium text-primary">
              Drop &quot;welkin&quot; here
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-xs">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
          <span>
            {folder === "trash"
              ? '"welkin" is safely in Trash. Recover it anytime!'
              : "Deleted words go to Trash first so nothing is lost by accident."}
          </span>
        </span>
        {folder === "trash" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFolder("general")}
          >
            <RotateCcw className="h-3 w-3 text-primary" />
            <span>Restore (Undo)</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const DEMO_SHARE_ITEMS = [
  {
    term: "eloquent",
    topic: "Daily Reading",
    conciseMeaning: "Fluently persuasive and articulate.",
  },
  {
    term: "ephemeral",
    topic: "Daily Reading",
    conciseMeaning: "Lasting for a very short time.",
  },
  {
    term: "welkin",
    topic: "Lord of the Rings",
    conciseMeaning: "The sky or upper atmosphere.",
  },
];

const TYPING_OPTIONS: Array<{
  value: TypingSpeed;
  label: string;
  hint: string;
}> = [
  { value: "fast", label: "Fast", hint: "450 ms" },
  { value: "balanced", label: "Balanced", hint: "950 ms" },
  { value: "relaxed", label: "Relaxed", hint: "1.6 s" },
  { value: "manual", label: "Manual", hint: "Enter key" },
];

function StageFourShare() {
  const { profile, updateProfile } = useVault();
  const [selectedTerms, setSelectedTerms] = useState<string[]>([
    "eloquent",
    "welkin",
  ]);

  const toggleTerm = (term: string) => {
    setSelectedTerms((prev) =>
      prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term]
    );
  };

  const livePreview = useMemo(() => {
    const items = DEMO_SHARE_ITEMS.filter((item) =>
      selectedTerms.includes(item.term)
    );
    if (items.length === 0) {
      return { url: "", length: 0, percent: 0 };
    }
    const compressed = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, items })
    );
    const url = `https://verbashelf.app/share#v1=${compressed}`;
    return {
      url,
      length: url.length,
      percent: Math.min(100, Math.round((url.length / URL_SAFE_LIMIT) * 100)),
    };
  }, [selectedTerms]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground sm:text-sm">
        Share curated words via a compressed <code className="font-mono">#v1=</code>{" "}
        URL with zero database, and choose how quickly VerbaShelf searches while
        you type.
      </p>

      <div className="rounded-2xl border border-border bg-card/90 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Share2 className="h-3.5 w-3.5 text-primary" />
            <span>Toggle words to see live #v1= URL compression</span>
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {livePreview.length} / {URL_SAFE_LIMIT.toLocaleString()} chars
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {DEMO_SHARE_ITEMS.map((item) => {
            const active = selectedTerms.includes(item.term);
            return (
              <button
                key={item.term}
                type="button"
                onClick={() => toggleTerm(item.term)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/12 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground"
                )}
              >
                <Check
                  className={cn("h-3 w-3", active ? "opacity-100" : "opacity-0")}
                />
                <span className="capitalize">{item.term}</span>
              </button>
            );
          })}
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${Math.max(4, livePreview.percent)}%` }}
          />
        </div>

        <div className="truncate rounded-xl border border-border/70 bg-background/80 px-3 py-2 font-mono text-[11px] text-muted-foreground">
          {livePreview.url || "Select at least 1 word to generate share URL"}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/90 p-4 space-y-2.5">
        <div>
          <p className="text-xs font-bold text-foreground">
            Set Your Typing Speed (changeable anytime in Settings)
          </p>
          <p className="text-[11px] text-muted-foreground">
            Pick a slower pause or Manual mode if you type long words like
            supercalifragilisticexpialidocious.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TYPING_OPTIONS.map((opt) => {
            const selected = profile.typingSpeed === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => void updateProfile({ typingSpeed: opt.value })}
                className={cn(
                  "flex cursor-pointer flex-col items-start rounded-xl border px-3 py-2 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/12 ring-1 ring-primary/40"
                    : "border-border hover:border-primary/40"
                )}
              >
                <span className="text-xs font-semibold text-foreground">
                  {opt.label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function OnboardingDemo() {
  const { isOnboardingOpen, closeOnboarding } = useAppUI();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isOnboardingOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeOnboarding();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOnboardingOpen, closeOnboarding]);

  if (!isOnboardingOpen) {
    return null;
  }

  const handleClose = () => {
    setStep(0);
    closeOnboarding();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-demo-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2.5 backdrop-blur-sm sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card-solid shadow-2xl animate-word-drop">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Interactive Live Guide (Step {step + 1} of {STAGE_TITLES.length})
            </p>
            <h2
              id="onboarding-demo-title"
              className="truncate text-base font-bold text-foreground sm:text-lg"
            >
              {STAGE_TITLES[step]}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="hidden sm:inline-flex"
            >
              Skip
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Skip and close live guide"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 border-b border-border/60 bg-muted/35 px-4 py-2 sm:grid-cols-4 sm:px-6 sm:py-2.5">
          {STAGE_TITLES.map((title, idx) => (
            <button
              key={title}
              type="button"
              onClick={() => setStep(idx)}
              className={cn(
                "cursor-pointer truncate rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold transition-colors sm:py-1",
                step === idx
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {idx + 1}. {title.split(" ")[0]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {step === 0 ? (
            <StageOneLookup key="stage-1" />
          ) : step === 1 ? (
            <StageTwoFaded key="stage-2" />
          ) : step === 2 ? (
            <StageThreeDragTrash key="stage-3" />
          ) : (
            <StageFourShare key="stage-4" />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 sm:gap-3 sm:px-6 sm:py-3.5">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Skip Tour
              </Button>
            )}
          </div>

          {step < STAGE_TITLES.length - 1 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                setStep((s) => Math.min(STAGE_TITLES.length - 1, s + 1))
              }
            >
              <span>Next Demo</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={handleClose}>
              <Check className="h-3.5 w-3.5" />
              <span>Start Using VerbaShelf</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
