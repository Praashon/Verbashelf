import { z } from "zod";
import {
  db,
  DEFAULT_PROFILE,
  DEFAULT_TOPIC_NAME,
  ensureInitialSeed,
  getLocalDateKey,
  type ProfileRecord,
  type TopicRecord,
  type WordRecord,
} from "@/lib/db";
import type { NormalizedDictionaryEntry } from "@/lib/dictionary";

const NormalizedDefinitionSchema = z.object({
  definition: z.string(),
  example: z.string().optional(),
  synonyms: z.array(z.string()),
  antonyms: z.array(z.string()),
});

const NormalizedMeaningSchema = z.object({
  partOfSpeech: z.string(),
  definitions: z.array(NormalizedDefinitionSchema),
  synonyms: z.array(z.string()),
  antonyms: z.array(z.string()),
});

const NormalizedDictionaryEntrySchema = z.object({
  word: z.string(),
  phonetic: z.string().nullable(),
  audioUrl: z.string().nullable(),
  source: z.enum(["dictionaryapi", "freedictionaryapi", "wikipedia", "datamuse"]),
  sourceUrl: z.string().optional(),
  simpleDefinition: z.string().optional(),
  enrichedSources: z.array(z.string()).optional(),
  relatedWords: z.array(z.string()).optional(),
  meanings: z.array(NormalizedMeaningSchema),
});

const BackupProfileSchema = z.object({
  id: z.literal("me"),
  displayName: z.string().min(1),
  avatarDataUrl: z.string().nullable(),
  defaultMode: z.enum(["concise", "comprehensive"]),
  defaultExamples: z.boolean(),
  autoClearSearch: z.boolean().optional().default(false),
  typingSpeed: z
    .enum(["fast", "balanced", "relaxed", "manual"])
    .optional()
    .default("balanced"),
  pushToTalkKey: z.string().optional().default("Space"),
  showStats: z.boolean().optional().default(true),
});

const BackupTopicSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1),
  createdAt: z.number(),
});

const WordSrsSchema = z.object({
  repetitions: z.number().int().nonnegative(),
  intervalDays: z.number().nonnegative(),
  easeFactor: z.number().positive(),
  nextReviewAt: z.number(),
  lastReviewedAt: z.number().nullable(),
  lapses: z.number().int().nonnegative(),
});

const BackupWordSchema = z.object({
  id: z.number().int().positive().optional(),
  term: z.string().min(1),
  topicId: z.number().int().positive(),
  phonetic: z.string().nullable(),
  audioUrl: z.string().nullable(),
  rawEntry: NormalizedDictionaryEntrySchema,
  savedMode: z.enum(["concise", "comprehensive"]),
  savedWithExamples: z.boolean(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.number(),
  updatedAt: z.number(),
  note: z.string().optional(),
  customExample: z.string().optional(),
  srs: WordSrsSchema.optional(),
  nextReviewAt: z.number().optional(),
});

const BackupDailyStatSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wordsAdded: z.number().int().nonnegative(),
  wordsReviewed: z.number().int().nonnegative(),
});

export const BackupPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  profile: BackupProfileSchema.nullable().optional(),
  topics: z.array(BackupTopicSchema),
  words: z.array(BackupWordSchema),
  dailyStats: z.array(BackupDailyStatSchema).optional(),
});

export type BackupPayload = z.infer<typeof BackupPayloadSchema>;

export interface ImportBackupResult {
  topicsAdded: number;
  wordsAdded: number;
  wordsSkipped: number;
}

