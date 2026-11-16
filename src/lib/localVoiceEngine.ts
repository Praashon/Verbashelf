"use client";

import { VOICE_MODEL_ID } from "@/lib/voiceModel";
import type { WorkerOutboundMessage } from "@/workers/whisper.worker";

const MODEL_CACHE_FLAG_KEY = "verbashelf-voice-model-v2";
const CACHED_MODEL_VALUE = VOICE_MODEL_ID;

export interface LocalVoiceEngineState {
  ready: boolean;
  loading: boolean;
  cached: boolean;
  downloadProgress: number | null;
  transcribing: boolean;
}

const SERVER_SNAPSHOT: LocalVoiceEngineState = {
  ready: false,
  loading: false,
  cached: false,
  downloadProgress: null,
  transcribing: false,
};

function readCachedFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MODEL_CACHE_FLAG_KEY) === CACHED_MODEL_VALUE;
  } catch {
    return false;
  }
}

function writeCachedFlag(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MODEL_CACHE_FLAG_KEY, CACHED_MODEL_VALUE);
  } catch {
  }
}

let currentState: LocalVoiceEngineState = {
  ready: false,
  loading: false,
  cached: false,
  downloadProgress: null,
  transcribing: false,
};

let initializedCacheFlag = false;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function updateState(patch: Partial<LocalVoiceEngineState>): void {
  currentState = { ...currentState, ...patch };
  notifyListeners();
}

export function subscribeLocalVoiceState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLocalVoiceState(): LocalVoiceEngineState {
  if (typeof window !== "undefined" && !initializedCacheFlag) {
    initializedCacheFlag = true;
    const isCached = readCachedFlag();
    if (isCached !== currentState.cached) {
      currentState = { ...currentState, cached: isCached };
    }
  }
  return currentState;
}

export function getServerLocalVoiceState(): LocalVoiceEngineState {
  return SERVER_SNAPSHOT;
}

interface PendingTranscription {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

let workerInstance: Worker | null = null;
let preloadRequested = false;
let requestSeq = 0;
const pendingTranscriptions = new Map<number, PendingTranscription>();

function ensureWorker(): Worker {
  if (workerInstance) {
    return workerInstance;
  }

  const worker = new Worker(
    new URL("../workers/whisper.worker.ts", import.meta.url),
    { type: "module" }
  );

  worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
    const msg = event.data;

    if (msg.type === "progress") {
      if (!currentState.ready) {
        updateState({
          loading: true,
          downloadProgress: currentState.cached ? null : msg.percent,
        });
      }
      return;
    }

    if (msg.type === "ready") {
      writeCachedFlag();
      updateState({
        ready: true,
        loading: false,
        cached: true,
        downloadProgress: null,
      });
      return;
    }

    if (msg.type === "transcribing") {
      if (pendingTranscriptions.has(msg.id)) {
        updateState({
          ready: true,
          loading: false,
          cached: true,
          downloadProgress: null,
          transcribing: true,
        });
      }
      return;
    }

    if (msg.type === "complete") {
      const pending = pendingTranscriptions.get(msg.id);
      if (pending) {
        pendingTranscriptions.delete(msg.id);
        updateState({ transcribing: pendingTranscriptions.size > 0 });
        pending.resolve(msg.text);
      }
      return;
    }

    if (msg.type === "error") {
      const error = new Error(
        msg.message || "Local speech recognition failed."
      );
      if (msg.id !== undefined) {
        const pending = pendingTranscriptions.get(msg.id);
        if (pending) {
          pendingTranscriptions.delete(msg.id);
          updateState({
            loading: false,
            downloadProgress: null,
            transcribing: pendingTranscriptions.size > 0,
          });
          pending.reject(error);
        }
        return;
      }

      preloadRequested = false;
      updateState({
        loading: false,
        downloadProgress: null,
        transcribing: false,
      });
      for (const [id, pending] of pendingTranscriptions.entries()) {
        pendingTranscriptions.delete(id);
        pending.reject(error);
      }
    }
  };

  worker.onerror = () => {
    preloadRequested = false;
    workerInstance = null;
    updateState({
      ready: false,
      loading: false,
      downloadProgress: null,
      transcribing: false,
    });
    const error = new Error("Could not initialize local voice recognition worker.");
    for (const [id, pending] of pendingTranscriptions.entries()) {
      pendingTranscriptions.delete(id);
      pending.reject(error);
    }
  };

  workerInstance = worker;
  return worker;
}

export function canSupportLocalVoiceEngine(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return Boolean(
    window.isSecureContext &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined" &&
      typeof Worker !== "undefined"
  );
}

interface NavigatorWithConnection extends Navigator {
  connection?: {
    saveData?: boolean;
  };
}

export function shouldAutoPreloadLocalVoice(): boolean {
  if (!canSupportLocalVoiceEngine()) {
    return false;
  }
  const nav = navigator as NavigatorWithConnection;
  if (nav.connection?.saveData) {
    return readCachedFlag();
  }
  return true;
}

export function preloadLocalVoiceModel(): void {
  if (!canSupportLocalVoiceEngine()) return;
  if (currentState.ready || preloadRequested) return;

  const isCached = readCachedFlag();
  preloadRequested = true;
  updateState({
    cached: isCached,
    loading: true,
  });

  const worker = ensureWorker();
  worker.postMessage({ type: "preload" });
}

export function cancelActiveTranscriptions(): void {
  for (const [id, pending] of pendingTranscriptions.entries()) {
    pendingTranscriptions.delete(id);
    pending.reject(new Error("CANCELLED"));
  }
  updateState({ transcribing: false });
}

export function transcribeLocalAudio(audio: Float32Array): Promise<string> {
  if (!canSupportLocalVoiceEngine()) {
    return Promise.reject(
      new Error("Microphone recording is not supported in this browser.")
    );
  }

  const worker = ensureWorker();
  preloadRequested = true;
  if (!currentState.ready) {
    updateState({
      cached: readCachedFlag(),
      loading: true,
    });
  }

  const requestId = ++requestSeq;

  return new Promise<string>((resolve, reject) => {
    pendingTranscriptions.set(requestId, { resolve, reject });
    worker.postMessage(
      { type: "transcribe", id: requestId, audio },
      [audio.buffer]
    );
  });
}
