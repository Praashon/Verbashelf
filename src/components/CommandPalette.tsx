"use client";

import React, { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FolderOpen,
  GraduationCap,
  Keyboard,
  Library,
  Moon,
  Search,
  Settings,
  Share2,
  Sun,
  User,
  X,
} from "lucide-react";
import { useAppUI } from "@/app/Providers";
import { useVault } from "@/hooks/useVault";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  group: "Navigate & Actions" | "Switch Topic";
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

const SHORTCUT_GROUPS: ReadonlyArray<{
  title: string;
  items: ReadonlyArray<{ keys: string; description: string }>;
}> = [
  {
    title: "Anywhere",
    items: [
      { keys: "Ctrl + K / T", description: "Open Quick Switcher & Topics" },
      { keys: "?", description: "Open Keyboard Shortcuts" },
      { keys: "g then l", description: "Go to Lookup page" },
      { keys: "g then v", description: "Go to Vault page" },
      { keys: "g then s", description: "Go to Study page" },
    ],
  },
  {
    title: "Lookup Page",
    items: [
      { keys: "/", description: "Focus the word search box" },
      { keys: "Push-to-talk key", description: "Hold to speak, release to search" },
    ],
  },
  {
    title: "Vault Page",
    items: [
      { keys: "/", description: "Focus Vault filter search" },
      { keys: "j / k or Up / Down", description: "Move focus between word cards" },
      { keys: "G", description: "Jump to the last visible word card" },
      { keys: "s", description: "Pronounce the focused word" },
      { keys: "x", description: "Select / deselect focused word" },
      { keys: "d", description: "Move focused word to Trash (with Undo)" },
      { keys: "Esc", description: "Clear focus and selection" },
    ],
  },
  {
    title: "Study Page",
    items: [
      { keys: "Space", description: "Reveal answer / flip flashcard" },
      { keys: "r", description: "Pronounce current word" },
      { keys: "1 / 2 / 3", description: "Grade Hard / Good / Easy" },
    ],
  },
];

