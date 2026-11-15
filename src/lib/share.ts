import LZString from "lz-string";
import { z } from "zod";
import { getLocalDateKey, type WordRecord } from "@/lib/db";
import { extractConciseSummary } from "@/lib/dictionary";

export const URL_SAFE_LIMIT = 6000;

export const ShareItemSchema = z.object({
  term: z.string().min(1),
  topic: z.string().min(1),
  dateKey: z.string().min(1),
  conciseMeaning: z.string().min(1),
  example: z.string().optional(),
});

export const SharePayloadSchema = z.object({
  v: z.literal(1),
  sharedBy: z.string().min(1),
  exportedAt: z.string().min(1),
  items: z.array(ShareItemSchema).min(1),
});

export type ShareItem = z.infer<typeof ShareItemSchema>;
export type SharePayload = z.infer<typeof SharePayloadSchema>;

export interface EncodedShareResult {
  url: string;
  compressed: string;
  charCount: number;
  limit: number;
  percent: number;
  exceedsLimit: boolean;
}

export function buildSharePayload(
  words: WordRecord[],
  topicNameById: Map<number, string>,
  sharedBy: string
): SharePayload {
  const items: ShareItem[] = words.map((word) => {
    const { conciseMeaning, example } = extractConciseSummary(word.rawEntry);
    return {
      term: word.term,
      topic: topicNameById.get(word.topicId) ?? "General",
      dateKey: word.dateKey,
      conciseMeaning:
        conciseMeaning || `Saved vocabulary term "${word.term}".`,
      ...(example ? { example } : {}),
    };
  });

  return {
    v: 1,
    sharedBy: sharedBy.trim() || "Reader",
    exportedAt: new Date().toISOString(),
    items,
  };
}

export function encodeShareUrl(
  payload: SharePayload,
  origin: string
): EncodedShareResult {
  const json = JSON.stringify(payload);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const cleanOrigin = origin.replace(/\/+$/, "");
  const url = `${cleanOrigin}/share#v1=${compressed}`;
  const charCount = url.length;
  const percent = Math.min(100, Math.round((charCount / URL_SAFE_LIMIT) * 100));

  return {
    url,
    compressed,
    charCount,
    limit: URL_SAFE_LIMIT,
    percent,
    exceedsLimit: charCount > URL_SAFE_LIMIT,
  };
}

export function decodeShareHash(hash: string): SharePayload {
  const trimmed = hash.trim();
  const match = trimmed.match(/#?v1=([A-Za-z0-9+$_-]+)/);
  if (!match || !match[1]) {
    throw new Error("No shared VerbaShelf payload found in URL hash.");
  }

  const decompressed = LZString.decompressFromEncodedURIComponent(match[1]);
  if (!decompressed) {
    throw new Error("Could not decompress shared vocabulary link.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(decompressed);
  } catch {
    throw new Error("Shared link contains malformed JSON data.");
  }

  const parsed = SharePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Shared link payload does not match VerbaShelf v1 format.");
  }

  return parsed.data;
}

export function parseShareJsonFile(jsonText: string): SharePayload {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error("Could not parse JSON share file.");
  }

  const parsed = SharePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "File does not match the VerbaShelf shareable JSON schema."
    );
  }

  return parsed.data;
}

export function downloadShareableJson(payload: SharePayload): string {
  const filename = `verbashelf-share-${getLocalDateKey()}.json`;
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
