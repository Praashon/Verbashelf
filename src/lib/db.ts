import Dexie, { type Table } from "dexie";
import type { DisplayMode, NormalizedDictionaryEntry } from "@/lib/dictionary";

export interface TopicRecord {
  id?: number;
  name: string;
  createdAt: number;
}

export interface WordRecord {
  id?: number;
  term: string;
  topicId: number;
  phonetic: string | null;
  audioUrl: string | null;
  rawEntry: NormalizedDictionaryEntry;
  savedMode: DisplayMode;
  savedWithExamples: boolean;
  dateKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface TrashWordRecord {
  id?: number;
  term: string;
  originalTopicId: number;
  originalTopicName: string;
  phonetic: string | null;
  audioUrl: string | null;
  rawEntry: NormalizedDictionaryEntry;
  savedMode: DisplayMode;
  savedWithExamples: boolean;
  dateKey: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}

export type TypingSpeed = "fast" | "balanced" | "relaxed" | "manual";

export const TYPING_SPEED_DELAY_MS: Record<TypingSpeed, number | null> = {
  fast: 450,
  balanced: 950,
  relaxed: 1600,
  manual: null,
};

export interface ProfileRecord {
  id: "me";
  displayName: string;
  avatarDataUrl: string | null;
  defaultMode: DisplayMode;
  defaultExamples: boolean;
  autoClearSearch: boolean;
  typingSpeed: TypingSpeed;
  pushToTalkKey: string;
}

export const DEFAULT_TOPIC_NAME = "General";

export const DEFAULT_PROFILE: ProfileRecord = {
  id: "me",
  displayName: "Reader",
  avatarDataUrl: null,
  defaultMode: "concise",
  defaultExamples: true,
  autoClearSearch: false,
  typingSpeed: "balanced",
  pushToTalkKey: "Space",
};

const SPECIAL_KEY_LABELS: Record<string, string> = {
  Space: "Space",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  AltLeft: "Left Alt",
  AltRight: "Right Alt",
  ControlLeft: "Left Ctrl",
  ControlRight: "Right Ctrl",
  ShiftLeft: "Left Shift",
  ShiftRight: "Right Shift",
  MetaLeft: "Left Meta",
  MetaRight: "Right Meta",
  CapsLock: "Caps Lock",
};

export function formatShortcutKeyLabel(code: string): string {
  if (!code) return "Off";
  if (SPECIAL_KEY_LABELS[code]) return SPECIAL_KEY_LABELS[code];
  if (code.startsWith("Key") && code.length === 4) {
    return code.slice(3);
  }
  if (code.startsWith("Digit") && code.length === 6) {
    return code.slice(5);
  }
  if (code.startsWith("Numpad")) {
    return `Num ${code.slice(6)}`;
  }
  return code;
}

export function isNonTypingShortcutKey(code: string): boolean {
  return (
    code === "AltLeft" ||
    code === "AltRight" ||
    code === "ControlLeft" ||
    code === "ControlRight" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    /^F(?:[1-9]|1[0-2])$/.test(code)
  );
}

class VerbaShelfDB extends Dexie {
  topics!: Table<TopicRecord, number>;
  words!: Table<WordRecord, number>;
  profile!: Table<ProfileRecord, string>;
  trash!: Table<TrashWordRecord, number>;

  constructor() {
    super("VerbaShelfDB");
    this.version(1).stores({
      topics: "++id, name, createdAt",
      words: "++id, term, topicId, [term+topicId], dateKey, createdAt, updatedAt",
      profile: "id",
    });

    this.version(2).stores({
      topics: "++id, name, createdAt",
      words: "++id, term, topicId, [term+topicId], dateKey, createdAt, updatedAt",
      profile: "id",
      trash: "++id, term, deletedAt",
    });

    this.on("populate", (tx) => {
      void tx.table("topics").add({
        name: DEFAULT_TOPIC_NAME,
        createdAt: Date.now(),
      });
      void tx.table("profile").put({ ...DEFAULT_PROFILE });
    });
  }
}

export const db = new VerbaShelfDB();

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatReadableDate(dateKey: string): string {
  const parts = dateKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return dateKey;
  }
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

let seedInFlight: Promise<void> | null = null;

export async function ensureInitialSeed(forceCheck = false): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (forceCheck) {
    seedInFlight = null;
  }

  if (!seedInFlight) {
    seedInFlight = (async () => {
      await db.transaction("rw", db.topics, db.profile, async () => {
        const topicCount = await db.topics.count();
        if (topicCount === 0) {
          await db.topics.add({
            name: DEFAULT_TOPIC_NAME,
            createdAt: Date.now(),
          });
        }

        const existingProfile = await db.profile.get("me");
        if (!existingProfile) {
          await db.profile.put({ ...DEFAULT_PROFILE });
        }
      });
    })().catch((err) => {
      seedInFlight = null;
      throw err;
    });
  }

  return seedInFlight;
}
