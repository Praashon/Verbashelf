export type DisplayMode = "concise" | "comprehensive";

export type DictionarySource =
  | "dictionaryapi"
  | "freedictionaryapi"
  | "wikipedia"
  | "datamuse";

export interface NormalizedDefinition {
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
}

export interface NormalizedMeaning {
  partOfSpeech: string;
  definitions: NormalizedDefinition[];
  synonyms: string[];
  antonyms: string[];
}

export interface NormalizedDictionaryEntry {
  word: string;
  phonetic: string | null;
  audioUrl: string | null;
  source: DictionarySource;
  sourceUrl?: string;
  simpleDefinition?: string;
  enrichedSources?: string[];
  meanings: NormalizedMeaning[];
}

export interface ReshapedWordView {
  word: string;
  phonetic: string | null;
  audioUrl: string | null;
  source: DictionarySource;
  sourceUrl?: string;
  simpleDefinition?: string;
  enrichedSources?: string[];
  meanings: NormalizedMeaning[];
  totalMeanings: number;
  totalDefinitions: number;
}

export class DictionaryNotFoundError extends Error {
  readonly term: string;
  readonly suggestions: string[];

  constructor(term: string, message?: string, suggestions: string[] = []) {
    super(message ?? `No dictionary entry found for "${term}".`);
    this.name = "DictionaryNotFoundError";
    this.term = term;
    this.suggestions = suggestions;
  }
}

