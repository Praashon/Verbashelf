export const LEGAL_OPERATOR = {
  name: "Prashon Gautam",
  role: "Creator & Independent Operator",
  email: "mr.prashon@gmail.com",
  location: "Kathmandu, Nepal",
  productName: "VerbaShelf",
  tagline: "Personal Vocabulary & Speaking Vault",
} as const;

export const LEGAL_EFFECTIVE_DATE = "November 22, 2026";
export const LEGAL_COPYRIGHT_YEAR = 2026;

export type LegalRouteId = "privacy" | "terms" | "legal";

export interface LegalRouteMeta {
  id: LegalRouteId;
  href: `/${LegalRouteId}`;
  label: string;
  shortLabel: string;
  description: string;
}

export const LEGAL_ROUTES: ReadonlyArray<LegalRouteMeta> = [
  {
    id: "privacy",
    href: "/privacy",
    label: "Privacy Policy",
    shortLabel: "Privacy",
    description:
      "How your vocabulary, microphone audio, and lookups stay private and local-first.",
  },
  {
    id: "terms",
    href: "/terms",
    label: "Terms of Service",
    shortLabel: "Terms",
    description:
      "Rules for using VerbaShelf, local storage responsibility, and open dictionary licenses.",
  },
  {
    id: "legal",
    href: "/legal",
    label: "Legal & Policies",
    shortLabel: "Legal & Cookies",
    description:
      "Operator imprint, browser storage & cookie disclosure, attributions, and contact info.",
  },
];

export interface StorageInventoryItem {
  keyName: string;
  category: string;
  purpose: string;
  retention: string;
}

export const LOCAL_STORAGE_INVENTORY: ReadonlyArray<StorageInventoryItem> = [
  {
    keyName: "IndexedDB — VerbaShelfDB (topics, words, profile, trash)",
    category: "Local Database (Dexie.js)",
    purpose:
      "Stores saved vocabulary entries, dictionary definitions, custom topic folders, soft-deleted Trash items, local display name, canvas-compressed avatar (<= 160x160 px), and lookup/shortcut preferences.",
    retention:
      "Stays on your device until you delete entries, wipe the vault in Settings, or clear browser site data.",
  },
  {
    keyName: "localStorage — verbashelf-theme",
    category: "Preference",
    purpose: "Remembers your Light or Dark theme selection before first paint.",
    retention: "Until changed or browser storage is cleared.",
  },
  {
    keyName: "localStorage — verbashelf-active-topic",
    category: "Preference",
    purpose:
      "Remembers your most recently selected active topic folder on the Lookup page.",
    retention: "Until changed or browser storage is cleared.",
  },
  {
    keyName: "localStorage — verbashelf-onboarding-v1",
    category: "Preference",
    purpose:
      "Tracks whether you have already seen or dismissed the Interactive Live Guide.",
    retention: "Until browser storage is cleared.",
  },
  {
    keyName: "localStorage — verbashelf-voice-model-v2",
    category: "Voice Cache Flag",
    purpose:
      "Records whether the on-device Whisper voice model has already been cached in your browser.",
    retention: "Until browser storage is cleared.",
  },
  {
    keyName: "Browser Cache Storage — Transformers.js / ONNX WASM",
    category: "Model Cache",
    purpose:
      "Caches the downloaded onnx-community/whisper-base.en quantized model and WebAssembly runtime locally so subsequent voice searches run offline on-device.",
    retention:
      "Managed by browser cache; removable anytime via browser site data settings.",
  },
  {
    keyName: "HTTP Cookies — None",
    category: "Cookies",
    purpose:
      "VerbaShelf sets zero first-party tracking, analytics, advertising, or authentication cookies.",
    retention: "Not applicable.",
  },
];

export interface ThirdPartyServiceItem {
  name: string;
  host: string;
  purpose: string;
  notes: string;
}

export const THIRD_PARTY_SERVICES: ReadonlyArray<ThirdPartyServiceItem> = [
  {
    name: "Free Dictionary API",
    host: "api.dictionaryapi.dev",
    purpose:
      "Primary English definitions, IPA phonetics, and pronunciation audio URLs.",
    notes:
      "Queried directly from your browser when looking up a word.",
  },
  {
    name: "FreeDictionaryAPI",
    host: "freedictionaryapi.com",
    purpose:
      "Secondary Wiktionary-based fallback for rare, archaic, or literary vocabulary.",
    notes:
      "Queried directly from your browser when primary entries are unavailable.",
  },
  {
    name: "Simple English Wiktionary",
    host: "simple.wiktionary.org",
    purpose: "Plain-English summary enrichment and inline synonyms.",
    notes: "Content available under CC BY-SA 4.0.",
  },
  {
    name: "Datamuse API",
    host: "api.datamuse.com",
    purpose:
      "Part-of-speech ranking, related synonyms, and spelling suggestions.",
    notes: "Queried directly from your browser for word enrichment.",
  },
  {
    name: "Wikipedia REST API",
    host: "en.wikipedia.org",
    purpose:
      "Fallback reference summaries for proper nouns and encyclopedic terms.",
    notes: "Content available under CC BY-SA 4.0.",
  },
  {
    name: "Hugging Face CDN",
    host: "huggingface.co",
    purpose:
      "One-time browser download of open-weight onnx-community/whisper-base.en model assets used for local on-device voice transcription.",
    notes:
      "Assets are cached in browser Cache Storage after the initial download.",
  },
  {
    name: "Browser Web Speech API",
    host: "Browser / OS built-in",
    purpose:
      "Optional browser-native speech recognition used when available before the local Whisper engine finishes loading.",
    notes:
      "Handled under your browser or operating system vendor's privacy policy.",
  },
];
