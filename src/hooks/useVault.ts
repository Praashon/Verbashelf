"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  DEFAULT_PROFILE,
  DEFAULT_TOPIC_NAME,
  ensureInitialSeed,
  getLocalDateKey,
  type DailyStatRecord,
  type ProfileRecord,
  type ReviewRating,
  type TopicRecord,
  type TrashWordRecord,
  type WordRecord,
  type WordSrsState,
} from "@/lib/db";
import {
  normalizeTerm,
  type DisplayMode,
  type NormalizedDictionaryEntry,
} from "@/lib/dictionary";
import {
  computeNextSrsState,
  isWordDue,
  sortReviewQueue,
} from "@/lib/srs";
import { computeVaultStats, type VaultStats } from "@/lib/stats";

export interface UpsertWordParams {
  entry: NormalizedDictionaryEntry;
  topicId: number;
  savedMode: DisplayMode;
  savedWithExamples: boolean;
}

export interface UpsertWordResult {
  wordId: number;
  wasExisting: boolean;
  previousDateKey: string | null;
  previousUpdatedAt: number | null;
}

interface VaultContextValue {
  topics: TopicRecord[];
  words: WordRecord[];
  trashWords: TrashWordRecord[];
  dailyStats: DailyStatRecord[];
  stats: VaultStats;
  profile: ProfileRecord;
  topicMap: Map<number, TopicRecord>;
  topicNameById: Map<number, string>;
  reviewNow: number;
  dueWords: WordRecord[];
  dueCountByTopic: Map<number, number>;
  upsertWord: (params: UpsertWordParams) => Promise<UpsertWordResult>;
  createTopic: (rawName: string) => Promise<number>;
  deleteTopic: (topicId: number) => Promise<void>;
  deleteWord: (wordId: number) => Promise<number | null>;
  restoreFromTrash: (trashId: number) => Promise<string | null>;
  restoreTrashBatch: (trashIds: number[]) => Promise<number>;
  restoreAllTrash: () => Promise<number>;
  permanentlyDeleteTrashItem: (trashId: number) => Promise<void>;
  emptyTrash: () => Promise<void>;
  moveWordToTopic: (wordId: number, targetTopicId: number) => Promise<void>;
  updateWordNotes: (
    wordId: number,
    patch: { note: string; customExample: string }
  ) => Promise<void>;
  recordWordReview: (
    wordId: number,
    rating: ReviewRating
  ) => Promise<WordSrsState | null>;
  bulkMoveWords: (wordIds: number[], targetTopicId: number) => Promise<number>;
  bulkDeleteWords: (wordIds: number[]) => Promise<number[]>;
  updateProfile: (patch: Partial<Omit<ProfileRecord, "id">>) => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

let clockSnapshot = 0;
const clockListeners = new Set<() => void>();
let clockTimer: number | undefined;

function getClockSnapshot(): number {
  if (typeof window === "undefined") return 0;
  if (clockSnapshot === 0) {
    clockSnapshot = Date.now();
  }
  return clockSnapshot;
}

function getServerClockSnapshot(): number {
  return 0;
}

function notifyClockChange(): void {
  if (typeof window !== "undefined") {
    clockSnapshot = Date.now();
  }
  clockListeners.forEach((listener) => listener());
}

function subscribeClock(listener: () => void): () => void {
  clockListeners.add(listener);
  if (typeof window !== "undefined" && clockTimer === undefined) {
    clockTimer = window.setInterval(() => {
      notifyClockChange();
    }, 60_000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer !== undefined) {
      window.clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

function useReviewNow(): number {
  return useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    getServerClockSnapshot
  );
}

async function resolveRestoreTopicId(
  originalTopicId: number,
  originalTopicName: string
): Promise<number> {
  const byId = await db.topics.get(originalTopicId);
  if (byId && byId.id !== undefined) {
    return byId.id;
  }

  const cleanName = originalTopicName.trim() || DEFAULT_TOPIC_NAME;
  const byName = await db.topics
    .filter((t) => t.name.trim().toLowerCase() === cleanName.toLowerCase())
    .first();

  if (byName && byName.id !== undefined) {
    return byName.id;
  }

  return db.topics.add({
    name: cleanName,
    createdAt: Date.now(),
  });
}

function buildTrashRecordFromWord(
  word: WordRecord,
  topicName: string,
  deletedAt: number
): Omit<TrashWordRecord, "id"> {
  return {
    term: word.term,
    originalTopicId: word.topicId,
    originalTopicName: topicName,
    phonetic: word.phonetic,
    audioUrl: word.audioUrl,
    rawEntry: word.rawEntry,
    savedMode: word.savedMode,
    savedWithExamples: word.savedWithExamples,
    dateKey: word.dateKey,
    createdAt: word.createdAt,
    updatedAt: word.updatedAt,
    deletedAt,
    ...(word.note !== undefined ? { note: word.note } : {}),
    ...(word.customExample !== undefined
      ? { customExample: word.customExample }
      : {}),
    ...(word.srs !== undefined ? { srs: word.srs } : {}),
    ...(word.nextReviewAt !== undefined
      ? { nextReviewAt: word.nextReviewAt }
      : {}),
  };
}

async function restoreSingleTrashRecord(
  item: TrashWordRecord,
  now: number
): Promise<string> {
  const targetTopicId = await resolveRestoreTopicId(
    item.originalTopicId,
    item.originalTopicName
  );

  const existing = await db.words
    .where("[term+topicId]")
    .equals([item.term, targetTopicId])
    .first();

  if (existing && existing.id !== undefined) {
    await db.words.update(existing.id, {
      phonetic: item.phonetic,
      audioUrl: item.audioUrl,
      rawEntry: item.rawEntry,
      savedMode: item.savedMode,
      savedWithExamples: item.savedWithExamples,
      dateKey: item.dateKey,
      updatedAt: now,
      ...(existing.note === undefined && item.note !== undefined
        ? { note: item.note }
        : {}),
      ...(existing.customExample === undefined &&
      item.customExample !== undefined
        ? { customExample: item.customExample }
        : {}),
      ...(existing.srs === undefined && item.srs !== undefined
        ? { srs: item.srs }
        : {}),
      ...(existing.nextReviewAt === undefined && item.nextReviewAt !== undefined
        ? { nextReviewAt: item.nextReviewAt }
        : {}),
    });
  } else {
    await db.words.add({
      term: item.term,
      topicId: targetTopicId,
      phonetic: item.phonetic,
      audioUrl: item.audioUrl,
      rawEntry: item.rawEntry,
      savedMode: item.savedMode,
      savedWithExamples: item.savedWithExamples,
      dateKey: item.dateKey,
      createdAt: item.createdAt,
      updatedAt: now,
      ...(item.note !== undefined ? { note: item.note } : {}),
      ...(item.customExample !== undefined
        ? { customExample: item.customExample }
        : {}),
      ...(item.srs !== undefined ? { srs: item.srs } : {}),
      nextReviewAt: item.nextReviewAt ?? item.srs?.nextReviewAt ?? item.createdAt,
    });
  }

  if (item.id !== undefined) {
    await db.trash.delete(item.id);
  }
  return item.term;
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void ensureInitialSeed();
  }, []);

  const rawTopics = useLiveQuery(
    () => db.topics.orderBy("createdAt").toArray(),
    []
  );

  const rawWords = useLiveQuery(
    () => db.words.orderBy("updatedAt").reverse().toArray(),
    []
  );

  const rawTrash = useLiveQuery(
    () => db.trash.orderBy("deletedAt").reverse().toArray(),
    []
  );

  const rawProfile = useLiveQuery(() => db.profile.get("me"), []);
  const rawDailyStats = useLiveQuery(() => db.dailyStats.toArray(), []);
  const reviewNow = useReviewNow();

  const topics = useMemo(() => rawTopics ?? [], [rawTopics]);
  const words = useMemo(() => rawWords ?? [], [rawWords]);
  const trashWords = useMemo(() => rawTrash ?? [], [rawTrash]);
  const dailyStats = useMemo(() => rawDailyStats ?? [], [rawDailyStats]);
  const profile = useMemo<ProfileRecord>(
    () => ({
      ...DEFAULT_PROFILE,
      ...(rawProfile ?? {}),
      id: "me",
    }),
    [rawProfile]
  );

  const stats = useMemo(
    () => computeVaultStats(words, dailyStats, reviewNow),
    [words, dailyStats, reviewNow]
  );

  const topicMap = useMemo(() => {
    const map = new Map<number, TopicRecord>();
    for (const topic of topics) {
      if (topic.id !== undefined) {
        map.set(topic.id, topic);
      }
    }
    return map;
  }, [topics]);

  const topicNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const topic of topics) {
      if (topic.id !== undefined) {
        map.set(topic.id, topic.name);
      }
    }
    return map;
  }, [topics]);

  const dueWords = useMemo(() => {
    if (words.length === 0 || reviewNow === 0) return [];
    const due = words.filter((word) => isWordDue(word, reviewNow));
    return sortReviewQueue(due, reviewNow);
  }, [words, reviewNow]);

  const dueCountByTopic = useMemo(() => {
    const map = new Map<number, number>();
    for (const word of dueWords) {
      map.set(word.topicId, (map.get(word.topicId) ?? 0) + 1);
    }
    return map;
  }, [dueWords]);

  const upsertWord = useCallback(
    async ({
      entry,
      topicId,
      savedMode,
      savedWithExamples,
    }: UpsertWordParams): Promise<UpsertWordResult> => {
      await ensureInitialSeed();
      const term =
        normalizeTerm(entry.word) || entry.word.trim().toLowerCase();
      const now = Date.now();
      const todayKey = getLocalDateKey(new Date(now));

      const existing = await db.words
        .where("[term+topicId]")
        .equals([term, topicId])
        .first();

      if (existing && existing.id !== undefined) {
        const previousDateKey = existing.dateKey;
        const previousUpdatedAt = existing.updatedAt;
        await db.words.update(existing.id, {
          phonetic: entry.phonetic,
          audioUrl: entry.audioUrl,
          rawEntry: entry,
          savedMode,
          savedWithExamples,
          dateKey: todayKey,
          updatedAt: now,
        });

        notifyClockChange();
        return {
          wordId: existing.id,
          wasExisting: true,
          previousDateKey,
          previousUpdatedAt,
        };
      }

      const wordId = await db.words.add({
        term,
        topicId,
        phonetic: entry.phonetic,
        audioUrl: entry.audioUrl,
        rawEntry: entry,
        savedMode,
        savedWithExamples,
        dateKey: todayKey,
        createdAt: now,
        updatedAt: now,
        nextReviewAt: now,
      });

      await db.transaction("rw", db.dailyStats, async () => {
        const existingStat = await db.dailyStats.get(todayKey);
        await db.dailyStats.put({
          dateKey: todayKey,
          wordsAdded: (existingStat?.wordsAdded ?? 0) + 1,
          wordsReviewed: existingStat?.wordsReviewed ?? 0,
        });
      });

      notifyClockChange();
      return {
        wordId,
        wasExisting: false,
        previousDateKey: null,
        previousUpdatedAt: null,
      };
    },
    []
  );

  const createTopic = useCallback(async (rawName: string): Promise<number> => {
    await ensureInitialSeed();
    const cleanName = rawName.trim();
    if (!cleanName) {
      throw new Error("Topic name cannot be empty.");
    }

    const existing = await db.topics
      .filter((t) => t.name.trim().toLowerCase() === cleanName.toLowerCase())
      .first();

    if (existing && existing.id !== undefined) {
      return existing.id;
    }

    return db.topics.add({
      name: cleanName,
      createdAt: Date.now(),
    });
  }, []);

  const deleteTopic = useCallback(async (topicId: number): Promise<void> => {
    await db.transaction("rw", db.topics, db.words, async () => {
      const target = await db.topics.get(topicId);
      if (!target || target.name === DEFAULT_TOPIC_NAME) {
        return;
      }

      let general = await db.topics
        .filter((t) => t.name === DEFAULT_TOPIC_NAME)
        .first();

      if (!general || general.id === undefined) {
        const generalId = await db.topics.add({
          name: DEFAULT_TOPIC_NAME,
          createdAt: Date.now(),
        });
        general = {
          id: generalId,
          name: DEFAULT_TOPIC_NAME,
          createdAt: Date.now(),
        };
      }

      const wordsInTopic = await db.words
        .where("topicId")
        .equals(topicId)
        .toArray();

      for (const word of wordsInTopic) {
        if (word.id === undefined) continue;
        const duplicateInGeneral = await db.words
          .where("[term+topicId]")
          .equals([word.term, general.id!])
          .first();

        if (duplicateInGeneral) {
          await db.words.delete(word.id);
        } else {
          await db.words.update(word.id, { topicId: general.id! });
        }
      }

      await db.topics.delete(topicId);
    });
    notifyClockChange();
  }, []);

  const deleteWord = useCallback(
    async (wordId: number): Promise<number | null> => {
      const result = await db.transaction(
        "rw",
        [db.words, db.topics, db.trash],
        async () => {
          const word = await db.words.get(wordId);
          if (!word) return null;

          const topic = await db.topics.get(word.topicId);
          const trashId = await db.trash.add(
            buildTrashRecordFromWord(
              word,
              topic?.name ?? DEFAULT_TOPIC_NAME,
              Date.now()
            )
          );

          await db.words.delete(wordId);
          return trashId;
        }
      );
      notifyClockChange();
      return result;
    },
    []
  );

  const restoreFromTrash = useCallback(
    async (trashId: number): Promise<string | null> => {
      const term = await db.transaction(
        "rw",
        [db.words, db.topics, db.trash],
        async () => {
          const item = await db.trash.get(trashId);
          if (!item) return null;
          return restoreSingleTrashRecord(item, Date.now());
        }
      );
      notifyClockChange();
      return term;
    },
    []
  );

  const restoreTrashBatch = useCallback(
    async (trashIds: number[]): Promise<number> => {
      if (trashIds.length === 0) return 0;
      const count = await db.transaction(
        "rw",
        [db.words, db.topics, db.trash],
        async () => {
          const now = Date.now();
          let restored = 0;
          for (const trashId of trashIds) {
            const item = await db.trash.get(trashId);
            if (!item) continue;
            await restoreSingleTrashRecord(item, now);
            restored += 1;
          }
          return restored;
        }
      );
      notifyClockChange();
      return count;
    },
    []
  );

  const restoreAllTrash = useCallback(async (): Promise<number> => {
    const count = await db.transaction(
      "rw",
      [db.words, db.topics, db.trash],
      async () => {
        const items = await db.trash.toArray();
        const now = Date.now();
        let restoredCount = 0;

        for (const item of items) {
          await restoreSingleTrashRecord(item, now);
          restoredCount += 1;
        }

        return restoredCount;
      }
    );
    notifyClockChange();
    return count;
  }, []);

  const permanentlyDeleteTrashItem = useCallback(
    async (trashId: number): Promise<void> => {
      await db.trash.delete(trashId);
    },
    []
  );

  const emptyTrash = useCallback(async (): Promise<void> => {
    await db.trash.clear();
  }, []);

  const moveWordToTopic = useCallback(
    async (wordId: number, targetTopicId: number): Promise<void> => {
      await db.transaction("rw", db.words, async () => {
        const word = await db.words.get(wordId);
        if (!word || word.topicId === targetTopicId) return;

        const conflict = await db.words
          .where("[term+topicId]")
          .equals([word.term, targetTopicId])
          .first();

        if (conflict && conflict.id !== undefined) {
          await db.words.update(conflict.id, {
            updatedAt: Date.now(),
            dateKey: getLocalDateKey(),
          });
          await db.words.delete(wordId);
        } else {
          await db.words.update(wordId, {
            topicId: targetTopicId,
            updatedAt: Date.now(),
          });
        }
      });
      notifyClockChange();
    },
    []
  );

  const updateWordNotes = useCallback(
    async (
      wordId: number,
      patch: { note: string; customExample: string }
    ): Promise<void> => {
      const cleanNote = patch.note.trim();
      const cleanExample = patch.customExample.trim();
      await db.words.update(wordId, {
        note: cleanNote || undefined,
        customExample: cleanExample || undefined,
        updatedAt: Date.now(),
      });
    },
    []
  );

  const recordWordReview = useCallback(
    async (
      wordId: number,
      rating: ReviewRating
    ): Promise<WordSrsState | null> => {
      const nextState = await db.transaction(
        "rw",
        [db.words, db.dailyStats],
        async () => {
          const word = await db.words.get(wordId);
          if (!word) return null;
          const now = Date.now();
          const todayKey = getLocalDateKey(new Date(now));
          const srs = computeNextSrsState(word.srs, rating, now);
          await db.words.update(wordId, {
            srs,
            nextReviewAt: srs.nextReviewAt,
          });
          const existingStat = await db.dailyStats.get(todayKey);
          await db.dailyStats.put({
            dateKey: todayKey,
            wordsAdded: existingStat?.wordsAdded ?? 0,
            wordsReviewed: (existingStat?.wordsReviewed ?? 0) + 1,
          });
          return srs;
        }
      );
      notifyClockChange();
      return nextState;
    },
    []
  );

  const bulkMoveWords = useCallback(
    async (wordIds: number[], targetTopicId: number): Promise<number> => {
      if (wordIds.length === 0) return 0;
      const movedCount = await db.transaction("rw", db.words, async () => {
        const now = Date.now();
        const todayKey = getLocalDateKey(new Date(now));
        let moved = 0;

        for (const wordId of wordIds) {
          const word = await db.words.get(wordId);
          if (!word || word.topicId === targetTopicId) continue;

          const conflict = await db.words
            .where("[term+topicId]")
            .equals([word.term, targetTopicId])
            .first();

          if (conflict && conflict.id !== undefined) {
            await db.words.update(conflict.id, {
              updatedAt: now,
              dateKey: todayKey,
            });
            await db.words.delete(wordId);
          } else {
            await db.words.update(wordId, {
              topicId: targetTopicId,
              updatedAt: now,
            });
          }
          moved += 1;
        }
        return moved;
      });
      notifyClockChange();
      return movedCount;
    },
    []
  );

  const bulkDeleteWords = useCallback(
    async (wordIds: number[]): Promise<number[]> => {
      if (wordIds.length === 0) return [];
      const trashIds = await db.transaction(
        "rw",
        [db.words, db.topics, db.trash],
        async () => {
          const now = Date.now();
          const createdTrashIds: number[] = [];
          const topicsList = await db.topics.toArray();
          const topicMapLocal = new Map<number, string>();
          for (const t of topicsList) {
            if (t.id !== undefined) topicMapLocal.set(t.id, t.name);
          }

          for (const wordId of wordIds) {
            const word = await db.words.get(wordId);
            if (!word) continue;
            const topicName = topicMapLocal.get(word.topicId) ?? DEFAULT_TOPIC_NAME;
            const trashId = await db.trash.add(
              buildTrashRecordFromWord(word, topicName, now)
            );
            createdTrashIds.push(trashId);
            await db.words.delete(wordId);
          }

          return createdTrashIds;
        }
      );
      notifyClockChange();
      return trashIds;
    },
    []
  );

  const updateProfile = useCallback(
    async (patch: Partial<Omit<ProfileRecord, "id">>): Promise<void> => {
      await db.transaction("rw", db.profile, async () => {
        const current = (await db.profile.get("me")) ?? { ...DEFAULT_PROFILE };
        await db.profile.put({
          ...current,
          ...patch,
          id: "me",
        });
      });
    },
    []
  );

  const value = useMemo<VaultContextValue>(
    () => ({
      topics,
      words,
      trashWords,
      dailyStats,
      stats,
      profile,
      topicMap,
      topicNameById,
      reviewNow,
      dueWords,
      dueCountByTopic,
      upsertWord,
      createTopic,
      deleteTopic,
      deleteWord,
      restoreFromTrash,
      restoreTrashBatch,
      restoreAllTrash,
      permanentlyDeleteTrashItem,
      emptyTrash,
      moveWordToTopic,
      updateWordNotes,
      recordWordReview,
      bulkMoveWords,
      bulkDeleteWords,
      updateProfile,
    }),
    [
      topics,
      words,
      trashWords,
      dailyStats,
      stats,
      profile,
      topicMap,
      topicNameById,
      reviewNow,
      dueWords,
      dueCountByTopic,
      upsertWord,
      createTopic,
      deleteTopic,
      deleteWord,
      restoreFromTrash,
      restoreTrashBatch,
      restoreAllTrash,
      permanentlyDeleteTrashItem,
      emptyTrash,
      moveWordToTopic,
      updateWordNotes,
      recordWordReview,
      bulkMoveWords,
      bulkDeleteWords,
      updateProfile,
    ]
  );

  return React.createElement(VaultContext.Provider, { value }, children);
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error("useVault must be used within VaultProvider.");
  }
  return ctx;
}
