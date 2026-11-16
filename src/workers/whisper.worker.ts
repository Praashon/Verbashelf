import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;
env.useWasmCache = true;

if (
  typeof self !== "undefined" &&
  !self.crossOriginIsolated &&
  env.backends.onnx.wasm
) {
  env.backends.onnx.wasm.numThreads = 1;
}

import { VOICE_MODEL_ID } from "@/lib/voiceModel";

type WorkerInboundMessage =
  | { type: "preload" }
  | { type: "transcribe"; id: number; audio: Float32Array };

export type WorkerOutboundMessage =
  | { type: "progress"; percent: number }
  | { type: "ready" }
  | { type: "transcribing"; id: number }
  | { type: "complete"; id: number; text: string }
  | { type: "error"; id?: number; message: string };

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null =
  null;
const fileProgressMap = new Map<string, { loaded: number; total: number }>();

function postWorkerMessage(message: WorkerOutboundMessage): void {
  self.postMessage(message);
}

function handleModelProgress(info: ProgressInfo): void {
  if (info.status === "progress_total") {
    const percent = Math.max(0, Math.min(100, Math.round(info.progress)));
    postWorkerMessage({ type: "progress", percent });
    return;
  }

  if (info.status === "progress" && info.total > 0) {
    fileProgressMap.set(info.file, {
      loaded: info.loaded,
      total: info.total,
    });
    let totalLoaded = 0;
    let totalBytes = 0;
    for (const entry of fileProgressMap.values()) {
      totalLoaded += entry.loaded;
      totalBytes += entry.total;
    }
    if (totalBytes > 0) {
      const percent = Math.max(
        0,
        Math.min(100, Math.round((totalLoaded / totalBytes) * 100))
      );
      postWorkerMessage({ type: "progress", percent });
    }
    return;
  }

  if (info.status === "ready") {
    postWorkerMessage({ type: "ready" });
  }
}

async function getTranscriber(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!transcriberPromise) {
    transcriberPromise = pipeline(
      "automatic-speech-recognition",
      VOICE_MODEL_ID,
      {
        device: "wasm",
        dtype: "q8",
        progress_callback: handleModelProgress,
      }
    ).catch((error: unknown) => {
      transcriberPromise = null;
      throw error;
    });
  }
  return transcriberPromise;
}

self.addEventListener(
  "message",
  (event: MessageEvent<WorkerInboundMessage>) => {
    const payload = event.data;

    if (payload.type === "preload") {
      void getTranscriber()
        .then(() => {
          postWorkerMessage({ type: "ready" });
        })
        .catch((error: unknown) => {
          postWorkerMessage({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load local speech model.",
          });
        });
      return;
    }

    if (payload.type === "transcribe") {
      const requestId = payload.id;
      void (async () => {
        try {
          const transcriber = await getTranscriber();
          postWorkerMessage({ type: "transcribing", id: requestId });

          const output = await transcriber(payload.audio, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: false,
          });

          const text = Array.isArray(output)
            ? output.map((item) => item.text).join(" ")
            : output.text;

          postWorkerMessage({
            type: "complete",
            id: requestId,
            text: text.trim(),
          });
        } catch (error: unknown) {
          postWorkerMessage({
            type: "error",
            id: requestId,
            message:
              error instanceof Error
                ? error.message
                : "Local voice transcription failed.",
          });
        }
      })();
    }
  }
);
