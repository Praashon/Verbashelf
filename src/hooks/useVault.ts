"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  DEFAULT_PROFILE,
  DEFAULT_TOPIC_NAME,
  ensureInitialSeed,
  getLocalDateKey,
  type ProfileRecord,
  type TopicRecord,
  type TrashWordRecord,
  type WordRecord,
} from "@/lib/db";
import {
  normalizeTerm,
  type DisplayMode,
  type NormalizedDictionaryEntry,
} from "@/lib/dictionary";

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
  profile: ProfileRecord;
  topicMap: Map<number, TopicRecord>;
  topicNameById: Map<number, string>;
  upsertWord: (params: UpsertWordParams) => Promise<UpsertWordResult>;
  createTopic: (rawName: string) => Promise<number>;
  deleteTopic: (topicId: number) => Promise<void>;
  deleteWord: (wordId: number) => Promise<number | null>;
  restoreFromTrash: (trashId: number) => Promise<string | null>;
  restoreAllTrash: () => Promise<number>;
  permanentlyDeleteTrashItem: (trashId: number) => Promise<void>;
  emptyTrash: () => Promise<void>;
  moveWordToTopic: (wordId: number, targetTopicId: number) => Promise<void>;
  updateProfile: (patch: Partial<Omit<ProfileRecord, "id">>) => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

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

  const topics = useMemo(() => rawTopics ?? [], [rawTopics]);
  const words = useMemo(() => rawWords ?? [], [rawWords]);
  const trashWords = useMemo(() => rawTrash ?? [], [rawTrash]);
  const profile = useMemo<ProfileRecord>(
    () => ({
      ...DEFAULT_PROFILE,
      ...(rawProfile ?? {}),
      id: "me",
    }),
    [rawProfile]
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
      });

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
  }, []);

  const deleteWord = useCallback(
    async (wordId: number): Promise<number | null> => {
      return db.transaction(
        "rw",
        [db.words, db.topics, db.trash],
        async () => {
          const word = await db.words.get(wordId);
          if (!word) return null;

          const topic = await db.topics.get(word.topicId);
          const trashId = await db.trash.add({
            term: word.term,
            originalTopicId: word.topicId,
            originalTopicName: topic?.name ?? DEFAULT_TOPIC_NAME,
            phonetic: word.phonetic,
            audioUrl: word.audioUrl,
            rawEntry: word.rawEntry,
            savedMode: word.savedMode,
            savedWithExamples: word.savedWithExamples,
            dateKey: word.dateKey,
            createdAt: word.createdAt,
            updatedAt: word.updatedAt,
            deletedAt: Date.now(),
          });

          await db.words.delete(wordId);
          return trashId;
        }
      );
    },
    []
  );

  const restoreFromTrash = useCallback(
    async (trashId: number): Promise<string | null> => {
      return db.transaction(
        "rw",
        [db.words, db.topics, db.trash],
        async () => {
          const item = await db.trash.get(trashId);
          if (!item) return null;

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
              updatedAt: Date.now(),
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
              updatedAt: Date.now(),
            });
          }

          await db.trash.delete(trashId);
          return item.term;
        }
      );
    },
    []
  );

  const restoreAllTrash = useCallback(async (): Promise<number> => {
    return db.transaction(
      "rw",
      [db.words, db.topics, db.trash],
      async () => {
        const items = await db.trash.toArray();
        let restoredCount = 0;

        for (const item of items) {
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
              updatedAt: Date.now(),
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
              updatedAt: Date.now(),
            });
          }

          if (item.id !== undefined) {
            await db.trash.delete(item.id);
          }
          restoredCount += 1;
        }

        return restoredCount;
      }
    );
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
      profile,
      topicMap,
      topicNameById,
      upsertWord,
      createTopic,
      deleteTopic,
      deleteWord,
      restoreFromTrash,
      restoreAllTrash,
      permanentlyDeleteTrashItem,
      emptyTrash,
      moveWordToTopic,
      updateProfile,
    }),
    [
      topics,
      words,
      trashWords,
      profile,
      topicMap,
      topicNameById,
      upsertWord,
      createTopic,
      deleteTopic,
      deleteWord,
      restoreFromTrash,
      restoreAllTrash,
      permanentlyDeleteTrashItem,
      emptyTrash,
      moveWordToTopic,
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