export async function buildBackupPayload(): Promise<BackupPayload> {
  await ensureInitialSeed();
  const [profile, topics, words, dailyStats] = await Promise.all([
    db.profile.get("me"),
    db.topics.orderBy("createdAt").toArray(),
    db.words.orderBy("updatedAt").toArray(),
    db.dailyStats.toArray(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile ?? { ...DEFAULT_PROFILE },
    topics,
    words,
    dailyStats,
  };
}

export function exportSelectedWordsBackup(
  selectedWords: WordRecord[],
  topics: TopicRecord[],
  profile: ProfileRecord | null
): string {
  const referencedTopicIds = new Set(selectedWords.map((w) => w.topicId));
  const filteredTopics = topics.filter(
    (t) => t.id !== undefined && referencedTopicIds.has(t.id)
  );

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile ?? { ...DEFAULT_PROFILE },
    topics: filteredTopics,
    words: selectedWords,
  };

  const filename = `verbashelf-selected-${getLocalDateKey()}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export async function exportVaultBackup(): Promise<string> {
  const payload = await buildBackupPayload();
  const filename = `verbashelf-backup-${getLocalDateKey()}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export async function importVaultBackup(
  jsonText: string,
  mode: "merge" | "replace"
): Promise<ImportBackupResult> {
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid JSON file. Could not parse backup contents.");
  }

  const parsed = BackupPayloadSchema.safeParse(rawJson);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const path = firstIssue?.path.join(".") || "root";
    throw new Error(
      `Invalid VerbaShelf backup schema at "${path}": ${
        firstIssue?.message ?? "Malformed backup format."
      }`
    );
  }

  const data = parsed.data;
  let topicsAdded = 0;
  let wordsAdded = 0;
  let wordsSkipped = 0;

  await db.transaction(
    "rw",
    [db.topics, db.words, db.profile, db.dailyStats],
    async () => {
      const topicIdMap = new Map<number, number>();

      if (mode === "replace") {
        await db.words.clear();
        await db.topics.clear();
        await db.profile.clear();
        await db.dailyStats.clear();

        const nextProfile: ProfileRecord = data.profile
          ? {
              id: "me",
              displayName: data.profile.displayName,
              avatarDataUrl: data.profile.avatarDataUrl,
              defaultMode: data.profile.defaultMode,
              defaultExamples: data.profile.defaultExamples,
              autoClearSearch: data.profile.autoClearSearch ?? false,
              typingSpeed: data.profile.typingSpeed ?? "balanced",
              pushToTalkKey: data.profile.pushToTalkKey ?? "Space",
              showStats: data.profile.showStats ?? true,
            }
          : { ...DEFAULT_PROFILE };
        await db.profile.put(nextProfile);

        if (Array.isArray(data.dailyStats) && data.dailyStats.length > 0) {
          await db.dailyStats.bulkPut(data.dailyStats);
        }

      for (const topic of data.topics) {
        const newId = await db.topics.add({
          name: topic.name.trim(),
          createdAt: topic.createdAt,
        });
        topicsAdded += 1;
        if (topic.id !== undefined) {
          topicIdMap.set(topic.id, newId);
        }
      }

      let fallbackTopicId: number;
      if (topicsAdded === 0) {
        fallbackTopicId = await db.topics.add({
          name: DEFAULT_TOPIC_NAME,
          createdAt: Date.now(),
        });
        topicsAdded += 1;
      } else {
        const firstTopic = await db.topics.orderBy("createdAt").first();
        fallbackTopicId = firstTopic?.id ?? 1;
      }

      const seenPairs = new Set<string>();
      for (const word of data.words) {
        const resolvedTopicId =
          topicIdMap.get(word.topicId) ?? fallbackTopicId;
        const normalizedTerm = word.term.trim().toLowerCase();
        const key = `${normalizedTerm}::${resolvedTopicId}`;
        if (seenPairs.has(key)) {
          wordsSkipped += 1;
          continue;
        }
        seenPairs.add(key);

        const entry: NormalizedDictionaryEntry = word.rawEntry;
        await db.words.add({
          term: normalizedTerm,
          topicId: resolvedTopicId,
          phonetic: word.phonetic,
          audioUrl: word.audioUrl,
          rawEntry: entry,
          savedMode: word.savedMode,
          savedWithExamples: word.savedWithExamples,
          dateKey: word.dateKey,
          createdAt: word.createdAt,
          updatedAt: word.updatedAt,
          ...(word.note !== undefined ? { note: word.note } : {}),
          ...(word.customExample !== undefined
            ? { customExample: word.customExample }
            : {}),
          ...(word.srs !== undefined ? { srs: word.srs } : {}),
          nextReviewAt:
            word.nextReviewAt ?? word.srs?.nextReviewAt ?? word.createdAt,
        });
        wordsAdded += 1;
      }
      return;
    }

    const existingTopics: TopicRecord[] = await db.topics.toArray();
    const byLowerName = new Map<string, number>();
    for (const topic of existingTopics) {
      if (topic.id !== undefined) {
        byLowerName.set(topic.name.trim().toLowerCase(), topic.id);
      }
    }

    for (const topic of data.topics) {
      const cleanName = topic.name.trim();
      const lower = cleanName.toLowerCase();
      const existingId = byLowerName.get(lower);
      if (existingId !== undefined) {
        if (topic.id !== undefined) {
          topicIdMap.set(topic.id, existingId);
        }
      } else {
        const createdId = await db.topics.add({
          name: cleanName,
          createdAt: topic.createdAt,
        });
        topicsAdded += 1;
        byLowerName.set(lower, createdId);
        if (topic.id !== undefined) {
          topicIdMap.set(topic.id, createdId);
        }
      }
    }

    let fallbackTopicId = byLowerName.get(DEFAULT_TOPIC_NAME.toLowerCase());
    if (fallbackTopicId === undefined) {
      fallbackTopicId = await db.topics.add({
        name: DEFAULT_TOPIC_NAME,
        createdAt: Date.now(),
      });
      topicsAdded += 1;
      byLowerName.set(DEFAULT_TOPIC_NAME.toLowerCase(), fallbackTopicId);
    }

    const existingWords: WordRecord[] = await db.words.toArray();
    const existingPairKeys = new Set(
      existingWords.map((w) => `${w.term.toLowerCase()}::${w.topicId}`)
    );

    for (const word of data.words) {
      const resolvedTopicId =
        topicIdMap.get(word.topicId) ?? fallbackTopicId;
      const normalizedTerm = word.term.trim().toLowerCase();
      const pairKey = `${normalizedTerm}::${resolvedTopicId}`;
      if (existingPairKeys.has(pairKey)) {
        wordsSkipped += 1;
        continue;
      }
      existingPairKeys.add(pairKey);

      await db.words.add({
        term: normalizedTerm,
        topicId: resolvedTopicId,
        phonetic: word.phonetic,
        audioUrl: word.audioUrl,
        rawEntry: word.rawEntry,
        savedMode: word.savedMode,
        savedWithExamples: word.savedWithExamples,
        dateKey: word.dateKey,
        createdAt: word.createdAt,
        updatedAt: word.updatedAt,
        ...(word.note !== undefined ? { note: word.note } : {}),
        ...(word.customExample !== undefined
          ? { customExample: word.customExample }
          : {}),
        ...(word.srs !== undefined ? { srs: word.srs } : {}),
        nextReviewAt:
          word.nextReviewAt ?? word.srs?.nextReviewAt ?? word.createdAt,
      });
      wordsAdded += 1;
    }

    const existingProfile = await db.profile.get("me");
    if (!existingProfile && data.profile) {
      await db.profile.put({
        id: "me",
        displayName: data.profile.displayName,
        avatarDataUrl: data.profile.avatarDataUrl,
        defaultMode: data.profile.defaultMode,
        defaultExamples: data.profile.defaultExamples,
        autoClearSearch: data.profile.autoClearSearch ?? false,
        typingSpeed: data.profile.typingSpeed ?? "balanced",
        pushToTalkKey: data.profile.pushToTalkKey ?? "Space",
        showStats: data.profile.showStats ?? true,
      });
    }

    if (Array.isArray(data.dailyStats)) {
      for (const stat of data.dailyStats) {
        const existing = await db.dailyStats.get(stat.dateKey);
        if (!existing) {
          await db.dailyStats.put(stat);
        } else {
          await db.dailyStats.put({
            dateKey: stat.dateKey,
            wordsAdded: Math.max(existing.wordsAdded, stat.wordsAdded),
            wordsReviewed: Math.max(existing.wordsReviewed, stat.wordsReviewed),
          });
        }
      }
    }
  });

  return { topicsAdded, wordsAdded, wordsSkipped };
}

export async function wipeVaultData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.words, db.topics, db.profile, db.trash, db.dailyStats],
    async () => {
      await db.words.clear();
      await db.topics.clear();
      await db.profile.clear();
      await db.trash.clear();
      await db.dailyStats.clear();
    }
  );
  await ensureInitialSeed(true);
}