export function normalizeTerm(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError")
  );
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const cleaned = item.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }
  return result;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  parentSignal?: AbortSignal,
  timeoutMs = 1800
): Promise<T> {
  if (parentSignal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const controller = new AbortController();
  const handleParentAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", handleParentAbort, { once: true });

  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error: unknown) {
    if (parentSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (isAbortError(error)) {
      throw new Error("Enrichment request timed out");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    parentSignal?.removeEventListener("abort", handleParentAbort);
  }
}

interface PrimaryPhonetic {
  text?: string;
  audio?: string;
}

interface PrimaryDefinition {
  definition?: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface PrimaryMeaning {
  partOfSpeech?: string;
  definitions?: PrimaryDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

interface PrimaryApiEntry {
  word?: string;
  phonetic?: string;
  phonetics?: PrimaryPhonetic[];
  meanings?: PrimaryMeaning[];
  sourceUrls?: string[];
}

interface FallbackPronunciation {
  type?: string;
  text?: string;
}

interface FallbackSubsense {
  definition?: string;
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
}

interface FallbackSense {
  definition?: string;
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
  subsenses?: FallbackSubsense[];
}

interface FallbackEntry {
  language?: {
    code?: string;
    name?: string;
  };
  partOfSpeech?: string;
  pronunciations?: FallbackPronunciation[];
  senses?: FallbackSense[];
  synonyms?: string[];
  antonyms?: string[];
}

interface FallbackApiResponse {
  word?: string;
  entries?: FallbackEntry[];
  source?: {
    url?: string;
  };
}

interface SimpleWikiPage {
  missing?: string;
  extract?: string;
}

interface SimpleWikiResponse {
  query?: {
    pages?: Record<string, SimpleWikiPage>;
  };
}

interface SimpleWikiResult {
  simpleDefinition?: string;
  synonyms: string[];
}

interface DatamuseWordItem {
  word?: string;
  tags?: string[];
  defs?: string[];
}

interface DatamuseResult {
  posOrder: string[];
  lexicalMeanings: NormalizedMeaning[];
  properNounMeanings: NormalizedMeaning[];
  synonyms: string[];
}

interface WikipediaSummaryResponse {
  type?: string;
  title?: string;
  description?: string;
  extract?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
}

const SIMPLE_POS_HEADINGS = new Set([
  "noun",
  "adjective",
  "verb",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "interjection",
]);

function parseInlineWordList(rawList: string): string[] {
  return uniqueStrings(
    rawList
      .replace(/\band\b/gi, ",")
      .split(",")
      .map((item) => item.replace(/[.]+$/, "").trim().toLowerCase())
      .filter((item) => item.length >= 2 && !/\s{2,}/.test(item))
  );
}

function parseSimpleWikiExtract(extract: string): SimpleWikiResult {
  const lines = extract.split(/\r?\n/);
  let inPosSection = false;
  let simpleDefinition: string | undefined;
  const synonyms: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(/^={2,4}\s*([^=]+?)\s*={2,4}$/);
    if (headingMatch) {
      const heading = headingMatch[1].trim().toLowerCase();
      if (SIMPLE_POS_HEADINGS.has(heading)) {
        inPosSection = true;
      } else if (inPosSection && simpleDefinition) {
        break;
      } else {
        inPosSection = false;
      }
      continue;
    }

    if (!inPosSection) continue;
    if (/^(?:\(UK\)|\(US\)|IPA|SAMPA|Audio)/i.test(line)) continue;

    let prose = line;
    const synMatch = prose.match(/\bSynonyms?:\s*([^.\n]+)/i);
    if (synMatch?.[1]) {
      const synPart = synMatch[1].split(/\bAntonyms?:/i)[0] ?? "";
      synonyms.push(...parseInlineWordList(synPart));
    }

    prose = prose
      .replace(/\s*\bSynonyms?:\s*.*$/i, "")
      .replace(/\s*\bAntonyms?:\s*.*$/i, "")
      .trim();

    if (!simpleDefinition && prose.length >= 16 && /[.!?]$/.test(prose)) {
      simpleDefinition = prose;
      break;
    }
  }

  return {
    simpleDefinition,
    synonyms: uniqueStrings(synonyms).slice(0, 6),
  };
}

async function fetchSimpleWiktionary(
  term: string,
  parentSignal?: AbortSignal
): Promise<SimpleWikiResult | null> {
  const url = `https://simple.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(
    term
  )}&format=json&origin=*`;

  const data = await fetchJsonWithTimeout<SimpleWikiResponse>(
    url,
    parentSignal,
    1800
  );
  const pages = data.query?.pages ? Object.values(data.query.pages) : [];
  const firstPage = pages[0];
  if (!firstPage || firstPage.missing !== undefined || !firstPage.extract) {
    return null;
  }

  const parsed = parseSimpleWikiExtract(firstPage.extract);
  if (!parsed.simpleDefinition && parsed.synonyms.length === 0) {
    return null;
  }
  return parsed;
}

const DATAMUSE_POS_MAP: Record<string, string> = {
  adj: "adjective",
  n: "noun",
  v: "verb",
  adv: "adverb",
};

async function fetchDatamuseEnrichment(
  term: string,
  parentSignal?: AbortSignal
): Promise<DatamuseResult | null> {
  const defUrl = `https://api.datamuse.com/words?sp=${encodeURIComponent(
    term
  )}&md=dp&max=1`;
  const synUrl = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(
    term
  )}&max=6`;

  const [defSettled, synSettled] = await Promise.allSettled([
    fetchJsonWithTimeout<DatamuseWordItem[]>(defUrl, parentSignal, 1800),
    fetchJsonWithTimeout<DatamuseWordItem[]>(synUrl, parentSignal, 1800),
  ]);

  if (parentSignal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const posOrder: string[] = [];
  const lexicalMap = new Map<string, NormalizedMeaning>();
  const properNounMap = new Map<string, NormalizedMeaning>();

  if (defSettled.status === "fulfilled" && Array.isArray(defSettled.value)) {
    const exactMatch = defSettled.value.find(
      (item) => item.word?.trim().toLowerCase() === term
    );

    if (exactMatch) {
      const hasPropTag =
        Array.isArray(exactMatch.tags) &&
        exactMatch.tags.some((t) => t.toLowerCase() === "prop");

      if (Array.isArray(exactMatch.tags)) {
        for (const tag of exactMatch.tags) {
          const mapped = DATAMUSE_POS_MAP[tag.toLowerCase()];
          if (mapped && !posOrder.includes(mapped)) {
            posOrder.push(mapped);
          }
        }
      }

      if (Array.isArray(exactMatch.defs)) {
        for (const rawDef of exactMatch.defs) {
          const tabIndex = rawDef.indexOf("\t");
          if (tabIndex === -1) continue;
          const rawPosRaw = rawDef.slice(0, tabIndex).trim();
          const rawPos = rawPosRaw.toLowerCase();
          const defText = rawDef.slice(tabIndex + 1).trim();
          if (!defText) continue;

          const isProperEntry = hasPropTag || rawPosRaw === "N";
          const pos = DATAMUSE_POS_MAP[rawPos] ?? (isProperEntry ? "proper noun" : rawPos);
          const targetMap = isProperEntry ? properNounMap : lexicalMap;

          const existing = targetMap.get(pos);
          const item: NormalizedDefinition = {
            definition: defText,
            synonyms: [],
            antonyms: [],
          };
          if (existing) {
            existing.definitions.push(item);
          } else {
            targetMap.set(pos, {
              partOfSpeech: pos,
              definitions: [item],
              synonyms: [],
              antonyms: [],
            });
          }
        }
      }
    }
  }

  const synonyms: string[] = [];
  if (synSettled.status === "fulfilled" && Array.isArray(synSettled.value)) {
    for (const item of synSettled.value) {
      const w = item.word?.trim().toLowerCase();
      if (w && w !== term) {
        synonyms.push(w);
      }
    }
  }

  const lexicalMeanings = Array.from(lexicalMap.values());
  const properNounMeanings = Array.from(properNounMap.values());
  if (
    posOrder.length === 0 &&
    lexicalMeanings.length === 0 &&
    properNounMeanings.length === 0 &&
    synonyms.length === 0
  ) {
    return null;
  }

  return {
    posOrder,
    lexicalMeanings,
    properNounMeanings,
    synonyms: uniqueStrings(synonyms).slice(0, 6),
  };
}

async function fetchWikipediaSummary(
  term: string,
  parentSignal?: AbortSignal
): Promise<NormalizedDictionaryEntry | null> {
  const wikiTitle = term
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("_");

  if (!wikiTitle) return null;

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    wikiTitle
  )}`;

  try {
    const data = await fetchJsonWithTimeout<WikipediaSummaryResponse>(
      url,
      parentSignal,
      2500
    );

    if (
      data.type !== "standard" ||
      !data.extract ||
      data.extract.trim().length < 20
    ) {
      return null;
    }

    const rawExtract = data.extract.trim();
    const matchedSentences = rawExtract.match(/[^.!?]+[.!?]+(?:\s|$)/g);
    const sentences = (
      matchedSentences
        ? matchedSentences.map((s) => s.trim()).filter(Boolean)
        : [rawExtract]
    ).slice(0, 4);

    if (sentences.length === 0) return null;

    const definitions: NormalizedDefinition[] = sentences.map((sentence) => ({
      definition: sentence,
      synonyms: [],
      antonyms: [],
    }));

    const resolvedWord = data.title?.trim().toLowerCase() || term;
    const shortDescription = data.description?.trim();
    const simpleDefinition =
      shortDescription && shortDescription.length >= 8
        ? shortDescription
        : sentences[0];

    return {
      word: resolvedWord,
      phonetic: null,
      audioUrl: null,
      source: "wikipedia",
      sourceUrl: data.content_urls?.desktop?.page,
      simpleDefinition,
      enrichedSources: ["Wikipedia"],
      meanings: [
        {
          partOfSpeech: "reference",
          definitions,
          synonyms: [],
          antonyms: [],
        },
      ],
    };
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw error;
    }
    return null;
  }
}

function normalizePrimaryEntries(
  entries: PrimaryApiEntry[],
  fallbackWord: string
): NormalizedDictionaryEntry {
  let phonetic: string | null = null;
  let audioUrl: string | null = null;
  let sourceUrl: string | undefined;
  let resolvedWord = fallbackWord;

  const meaningMap = new Map<string, NormalizedMeaning>();

  for (const entry of entries) {
    if (entry.word && resolvedWord === fallbackWord) {
      resolvedWord = entry.word.toLowerCase();
    }

    if (!phonetic && entry.phonetic?.trim()) {
      phonetic = entry.phonetic.trim();
    }

    if (Array.isArray(entry.phonetics)) {
      for (const p of entry.phonetics) {
        if (!phonetic && p.text?.trim()) {
          phonetic = p.text.trim();
        }
        if (!audioUrl && p.audio?.trim()) {
          audioUrl = p.audio.trim();
        }
      }
    }

    if (!sourceUrl && Array.isArray(entry.sourceUrls) && entry.sourceUrls[0]) {
      sourceUrl = entry.sourceUrls[0];
    }

    if (!Array.isArray(entry.meanings)) continue;

    for (const m of entry.meanings) {
      const pos = m.partOfSpeech?.trim() || "other";
      const definitions: NormalizedDefinition[] = [];

      if (Array.isArray(m.definitions)) {
        for (const d of m.definitions) {
          const text = d.definition?.trim();
          if (!text) continue;
          definitions.push({
            definition: text,
            example: d.example?.trim() || undefined,
            synonyms: uniqueStrings(Array.isArray(d.synonyms) ? d.synonyms : []),
            antonyms: uniqueStrings(Array.isArray(d.antonyms) ? d.antonyms : []),
          });
        }
      }

      if (definitions.length === 0) continue;

      const existing = meaningMap.get(pos);
      const meaningSynonyms = uniqueStrings(
        Array.isArray(m.synonyms) ? m.synonyms : []
      );
      const meaningAntonyms = uniqueStrings(
        Array.isArray(m.antonyms) ? m.antonyms : []
      );

      if (existing) {
        existing.definitions.push(...definitions);
        existing.synonyms = uniqueStrings([
          ...existing.synonyms,
          ...meaningSynonyms,
        ]);
        existing.antonyms = uniqueStrings([
          ...existing.antonyms,
          ...meaningAntonyms,
        ]);
      } else {
        meaningMap.set(pos, {
          partOfSpeech: pos,
          definitions,
          synonyms: meaningSynonyms,
          antonyms: meaningAntonyms,
        });
      }
    }
  }

  const meanings = Array.from(meaningMap.values());
  if (meanings.length === 0) {
    throw new DictionaryNotFoundError(fallbackWord);
  }

  return {
    word: resolvedWord,
    phonetic,
    audioUrl,
    source: "dictionaryapi",
    sourceUrl,
    meanings,
  };
}

function normalizeFallbackResponse(
  payload: FallbackApiResponse,
  fallbackWord: string
): NormalizedDictionaryEntry {
  const rawEntries = Array.isArray(payload.entries) ? payload.entries : [];
  const englishEntries = rawEntries.filter(
    (entry) => !entry.language?.code || entry.language.code === "en"
  );
  const selectedEntries =
    englishEntries.length > 0 ? englishEntries : rawEntries;

  let phonetic: string | null = null;
  const meaningMap = new Map<string, NormalizedMeaning>();

  for (const entry of selectedEntries) {
    if (Array.isArray(entry.pronunciations)) {
      const ipa = entry.pronunciations.find(
        (p) => p.type === "ipa" && p.text?.trim()
      );
      const anyPron = entry.pronunciations.find((p) => p.text?.trim());
      if (!phonetic && (ipa?.text || anyPron?.text)) {
        phonetic = (ipa?.text ?? anyPron?.text ?? "").trim() || null;
      }
    }

    const pos = entry.partOfSpeech?.trim() || "other";
    const definitions: NormalizedDefinition[] = [];
    const collectedSynonyms: string[] = Array.isArray(entry.synonyms)
      ? [...entry.synonyms]
      : [];
    const collectedAntonyms: string[] = Array.isArray(entry.antonyms)
      ? [...entry.antonyms]
      : [];

    if (Array.isArray(entry.senses)) {
      for (const sense of entry.senses) {
        const text = sense.definition?.trim();
        if (text) {
          definitions.push({
            definition: text,
            example: sense.examples?.[0]?.trim() || undefined,
            synonyms: uniqueStrings(
              Array.isArray(sense.synonyms) ? sense.synonyms : []
            ),
            antonyms: uniqueStrings(
              Array.isArray(sense.antonyms) ? sense.antonyms : []
            ),
          });
          if (Array.isArray(sense.synonyms)) {
            collectedSynonyms.push(...sense.synonyms);
          }
          if (Array.isArray(sense.antonyms)) {
            collectedAntonyms.push(...sense.antonyms);
          }
        }

        if (Array.isArray(sense.subsenses)) {
          for (const sub of sense.subsenses) {
            const subText = sub.definition?.trim();
            if (!subText) continue;
            definitions.push({
              definition: subText,
              example: sub.examples?.[0]?.trim() || undefined,
              synonyms: uniqueStrings(
                Array.isArray(sub.synonyms) ? sub.synonyms : []
              ),
              antonyms: uniqueStrings(
                Array.isArray(sub.antonyms) ? sub.antonyms : []
              ),
            });
          }
        }
      }
    }

    if (definitions.length === 0) continue;

    const existing = meaningMap.get(pos);
    const synList = uniqueStrings(collectedSynonyms);
    const antList = uniqueStrings(collectedAntonyms);

    if (existing) {
      existing.definitions.push(...definitions);
      existing.synonyms = uniqueStrings([...existing.synonyms, ...synList]);
      existing.antonyms = uniqueStrings([...existing.antonyms, ...antList]);
    } else {
      meaningMap.set(pos, {
        partOfSpeech: pos,
        definitions,
        synonyms: synList,
        antonyms: antList,
      });
    }
  }

  const meanings = Array.from(meaningMap.values());
  if (meanings.length === 0) {
    throw new DictionaryNotFoundError(fallbackWord);
  }

  return {
    word: payload.word?.trim().toLowerCase() || fallbackWord,
    phonetic,
    audioUrl: null,
    source: "freedictionaryapi",
    sourceUrl: payload.source?.url,
    meanings,
  };
}

async function fetchFromPrimary(
  term: string,
  signal?: AbortSignal
): Promise<NormalizedDictionaryEntry> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
    term
  )}`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    if (response.status === 404) {
      throw new DictionaryNotFoundError(term);
    }
    throw new Error(`Primary dictionary HTTP ${response.status}`);
  }

  const json: unknown = await response.json();
  if (!Array.isArray(json) || json.length === 0) {
    throw new DictionaryNotFoundError(term);
  }

  return normalizePrimaryEntries(json as PrimaryApiEntry[], term);
}

async function fetchFromFallback(
  term: string,
  signal?: AbortSignal
): Promise<NormalizedDictionaryEntry> {
  const url = `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(
    term
  )}`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    if (response.status === 404) {
      throw new DictionaryNotFoundError(term);
    }
    throw new Error(`Fallback dictionary HTTP ${response.status}`);
  }

  const json = (await response.json()) as FallbackApiResponse;
  return normalizeFallbackResponse(json, term);
}

async function fetchPrimaryOrFallback(
  term: string,
  signal?: AbortSignal
): Promise<NormalizedDictionaryEntry> {
  try {
    return await fetchFromPrimary(term, signal);
  } catch (primaryError: unknown) {
    if (isAbortError(primaryError)) {
      throw primaryError;
    }

    try {
      return await fetchFromFallback(term, signal);
    } catch (fallbackError: unknown) {
      if (isAbortError(fallbackError)) {
        throw fallbackError;
      }
      if (fallbackError instanceof DictionaryNotFoundError) {
        throw fallbackError;
      }
      if (primaryError instanceof DictionaryNotFoundError) {
        throw primaryError;
      }
      throw new Error(
        `Unable to reach dictionary services for "${term}". Check your connection and try again.`
      );
    }
  }
}

function isCircularOrRedirectDefinition(
  definitionText: string,
  term: string
): boolean {
  const clean = definitionText.trim().toLowerCase();
  if (/^(?:see|alternative spelling of|alternative form of)\b/.test(clean)) {
    return true;
  }
  const stem = term.slice(0, Math.min(5, term.length));
  const wordCount = clean.split(/\s+/).length;
  return wordCount <= 4 && stem.length >= 4 && clean.includes(stem);
}

function enrichEntry(
  base: NormalizedDictionaryEntry,
  term: string,
  simpleResult: SimpleWikiResult | null,
  datamuseResult: DatamuseResult | null
): NormalizedDictionaryEntry {
  const meanings = base.meanings.map((meaning) => {
    const sortedDefs = [...meaning.definitions].sort((a, b) => {
      const aCirc = isCircularOrRedirectDefinition(a.definition, term) ? 1 : 0;
      const bCirc = isCircularOrRedirectDefinition(b.definition, term) ? 1 : 0;
      return aCirc - bCirc;
    });

    return {
      ...meaning,
      definitions: sortedDefs,
      synonyms: [...meaning.synonyms],
      antonyms: [...meaning.antonyms],
    };
  });

  if (datamuseResult && datamuseResult.posOrder.length > 0) {
    const rankMap = new Map<string, number>();
    datamuseResult.posOrder.forEach((pos, idx) => {
      rankMap.set(pos.toLowerCase(), idx);
    });

    meanings.sort((a, b) => {
      const rankA = rankMap.get(a.partOfSpeech.toLowerCase()) ?? 99;
      const rankB = rankMap.get(b.partOfSpeech.toLowerCase()) ?? 99;
      return rankA - rankB;
    });
  }

  if (meanings[0] && meanings[0].synonyms.length < 3) {
    const extraSyns = [
      ...(simpleResult?.synonyms ?? []),
      ...(datamuseResult?.synonyms ?? []),
    ].filter((syn) => syn.toLowerCase() !== term);
    meanings[0].synonyms = uniqueStrings([
      ...meanings[0].synonyms,
      ...extraSyns,
    ]).slice(0, 6);
  }

  const enrichedSources: string[] = [];
  if (base.source === "dictionaryapi") {
    enrichedSources.push("DictionaryAPI");
  } else if (base.source === "freedictionaryapi") {
    enrichedSources.push("FreeDictionaryAPI");
  } else if (base.source === "wikipedia") {
    enrichedSources.push("Wikipedia");
  } else {
    enrichedSources.push("Datamuse");
  }

  if (simpleResult?.simpleDefinition) {
    enrichedSources.push("Simple Wiktionary");
  }
  if (
    datamuseResult &&
    !enrichedSources.includes("Datamuse") &&
    (datamuseResult.posOrder.length > 0 || datamuseResult.synonyms.length > 0)
  ) {
    enrichedSources.push("Datamuse");
  }

  return {
    ...base,
    simpleDefinition: simpleResult?.simpleDefinition ?? base.simpleDefinition,
    enrichedSources,
    meanings,
  };
}

async function fetchWordSuggestions(
  term: string,
  signal?: AbortSignal
): Promise<string[]> {
  const spUrl = `https://api.datamuse.com/words?sp=${encodeURIComponent(
    term
  )}&max=5`;
  const slUrl = `https://api.datamuse.com/words?sl=${encodeURIComponent(
    term
  )}&max=5`;

  const [spRes, slRes] = await Promise.allSettled([
    fetchJsonWithTimeout<DatamuseWordItem[]>(spUrl, signal, 1200),
    fetchJsonWithTimeout<DatamuseWordItem[]>(slUrl, signal, 1200),
  ]);

  if (signal?.aborted) {
    return [];
  }

  const candidates: string[] = [];
  if (spRes.status === "fulfilled" && Array.isArray(spRes.value)) {
    for (const item of spRes.value) {
      if (item.word) candidates.push(item.word.trim().toLowerCase());
    }
  }
  if (slRes.status === "fulfilled" && Array.isArray(slRes.value)) {
    for (const item of slRes.value) {
      if (item.word) candidates.push(item.word.trim().toLowerCase());
    }
  }

  return uniqueStrings(candidates)
    .filter((w) => w !== term && w.length >= 2)
    .slice(0, 5);
}

export async function fetchWordDefinition(
  rawTerm: string,
  signal?: AbortSignal
): Promise<NormalizedDictionaryEntry> {
  const term = normalizeTerm(rawTerm);
  if (term.length < 2) {
    throw new DictionaryNotFoundError(rawTerm, "Enter at least 2 characters.");
  }

  const [primarySettled, simpleSettled, datamuseSettled] =
    await Promise.allSettled([
      fetchPrimaryOrFallback(term, signal),
      fetchSimpleWiktionary(term, signal),
      fetchDatamuseEnrichment(term, signal),
    ]);

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const simpleResult =
    simpleSettled.status === "fulfilled" ? simpleSettled.value : null;
  const datamuseResult =
    datamuseSettled.status === "fulfilled" ? datamuseSettled.value : null;

  if (primarySettled.status === "fulfilled") {
    return enrichEntry(primarySettled.value, term, simpleResult, datamuseResult);
  }

  if (isAbortError(primarySettled.reason)) {
    throw primarySettled.reason;
  }

  if (datamuseResult && datamuseResult.lexicalMeanings.length > 0) {
    const datamuseBase: NormalizedDictionaryEntry = {
      word: term,
      phonetic: null,
      audioUrl: null,
      source: "datamuse",
      sourceUrl: "https://www.datamuse.com",
      meanings: datamuseResult.lexicalMeanings,
    };
    return enrichEntry(datamuseBase, term, simpleResult, datamuseResult);
  }

  const wikipediaEntry = await fetchWikipediaSummary(term, signal);
  if (wikipediaEntry) {
    return enrichEntry(wikipediaEntry, term, simpleResult, datamuseResult);
  }

  if (datamuseResult && datamuseResult.properNounMeanings.length > 0) {
    const datamuseProperBase: NormalizedDictionaryEntry = {
      word: term,
      phonetic: null,
      audioUrl: null,
      source: "datamuse",
      sourceUrl: "https://www.datamuse.com",
      meanings: datamuseResult.properNounMeanings,
    };
    return enrichEntry(datamuseProperBase, term, simpleResult, datamuseResult);
  }

  if (primarySettled.reason instanceof DictionaryNotFoundError) {
    const suggestions = await fetchWordSuggestions(term, signal);
    throw new DictionaryNotFoundError(
      term,
      primarySettled.reason.message,
      suggestions
    );
  }

  throw primarySettled.reason;
}

export function reshapeDictionaryEntry(
  entry: NormalizedDictionaryEntry,
  mode: DisplayMode,
  showExamples: boolean
): ReshapedWordView {
  const totalMeanings = entry.meanings.length;
  const totalDefinitions = entry.meanings.reduce(
    (sum, m) => sum + m.definitions.length,
    0
  );

  const selectedMeanings =
    mode === "concise" ? entry.meanings.slice(0, 2) : entry.meanings;

  const meanings: NormalizedMeaning[] = selectedMeanings.map((meaning) => {
    const selectedDefs =
      mode === "concise"
        ? meaning.definitions.slice(0, 2)
        : meaning.definitions;

    const definitions: NormalizedDefinition[] = selectedDefs.map((def) => ({
      definition: def.definition,
      example: showExamples ? def.example : undefined,
      synonyms:
        mode === "concise" ? def.synonyms.slice(0, 4) : [...def.synonyms],
      antonyms: mode === "concise" ? [] : [...def.antonyms],
    }));

    const combinedSynonyms = uniqueStrings([
      ...meaning.synonyms,
      ...selectedDefs.flatMap((d) => d.synonyms),
    ]);

    return {
      partOfSpeech: meaning.partOfSpeech,
      definitions,
      synonyms:
        mode === "concise" ? combinedSynonyms.slice(0, 5) : combinedSynonyms,
      antonyms: mode === "concise" ? [] : [...meaning.antonyms],
    };
  });

  return {
    word: entry.word,
    phonetic: entry.phonetic,
    audioUrl: entry.audioUrl,
    source: entry.source,
    sourceUrl: entry.sourceUrl,
    simpleDefinition: entry.simpleDefinition,
    enrichedSources: entry.enrichedSources,
    meanings,
    totalMeanings,
    totalDefinitions,
  };
}

export function extractConciseSummary(entry: NormalizedDictionaryEntry): {
  conciseMeaning: string;
  example?: string;
} {
  let firstExample: string | undefined;
  for (const meaning of entry.meanings) {
    for (const def of meaning.definitions) {
      if (def.example) {
        firstExample = def.example;
        break;
      }
    }
    if (firstExample) break;
  }

  return {
    conciseMeaning:
      entry.simpleDefinition ||
      (entry.meanings[0]?.definitions[0]?.definition ?? ""),
    example: firstExample,
  };
}

export function createMinimalEntryFromShare(params: {
  term: string;
  conciseMeaning: string;
  example?: string;
}): NormalizedDictionaryEntry {
  return {
    word: normalizeTerm(params.term) || params.term.trim().toLowerCase(),
    phonetic: null,
    audioUrl: null,
    source: "dictionaryapi",
    meanings: [
      {
        partOfSpeech: "shared",
        definitions: [
          {
            definition: params.conciseMeaning,
            example: params.example,
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
