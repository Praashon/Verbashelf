<div align="center">

# VerbaShelf

**A local-first personal vocabulary vault and speaking companion built with Next.js, IndexedDB, and in-browser Whisper speech recognition.**

[![Next.js](https://img.shields.io/badge/Next.js-16.4-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3-149ECA?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![IndexedDB](https://img.shields.io/badge/Storage-Dexie%20IndexedDB-7C3AED?style=flat-square)](https://dexie.org/)
[![Whisper WASM](https://img.shields.io/badge/Voice-In--Browser%20Whisper-10B981?style=flat-square)](https://huggingface.co/docs/transformers.js)
[![Architecture](https://img.shields.io/badge/Backend-Zero%20Database-0F172A?style=flat-square)](#privacy-and-local-first-architecture)

</div>

---

## Overview

VerbaShelf turns dictionary lookups into an organized, searchable personal lexicon stored entirely in your browser. Look up words by typing or speaking, toggle between concise and detailed definitions in 0 ms from memory, organize vocabulary into custom topic shelves, travel chronologically through past study days, and share curated collections through compressed URL fragments without any server database or cloud account.

## Highlights

- **100% Client-Side & Private:** Every topic, saved word, trash item, and profile avatar stays inside your browser's IndexedDB (`Dexie.js`). Zero remote databases, zero telemetry, and zero authentication walls.
- **Cross-Browser In-Browser Whisper AI Voice Search:** Runs `onnx-community/whisper-base.en` (INT8 quantized WASM via `@huggingface/transformers`) inside a dedicated Web Worker with browser cache persistence, enabling reliable voice lookup across Brave, Firefox, Chrome, Edge, and mobile browsers where Web Speech API struggles or fails offline.
- **Configurable Push-to-Talk & Typing Pacing:** Bind a custom push-to-talk keyboard shortcut in Settings, use `/` anywhere outside inputs to jump to search, and tune your typing debounce speed so fast or deliberate typists never trigger premature lookups on partial words.
- **Multi-Source Dictionary Pipeline:** Queries `dictionaryapi.dev` first and automatically falls back or enriches across `freedictionaryapi.com`, Wikipedia, and Datamuse when searching rare, literary, proper-noun, or cultural terms, using `AbortSignal` request cancellation and TanStack Query v5 `select` reshaping for instant in-memory toggling.
- **Smart Topic Shelves & Chronological Vault:** Deduplicates repeated lookups within the same topic while surfacing a *"Previously saved"* indicator, plus collapsible topic folders, soft-delete trash recovery, and chronological date grouping in `/vault`.
- **Zero-DB Selective Link Sharing:** Select all or hand-pick specific words and topics, watch the live 6,000-character URL capacity meter, generate compressed `/share#v1=<payload>` links via `lz-string`, or export a portable `.json` share file when lists grow large.
- **Interactive Live Onboarding Demo:** First-time visitors get an interactive walkthrough inside the live app (with a skip option and on-demand `?` guide launcher in the navbar).
- **Full Data Portability:** Customize your local profile with canvas-compressed avatars (`<= 160x160` px), export Zod-validated `verbashelf-backup-YYYY-MM-DD.json` snapshots, import backups with **Merge** or **Replace All**, or wipe local storage with double confirmation (`DELETE`).

---

## Architecture & Directory Layout

```text
src/
├── app/
│   ├── layout.tsx              # Root layout, theme initialization, Navbar & Providers
│   ├── Providers.tsx           # TanStack Query v5 client + global UI drawer/modal state
│   ├── page.tsx                # Home lookup experience (/): search, voice, active card
│   ├── vault/page.tsx          # Vault browser (/vault): topic shelves & date time-travel
│   └── share/page.tsx          # Read-only shared deck viewer & one-click vault importer
├── components/
│   ├── HomeClient.tsx          # Orchestrates search state, onboarding, and word card flow
│   ├── LookupBar.tsx           # Search input, clear flow, `/` shortcut & mic controls
│   ├── PreferenceBar.tsx       # Instant Concise / Comprehensive & Examples switches
│   ├── WordCard.tsx            # IPA phonetics, audio playback, definitions & synonyms
│   ├── TopicSelector.tsx       # Active topic switcher with inline folder creation
│   ├── OnboardingDemo.tsx      # Interactive live walkthrough for first-time users
│   ├── ShareModal.tsx          # Manual/bulk selector + live 6,000-char URL meter
│   ├── ShareClient.tsx         # `#v1=` payload parser & vault importer on `/share`
│   ├── SettingsDrawer.tsx      # Typing speed, push-to-talk keybind, theme, backup & reset
│   ├── ProfileModal.tsx        # Display name + 160x160 canvas-compressed local avatar
│   ├── VaultClient.tsx         # Collapsible topics, chronological timeline & trash bin
│   └── Navbar.tsx              # Navigation, guide launcher (`?`), Share & Profile actions
├── hooks/
│   ├── useWordLookup.ts        # TanStack Query v5 lookup with `select` & AbortSignal
│   ├── useVoiceSearch.ts       # Dual Whisper Worker + Web Speech voice controller
│   └── useVault.ts             # Reactive Dexie queries, topic CRUD & deduplication
├── lib/
│   ├── db.ts                   # Dexie v2 schema (`topics`, `words`, `profile`, `trash`)
│   ├── dictionary.ts           # Multi-source dictionary normalization & concise summaries
│   ├── localVoiceEngine.ts     # Singleton Whisper worker lifecycle & browser cache state
│   ├── voiceModel.ts           # Shared Whisper model identifier constant
│   ├── share.ts                # `lz-string` hash serializer & URL capacity calculator
│   └── backup.ts               # Zod schemas, JSON backup generator & IndexedDB reset
└── workers/
    └── whisper.worker.ts       # Dedicated Web Worker for quantized WASM Whisper inference
```

---

## Data & Voice Design

### 1. Local Storage Schema (`src/lib/db.ts`)

| Table | Purpose | Indexed / Primary Keys |
| :--- | :--- | :--- |
| `topics` | Custom vocabulary folders (seeded with `"General"`) | `++id`, `name`, `createdAt` |
| `words` | Saved word snapshots with phonetics, audio, raw entry & mode | `++id`, `term`, `topicId`, `dateKey` |
| `profile` | Local settings, display name, typing speed, voice keybind & avatar | `id` (`"me"`) |
| `trash` | Soft-deleted word entries available for recovery or permanent removal | `++id` |

### 2. Zero-Latency Reshaping (`useWordLookup.ts`)

- Queries use the key `['word', normalizedTerm]` with `staleTime: Infinity` and `retry: false` so fallback lookup activates immediately on missing primary entries.
- Full normalized responses are fetched once and reshaped in memory via TanStack Query's `select` option when toggling **Concise / Comprehensive** or **Examples On / Off**.
- In-flight HTTP requests receive TanStack Query's `signal` so rapid typing cancels stale fetches cleanly.

### 3. Browser-Resilient Voice Search (`whisper.worker.ts` & `useVoiceSearch.ts`)

- Downloads `onnx-community/whisper-base.en` (`dtype: "q8"`, WASM backend) once inside a background Web Worker and persists model assets via browser caching (`useBrowserCache` and `useWasmCache`) so repeat visits reuse local weights without re-downloading.
- Works inside browsers without working cloud Web Speech endpoints (such as Brave, Firefox, and restricted WebViews) alongside native browser speech recognition when appropriate.

---

## Tech Stack

| Category | Technology |
| :--- | :--- |
| Framework | Next.js `16.4.6` (App Router, Cache Components enabled) |
| UI Runtime | React `19.3.0`, TypeScript (strict mode), Tailwind CSS v4 |
| State & Fetching | `@tanstack/react-query` `v5` |
| Client Database | `dexie` + `dexie-react-hooks` (IndexedDB) |
| On-Device Voice AI | `@huggingface/transformers` (`onnx-community/whisper-base.en` WASM) |
| Validation & Sharing | `zod` `v4`, `lz-string` |
| Icons | `lucide-react` |

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **pnpm** (`12.x` recommended, matching `packageManager` in `package.json`)

### Local Development

```bash
# Install dependencies
pnpm install

# Start the Next.js development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Allow microphone access when testing push-to-talk or mic button voice lookup.

### Quality Checks & Production Build

```bash
# Type-check strict TypeScript
npx tsc --noEmit

# Run ESLint
pnpm lint

# Build production bundle
pnpm build
```

---

## Privacy and Local-First Architecture

VerbaShelf includes **no backend database, no analytics SDK, and no user tracking**. External network calls occur only when fetching public dictionary definitions (`api.dictionaryapi.dev`, `freedictionaryapi.com`, Wikipedia, Datamuse), audio pronunciations linked in dictionary responses, or the first-time download of the open-weight Whisper WASM model assets cached inside your browser. All personal vocabulary lists, avatars, settings, and deleted items live exclusively on your own device and can be backed up or purged from Settings at any time.