function CommandPaletteBody({
  initialTab,
  onClose,
}: {
  initialTab: "commands" | "shortcuts";
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    theme,
    toggleTheme,
    storedTopicId,
    setActiveTopicId,
    setIsProfileOpen,
    setIsSettingsOpen,
    setIsShareOpen,
    showToast,
  } = useAppUI();
  const { topics, words } = useVault();

  const [tab, setTab] = useState<"commands" | "shortcuts">(initialTab);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const wordCountsByTopic = useMemo(() => {
    const map = new Map<number, number>();
    for (const word of words) {
      map.set(word.topicId, (map.get(word.topicId) ?? 0) + 1);
    }
    return map;
  }, [words]);

  const allItems = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      {
        id: "nav-lookup",
        group: "Navigate & Actions",
        label: "Go to Lookup",
        hint: "g then l",
        icon: <Search className="h-4 w-4 text-primary" />,
        run: () => {
          onClose();
          router.push("/");
        },
      },
      {
        id: "nav-vault",
        group: "Navigate & Actions",
        label: "Go to Vault",
        hint: "g then v",
        icon: <Library className="h-4 w-4 text-primary" />,
        run: () => {
          onClose();
          router.push("/vault");
        },
      },
      {
        id: "nav-study",
        group: "Navigate & Actions",
        label: "Go to Study & Review",
        hint: "g then s",
        icon: <GraduationCap className="h-4 w-4 text-primary" />,
        run: () => {
          onClose();
          router.push("/study");
        },
      },
      {
        id: "act-share",
        group: "Navigate & Actions",
        label: "Share Words via Link",
        icon: <Share2 className="h-4 w-4 text-primary" />,
        run: () => {
          onClose();
          setIsShareOpen(true);
        },
      },
      {
        id: "act-settings",
        group: "Navigate & Actions",
        label: "Open Settings & Import/Export",
        icon: <Settings className="h-4 w-4 text-primary" />,
        run: () => {
          onClose();
          setIsSettingsOpen(true);
        },
      },
      {
        id: "act-profile",
        group: "Navigate & Actions",
        label: "Edit Local Profile",
        icon: <User className="h-4 w-4 text-primary" />,
        run: () => {
          onClose();
          setIsProfileOpen(true);
        },
      },
      {
        id: "act-theme",
        group: "Navigate & Actions",
        label:
          theme === "light" ? "Switch to Dark Theme" : "Switch to Light Theme",
        icon:
          theme === "light" ? (
            <Moon className="h-4 w-4 text-primary" />
          ) : (
            <Sun className="h-4 w-4 text-amber-400" />
          ),
        run: () => {
          toggleTheme();
          onClose();
        },
      },
    ];

    const topicItems: CommandItem[] = topics
      .filter((t): t is typeof t & { id: number } => t.id !== undefined)
      .map((topic) => {
        const count = wordCountsByTopic.get(topic.id) ?? 0;
        const isCurrent = storedTopicId === topic.id;
        return {
          id: `topic-${topic.id}`,
          group: "Switch Topic",
          label: topic.name,
          hint: isCurrent
            ? `Active · ${count} ${count === 1 ? "word" : "words"}`
            : `${count} ${count === 1 ? "word" : "words"}`,
          icon: <FolderOpen className="h-4 w-4 text-primary" />,
          run: () => {
            setActiveTopicId(topic.id);
            onClose();
            showToast(`Active topic switched to "${topic.name}".`, "success");
            if (pathname.startsWith("/study")) {
              router.push(`/study?topic=${topic.id}`);
            } else if (
              pathname !== "/" &&
              !pathname.startsWith("/vault")
            ) {
              router.push("/");
            }
          },
        };
      });

    return [...topicItems, ...actions];
  }, [
    topics,
    wordCountsByTopic,
    storedTopicId,
    theme,
    pathname,
    router,
    onClose,
    setActiveTopicId,
    setIsProfileOpen,
    setIsSettingsOpen,
    setIsShareOpen,
    toggleTheme,
    showToast,
  ]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.hint?.toLowerCase().includes(q) ?? false)
    );
  }, [allItems, query]);

  const safeSelectedIndex =
    filteredItems.length === 0
      ? 0
      : Math.min(selectedIndex, filteredItems.length - 1);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (tab !== "commands" || filteredItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filteredItems.length) % filteredItems.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      filteredItems[safeSelectedIndex]?.run();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick Switcher and Keyboard Shortcuts"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-3 pt-14 backdrop-blur-sm sm:p-6 sm:pt-20"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex max-h-[82dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border bg-card-solid shadow-2xl animate-word-drop">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="inline-flex rounded-full border border-border bg-muted/60 p-0.5">
            <button
              type="button"
              onClick={() => setTab("commands")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                tab === "commands"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Quick Jump &amp; Topics</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("shortcuts")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                tab === "shortcuts"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Keyboard className="h-3.5 w-3.5" />
              <span>Keyboard Shortcuts</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick switcher"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {tab === "commands" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border/70 px-4 py-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder="Switch active topic or jump to a page..."
                  aria-label="Search topics and actions"
                  autoFocus
                  className="h-10 w-full rounded-xl border border-border bg-background/85 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-3">
              {filteredItems.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No matching topics or actions.
                </p>
              ) : (
                filteredItems.map((item, idx) => {
                  const selected = idx === safeSelectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.run}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors sm:text-sm",
                        selected
                          ? "bg-primary/12 text-foreground ring-1 ring-primary/35"
                          : "text-foreground hover:bg-muted/70"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        {item.icon}
                        <span className="truncate font-medium">{item.label}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {item.hint ?? item.group}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                  {group.title}
                </h3>
                <div className="divide-y divide-border/50 rounded-2xl border border-border/70 bg-background/55">
                  {group.items.map((row) => (
                    <div
                      key={row.keys + row.description}
                      className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs"
                    >
                      <span className="text-foreground">{row.description}</span>
                      <kbd className="shrink-0 rounded-md border border-border bg-card-solid px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                        {row.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommandPalette() {
  const { isCommandOpen, commandInitialTab, closeCommandPalette } = useAppUI();

  if (!isCommandOpen) {
    return null;
  }

  return (
    <CommandPaletteBody
      key={commandInitialTab}
      initialTab={commandInitialTab}
      onClose={closeCommandPalette}
    />
  );
}
