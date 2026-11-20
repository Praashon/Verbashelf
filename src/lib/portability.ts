import {
  db,
  DEFAULT_TOPIC_NAME,
  ensureInitialSeed,
  getLocalDateKey,
  type WordRecord,
} from "@/lib/db";
import {
  createMinimalEntryFromShare,
  extractConciseSummary,
  fetchWordDefinition,
  normalizeTerm,
  type NormalizedDictionaryEntry,
} from "@/lib/dictionary";

export interface ParsedImportRow {
  term: string;
  topic?: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  example?: string;
  note?: string;
  customExample?: string;
}

export interface WordListImportResult {
  added: number;
  skipped: number;
  enriched: number;
  topicsCreated: number;
}

function sanitizeAnkiText(raw: string): string {
  return raw.replace(/\t+/g, " ").replace(/\r?\n+/g, " ; ").trim();
}

function sanitizeSlug(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function triggerFileDownload(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportWordsAsAnkiTxt(
  words: ReadonlyArray<WordRecord>,
  topicNameById: Map<number, string>,
  filenameSlug?: string
): string {
  const headerLines = [
    "#separator:tab",
    "#html:false",
    "#columns:Front\tBack\tPronunciation\tTags",
    "#tags column:4",
  ];

  const rows = words.map((word) => {
    const topicName = topicNameById.get(word.topicId) ?? DEFAULT_TOPIC_NAME;
    const summary = extractConciseSummary(word.rawEntry);
    const pos = word.rawEntry.meanings[0]?.partOfSpeech ?? "";
    const backParts: string[] = [];

    if (summary.conciseMeaning) {
      backParts.push(
        pos ? `[${pos}] ${summary.conciseMeaning}` : summary.conciseMeaning
      );
    }
    if (summary.example) {
      backParts.push(`Example: "${summary.example}"`);
    }
    if (word.note?.trim()) {
      backParts.push(`Note: ${word.note.trim()}`);
    }
    if (word.customExample?.trim()) {
      backParts.push(`My example: "${word.customExample.trim()}"`);
    }

    const front = sanitizeAnkiText(word.term);
    const back = sanitizeAnkiText(
      backParts.join(" | ") || `Saved word "${word.term}"`
    );
    const pronunciation = sanitizeAnkiText(word.phonetic ?? "");
    const topicTag = topicName.trim().replace(/\s+/g, "_") || DEFAULT_TOPIC_NAME;
    const tags = sanitizeAnkiText(`VerbaShelf ${topicTag}`);

    return `${front}\t${back}\t${pronunciation}\t${tags}`;
  });

  const slug = sanitizeSlug(filenameSlug);
  const filename = slug
    ? `verbashelf-anki-${slug}-${getLocalDateKey()}.txt`
    : `verbashelf-anki-${getLocalDateKey()}.txt`;

  triggerFileDownload(
    [...headerLines, ...rows].join("\n"),
    filename,
    "text/plain;charset=utf-8"
  );
  return filename;
}

function escapeCsvCell(raw: string): string {
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function exportWordsAsCsv(
  words: ReadonlyArray<WordRecord>,
  topicNameById: Map<number, string>,
  filenameSlug?: string
): string {
  const header = [
    "word",
    "topic",
    "phonetic",
    "part_of_speech",
    "definition",
    "example",
    "note",
    "my_example",
    "synonyms",
    "antonyms",
    "date_saved",
  ].join(",");

  const rows = words.map((word) => {
    const topicName = topicNameById.get(word.topicId) ?? DEFAULT_TOPIC_NAME;
    const summary = extractConciseSummary(word.rawEntry);
    const firstMeaning = word.rawEntry.meanings[0];
    const synonyms = Array.from(
      new Set(word.rawEntry.meanings.flatMap((m) => m.synonyms))
    )
      .slice(0, 8)
      .join("; ");
    const antonyms = Array.from(
      new Set(word.rawEntry.meanings.flatMap((m) => m.antonyms))
    )
      .slice(0, 8)
      .join("; ");

    return [
      word.term,
      topicName,
      word.phonetic ?? "",
      firstMeaning?.partOfSpeech ?? "",
      summary.conciseMeaning,
      summary.example ?? "",
      word.note ?? "",
      word.customExample ?? "",
      synonyms,
      antonyms,
      word.dateKey,
    ]
      .map((cell) => escapeCsvCell(cell))
      .join(",");
  });

  const slug = sanitizeSlug(filenameSlug);
  const filename = slug
    ? `verbashelf-${slug}-${getLocalDateKey()}.csv`
    : `verbashelf-${getLocalDateKey()}.csv`;

  triggerFileDownload(
    `\uFEFF${[header, ...rows].join("\r\n")}`,
    filename,
    "text/csv;charset=utf-8"
  );
  return filename;
}

function parseDelimitedLine(line: string, delimiter: "," | "\t"): string[] {
  if (delimiter === "\t") {
    return line.split("\t").map((part) => part.trim());
  }

  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

type ImportColumnKey =
  | "term"
  | "definition"
  | "topic"
  | "phonetic"
  | "partOfSpeech"
  | "example"
  | "note"
  | "customExample";

const HEADER_ALIASES: Record<string, ImportColumnKey> = {
  word: "term",
  term: "term",
  front: "term",
  vocabulary: "term",
  definition: "definition",
  meaning: "definition",
  back: "definition",
  topic: "topic",
  folder: "topic",
  deck: "topic",
  tags: "topic",
  tag: "topic",
  phonetic: "phonetic",
  pronunciation: "phonetic",
  ipa: "phonetic",
  part_of_speech: "partOfSpeech",
  "part of speech": "partOfSpeech",
  pos: "partOfSpeech",
  example: "example",
  note: "note",
  mnemonic: "note",
  notes: "note",
  my_example: "customExample",
  "my example": "customExample",
  custom_example: "customExample",
};

export function parseWordListFile(
  rawText: string,
  filename: string
): ParsedImportRow[] {
  const cleanText = rawText.replace(/^\uFEFF/, "");
  const lines = cleanText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) {
    return [];
  }

  const lowerName = filename.toLowerCase();
  const hasTabs = lines.some((l) => l.includes("\t"));
  const delimiter: "," | "\t" | null = hasTabs
    ? "\t"
    : lowerName.endsWith(".csv")
      ? ","
      : null;

  const parsedRows: ParsedImportRow[] = [];
  const seenTerms = new Set<string>();

  const pushTermRow = (row: ParsedImportRow) => {
    const cleanTerm = normalizeTerm(row.term);
    if (cleanTerm.length < 2) return;
    const dedupeKey = `${cleanTerm}::${(row.topic ?? "").toLowerCase()}`;
    if (seenTerms.has(dedupeKey)) return;
    seenTerms.add(dedupeKey);
    parsedRows.push({
      ...row,
      term: cleanTerm,
    });
  };

  if (delimiter !== null) {
    const firstCells = parseDelimitedLine(lines[0], delimiter);
    const mappedHeaders = firstCells.map(
      (cell) => HEADER_ALIASES[cell.trim().toLowerCase()] ?? null
    );
    const hasKnownHeader = mappedHeaders.some((h) => h === "term");
    const startIndex = hasKnownHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i += 1) {
      const cells = parseDelimitedLine(lines[i], delimiter);
      if (hasKnownHeader) {
        const record: Partial<ParsedImportRow> = {};
        mappedHeaders.forEach((colKey, idx) => {
          if (!colKey) return;
          const val = cells[idx]?.trim();
          if (val) {
            record[colKey] = val;
          }
        });
        if (record.term) {
          pushTermRow(record as ParsedImportRow);
        }
      } else if (delimiter === "\t") {
        const [term, definition, phonetic, tags] = cells;
        if (term) {
          const cleanTopic = tags
            ?.split(/\s+/)
            .find((t) => t && t.toLowerCase() !== "verbashelf")
            ?.replace(/_/g, " ");
          pushTermRow({
            term,
            ...(definition ? { definition } : {}),
            ...(phonetic ? { phonetic } : {}),
            ...(cleanTopic ? { topic: cleanTopic } : {}),
          });
        }
      } else {
        for (const cell of cells) {
          if (cell) {
            pushTermRow({ term: cell });
          }
        }
      }
    }
    return parsedRows;
  }

  const firstCsvCells = parseDelimitedLine(lines[0], ",");
  const firstHeaderMatch = firstCsvCells.some(
    (cell) => HEADER_ALIASES[cell.trim().toLowerCase()] === "term"
  );
  if (firstHeaderMatch) {
    return parseWordListFile(rawText, "import.csv");
  }

  for (const line of lines) {
    const parts = line.includes(",")
      ? line.split(",").map((p) => p.trim())
      : [line];
    for (const part of parts) {
      if (part) {
        pushTermRow({ term: part });
      }
    }
  }

  return parsedRows;
}

function buildEntryFromImportRow(row: ParsedImportRow): NormalizedDictionaryEntry {
  if (!row.definition) {
    return createMinimalEntryFromShare({
      term: row.term,
      conciseMeaning: `Imported vocabulary term "${row.term}".`,
      example: row.example,
    });
  }

  return {
    word: row.term,
    phonetic: row.phonetic ?? null,
    audioUrl: null,
    source: "dictionaryapi",
    meanings: [
      {
        partOfSpeech: row.partOfSpeech || "imported",
        definitions: [
          {
            definition: row.definition,
            ...(row.example ? { example: row.example } : {}),
            synonyms: [],
            antonyms: [],
          },
        ],
        synonyms: [],
        antonyms: [],
      },
    ],
  };
}

export async function importWordListRows(params: {
  rows: ReadonlyArray<ParsedImportRow>;
  defaultTopicId: number;
  fetchDefinitions: boolean;
  onProgress?: (done: number, total: number, currentWord: string) => void;
}): Promise<WordListImportResult> {
  await ensureInitialSeed();
  const { rows, defaultTopicId, fetchDefinitions, onProgress } = params;

  const existingTopics = await db.topics.toArray();
  const topicIdByLowerName = new Map<string, number>();
  for (const t of existingTopics) {
    if (t.id !== undefined) {
      topicIdByLowerName.set(t.name.trim().toLowerCase(), t.id);
    }
  }

  const existingWords = await db.words.toArray();
  const existingKeys = new Set(
    existingWords.map((w) => `${w.term.toLowerCase()}::${w.topicId}`)
  );

  let added = 0;
  let skipped = 0;
  let enriched = 0;
  let topicsCreated = 0;

  const total = rows.length;
  for (let i = 0; i < total; i += 1) {
    const row = rows[i];
    onProgress?.(i + 1, total, row.term);

    let targetTopicId = defaultTopicId;
    if (row.topic?.trim()) {
      const cleanTopic = row.topic.trim();
      const lower = cleanTopic.toLowerCase();
      const matched = topicIdByLowerName.get(lower);
      if (matched !== undefined) {
        targetTopicId = matched;
      } else {
        targetTopicId = await db.topics.add({
          name: cleanTopic,
          createdAt: Date.now(),
        });
        topicIdByLowerName.set(lower, targetTopicId);
        topicsCreated += 1;
      }
    }

    const pairKey = `${row.term.toLowerCase()}::${targetTopicId}`;
    if (existingKeys.has(pairKey)) {
      skipped += 1;
      continue;
    }

    let entry: NormalizedDictionaryEntry;
    const canFetchOnline =
      fetchDefinitions &&
      !row.definition &&
      (typeof navigator === "undefined" || navigator.onLine);

    if (canFetchOnline) {
      try {
        entry = await fetchWordDefinition(row.term);
        enriched += 1;
      } catch {
        entry = buildEntryFromImportRow(row);
      }
    } else {
      entry = buildEntryFromImportRow(row);
    }

    const now = Date.now();
    const todayKey = getLocalDateKey(new Date(now));
    await db.words.add({
      term: row.term,
      topicId: targetTopicId,
      phonetic: entry.phonetic ?? row.phonetic ?? null,
      audioUrl: entry.audioUrl,
      rawEntry: entry,
      savedMode: "concise",
      savedWithExamples: true,
      dateKey: todayKey,
      createdAt: now,
      updatedAt: now,
      ...(row.note ? { note: row.note } : {}),
      ...(row.customExample ? { customExample: row.customExample } : {}),
      nextReviewAt: now,
    });

    existingKeys.add(pairKey);
    added += 1;
  }

  if (added > 0) {
    const todayKey = getLocalDateKey();
    await db.transaction("rw", db.dailyStats, async () => {
      const existingStat = await db.dailyStats.get(todayKey);
      await db.dailyStats.put({
        dateKey: todayKey,
        wordsAdded: (existingStat?.wordsAdded ?? 0) + added,
        wordsReviewed: existingStat?.wordsReviewed ?? 0,
      });
    });
  }

  return { added, skipped, enriched, topicsCreated };
}
