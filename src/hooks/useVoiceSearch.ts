"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  cancelActiveTranscriptions,
  canSupportLocalVoiceEngine,
  getLocalVoiceState,
  getServerLocalVoiceState,
  preloadLocalVoiceModel,
  subscribeLocalVoiceState,
  transcribeLocalAudio,
} from "@/lib/localVoiceEngine";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex?: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  processLocally?: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechAvailabilityOptions {
  langs: string[];
  processLocally?: boolean;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
  available?: (options: SpeechAvailabilityOptions) => Promise<string>;
}

interface WindowWithAudioAndSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  webkitAudioContext?: typeof AudioContext;
}

interface NavigatorWithBrave extends Navigator {
  brave?: {
    isBrave?: () => Promise<boolean>;
  };
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const win = window as WindowWithAudioAndSpeech;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

async function detectIsBrave(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorWithBrave;
  if (typeof nav.brave?.isBrave === "function") {
    try {
      return await nav.brave.isBrave();
    } catch {
      return false;
    }
  }
  return false;
}

function pickSupportedRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

const LEAD_SILENCE_SAMPLES = 4000;
const TAIL_SILENCE_SAMPLES = 5600;

async function prepareAudioForWhisper(
  blob: Blob
): Promise<{ silent: true } | { silent: false; pcm: Float32Array }> {
  const win = window as WindowWithAudioAndSpeech;
  const AudioCtx = window.AudioContext ?? win.webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("Web Audio API is unavailable in this browser.");
  }

  const audioCtx = new AudioCtx();
  try {
    const buffer = await blob.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(buffer);

    const targetLength = Math.max(1, Math.ceil(decoded.duration * 16000));
    const offlineCtx = new OfflineAudioContext(1, targetLength, 16000);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    const rawChannel = rendered.getChannelData(0);

    let peak = 0;
    for (let i = 0; i < rawChannel.length; i += 1) {
      const abs = Math.abs(rawChannel[i]);
      if (abs > peak) peak = abs;
    }

    if (peak < 0.008) {
      return { silent: true };
    }

    const gain = peak < 0.85 ? Math.min(4.0, 0.88 / peak) : 1;
    const padded = new Float32Array(
      LEAD_SILENCE_SAMPLES + rawChannel.length + TAIL_SILENCE_SAMPLES
    );

    for (let i = 0; i < rawChannel.length; i += 1) {
      padded[LEAD_SILENCE_SAMPLES + i] = Math.max(
        -1,
        Math.min(1, rawChannel[i] * gain)
      );
    }

    return { silent: false, pcm: padded };
  } finally {
    await audioCtx.close().catch(() => undefined);
  }
}

function cleanSpeechTranscript(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .trim()
    .replace(/[\s.,!?;:'"…]+$/u, "")
    .trim()
    .toLowerCase();
}

type TimeoutResult<T> = { timedOut: true } | { timedOut: false; value: T };

function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<TimeoutResult<T>> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      resolve({ timedOut: true });
    }, ms);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve({ timedOut: false, value });
      })
      .catch((error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

const emptySubscribe = () => () => {};

export interface StartListeningOptions {
  pushToTalk?: boolean;
  keyLabel?: string;
}

export function useVoiceSearch(onTranscript: (cleanedTerm: string) => void) {
  const isSupported = useSyncExternalStore(
    emptySubscribe,
    () =>
      getSpeechRecognitionConstructor() !== null ||
      canSupportLocalVoiceEngine(),
    () => false
  );

  const engineState = useSyncExternalStore(
    subscribeLocalVoiceState,
    getLocalVoiceState,
    getServerLocalVoiceState
  );

  const [isListening, setIsListening] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  const attemptIdRef = useRef(0);
  const preferLocalWhisperRef = useRef(false);
  const pushToTalkActiveRef = useRef(false);
  const keyLabelRef = useRef("Space");
  const startingLocalRef = useRef(false);
  const releaseRequestedRef = useRef(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const monitorCtxRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<number | undefined>(undefined);
  const maxDurationTimerRef = useRef<number | undefined>(undefined);
  const tailStopTimerRef = useRef<number | undefined>(undefined);
  const discardOnStopRef = useRef(false);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const cleanupMediaResources = useCallback(() => {
    window.clearInterval(silenceTimerRef.current);
    window.clearTimeout(maxDurationTimerRef.current);
    window.clearTimeout(tailStopTimerRef.current);
    silenceTimerRef.current = undefined;
    maxDurationTimerRef.current = undefined;
    tailStopTimerRef.current = undefined;

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    if (monitorCtxRef.current) {
      void monitorCtxRef.current.close().catch(() => undefined);
      monitorCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      attemptIdRef.current += 1;
      discardOnStopRef.current = true;
      try {
        recognitionRef.current?.abort();
      } catch {
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
        }
      }
      cleanupMediaResources();
    };
  }, [cleanupMediaResources]);

  const stopAndCancel = useCallback(() => {
    attemptIdRef.current += 1;
    discardOnStopRef.current = true;
    pushToTalkActiveRef.current = false;
    startingLocalRef.current = false;
    releaseRequestedRef.current = false;
    cancelActiveTranscriptions();

    try {
      recognitionRef.current?.abort();
    } catch {
    }
    recognitionRef.current = null;

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
      }
    }
    mediaRecorderRef.current = null;

    cleanupMediaResources();
    setIsListening(false);
    setIsPushToTalk(false);
    setIsProcessing(false);
    setLocalStatus(null);
  }, [cleanupMediaResources]);

  const stopRecorderWithTail = useCallback(() => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state !== "recording"
    ) {
      return;
    }
    if (tailStopTimerRef.current !== undefined) {
      return;
    }

    discardOnStopRef.current = false;
    setLocalStatus("Capturing end of word...");
    tailStopTimerRef.current = window.setTimeout(() => {
      tailStopTimerRef.current = undefined;
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
    }, 220);
  }, []);

  const finishListening = useCallback(() => {
    pushToTalkActiveRef.current = false;
    setIsPushToTalk(false);

    if (startingLocalRef.current) {
      releaseRequestedRef.current = true;
      return;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      stopRecorderWithTail();
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
      }
    }
  }, [stopRecorderWithTail]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const startLocalWhisperRecording = useCallback(
    async (attemptId: number, pushToTalk: boolean) => {
      if (!canSupportLocalVoiceEngine()) {
        setIsPushToTalk(false);
        setErrorMessage(
          "Microphone recording is not supported in this browser."
        );
        return;
      }

      startingLocalRef.current = true;
      releaseRequestedRef.current = false;

      preloadLocalVoiceModel();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err: unknown) {
        startingLocalRef.current = false;
        if (attemptId !== attemptIdRef.current) return;
        setIsPushToTalk(false);
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setErrorMessage(
            "Microphone access was denied. Enable mic permissions to use voice search."
          );
        } else if (name === "NotFoundError") {
          setErrorMessage(
            "No microphone was found. Check your audio input device."
          );
        } else {
          setErrorMessage("Unable to access microphone on this device.");
        }
        return;
      }

      startingLocalRef.current = false;

      if (attemptId !== attemptIdRef.current || releaseRequestedRef.current) {
        releaseRequestedRef.current = false;
        for (const track of stream.getTracks()) track.stop();
        setIsListening(false);
        setIsPushToTalk(false);
        setLocalStatus(null);
        return;
      }

      mediaStreamRef.current = stream;
      discardOnStopRef.current = false;

      const mimeType = pickSupportedRecorderMimeType();
      const chunks: BlobPart[] = [];
      let recorder: MediaRecorder;
      try {
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch {
        recorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };

      recorder.onstop = () => {
        cleanupMediaResources();
        mediaRecorderRef.current = null;
        setIsListening(false);
        setIsPushToTalk(false);

        if (discardOnStopRef.current || attemptId !== attemptIdRef.current) {
          return;
        }

        const recordedBlob = new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });

        if (recordedBlob.size < 400) {
          setLocalStatus(null);
          setErrorMessage(
            `No speech detected. Hold ${keyLabelRef.current} or tap mic and speak.`
          );
          return;
        }

        setIsProcessing(true);
        setLocalStatus("Preparing audio...");

        void (async () => {
          try {
            const prepared = await prepareAudioForWhisper(recordedBlob);
            if (attemptId !== attemptIdRef.current) return;

            if (prepared.silent) {
              setIsProcessing(false);
              setLocalStatus(null);
              setErrorMessage(
                `No speech detected. Hold ${keyLabelRef.current} or tap mic and speak clearly.`
              );
              return;
            }

            setLocalStatus(
              getLocalVoiceState().ready
                ? "Transcribing locally on-device..."
                : getLocalVoiceState().cached
                  ? "Warming up cached voice engine..."
                  : "Loading local AI voice engine..."
            );

            const text = await transcribeLocalAudio(prepared.pcm);
            if (attemptId !== attemptIdRef.current) return;

            setIsProcessing(false);
            setLocalStatus(null);

            const cleaned = cleanSpeechTranscript(text);
            if (cleaned) {
              onTranscriptRef.current(cleaned);
            } else {
              setErrorMessage(
                "Could not hear a clear word. Try speaking clearly."
              );
            }
          } catch (error: unknown) {
            if (attemptId !== attemptIdRef.current) return;
            setIsProcessing(false);
            setLocalStatus(null);
            if (error instanceof Error && error.message === "CANCELLED") {
              return;
            }
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Local speech recognition failed."
            );
          }
        })();
      };

      if (!pushToTalk) {
        try {
          const win = window as WindowWithAudioAndSpeech;
          const AudioCtx = window.AudioContext ?? win.webkitAudioContext;
          if (AudioCtx) {
            const monitorCtx = new AudioCtx();
            monitorCtxRef.current = monitorCtx;
            const source = monitorCtx.createMediaStreamSource(stream);
            const analyser = monitorCtx.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);

            const samples = new Float32Array(analyser.fftSize);
            const startedAt = Date.now();
            let hasSpoken = false;
            let lastLoudAt = startedAt;

            silenceTimerRef.current = window.setInterval(() => {
              if (recorder.state !== "recording") return;
              analyser.getFloatTimeDomainData(samples);
              let sum = 0;
              for (let i = 0; i < samples.length; i += 1) {
                sum += samples[i] * samples[i];
              }
              const rms = Math.sqrt(sum / samples.length);
              const now = Date.now();

              if (now - startedAt > 250 && rms > 0.018) {
                hasSpoken = true;
                lastLoudAt = now;
              } else if (hasSpoken && now - lastLoudAt > 1150) {
                stopRecorderWithTail();
              }
            }, 80);
          }
        } catch {
        }
      }

      maxDurationTimerRef.current = window.setTimeout(
        () => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        },
        pushToTalk ? 12000 : 6500
      );

      recorder.start(100);
      setIsListening(true);
      setLocalStatus(
        pushToTalk
          ? `Listening... release ${keyLabelRef.current} to search`
          : "Listening... speak a word (tap mic to finish)"
      );
    },
    [cleanupMediaResources, stopRecorderWithTail]
  );

  const startNativeSpeech = useCallback(
    (
      Recognition: SpeechRecognitionConstructor,
      forceLocal: boolean,
      attemptId: number,
      pushToTalk: boolean
    ) => {
      if (attemptId !== attemptIdRef.current) return;
      if (pushToTalk && releaseRequestedRef.current) {
        releaseRequestedRef.current = false;
        setIsPushToTalk(false);
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
        }
        recognitionRef.current = null;
      }

      try {
        const recognition = new Recognition();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = pushToTalk;
        if (forceLocal) {
          recognition.processLocally = true;
        }

        recognition.onstart = () => {
          if (attemptId !== attemptIdRef.current) return;
          setLocalStatus(
            pushToTalk
              ? `Listening... release ${keyLabelRef.current} to search`
              : null
          );
          setIsListening(true);
        };

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          if (attemptId !== attemptIdRef.current) return;
          let fullTranscript = "";
          const startIdx = event.resultIndex ?? 0;
          for (let i = startIdx; i < event.results.length; i += 1) {
            const chunk = event.results[i]?.[0]?.transcript ?? "";
            if (chunk) {
              fullTranscript = `${fullTranscript} ${chunk}`.trim();
            }
          }
          const cleaned = cleanSpeechTranscript(fullTranscript);
          if (cleaned) {
            onTranscriptRef.current(cleaned);
          } else {
            setErrorMessage("Could not hear a clear word. Try speaking again.");
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          if (attemptId !== attemptIdRef.current) return;
          setIsListening(false);
          setIsPushToTalk(false);
          setLocalStatus(null);

          if (event.error === "aborted") {
            return;
          }

          if (event.error === "not-allowed") {
            setErrorMessage(
              "Microphone access was denied. Enable mic permissions to use voice search."
            );
            return;
          }

          if (event.error === "no-speech") {
            setErrorMessage(
              `No speech detected. Hold ${keyLabelRef.current} or tap mic and speak.`
            );
            return;
          }

          if (event.error === "audio-capture") {
            setErrorMessage(
              "No microphone was found. Check your audio input device."
            );
            return;
          }

          if (
            event.error === "network" ||
            event.error === "service-not-allowed" ||
            event.error === "language-not-supported"
          ) {
            if (canSupportLocalVoiceEngine()) {
              preferLocalWhisperRef.current = true;
              const stillHeld = pushToTalkActiveRef.current;
              setIsPushToTalk(stillHeld);
              void startLocalWhisperRecording(attemptId, stillHeld);
              return;
            }
            setErrorMessage(
              "Voice recognition is unavailable in this browser. Try typing to search."
            );
            return;
          }

          setErrorMessage(`Voice recognition error (${event.error}).`);
        };

        recognition.onend = () => {
          if (attemptId !== attemptIdRef.current) return;
          setIsListening(false);
          setIsPushToTalk(false);
          setLocalStatus(null);
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch {
        if (canSupportLocalVoiceEngine()) {
          preferLocalWhisperRef.current = true;
          const stillHeld = pushToTalkActiveRef.current;
          setIsPushToTalk(stillHeld);
          void startLocalWhisperRecording(attemptId, stillHeld);
        } else {
          setIsListening(false);
          setIsPushToTalk(false);
          setErrorMessage("Unable to start voice search in this browser.");
        }
      }
    },
    [startLocalWhisperRecording]
  );

  const startListening = useCallback(
    (options?: StartListeningOptions) => {
      const pushToTalk = Boolean(options?.pushToTalk);

      if (typeof window !== "undefined" && !window.isSecureContext) {
        setErrorMessage("Voice search requires localhost or HTTPS.");
        return;
      }

      if (
        !pushToTalk &&
        isListening &&
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        stopRecorderWithTail();
        return;
      }

      if (isListening || isProcessing) {
        if (pushToTalk) return;
        stopAndCancel();
        return;
      }

      setErrorMessage(null);
      attemptIdRef.current += 1;
      const currentAttemptId = attemptIdRef.current;
      pushToTalkActiveRef.current = pushToTalk;
      keyLabelRef.current = options?.keyLabel || "Space";
      releaseRequestedRef.current = false;
      setIsPushToTalk(pushToTalk);

      const Recognition = getSpeechRecognitionConstructor();
      const localState = getLocalVoiceState();

      if (
        localState.ready ||
        !Recognition ||
        preferLocalWhisperRef.current
      ) {
        void startLocalWhisperRecording(currentAttemptId, pushToTalk);
        return;
      }

      void (async () => {
        const isBrave = await detectIsBrave();
        if (currentAttemptId !== attemptIdRef.current) return;
        if (pushToTalk && !pushToTalkActiveRef.current) {
          setIsPushToTalk(false);
          return;
        }

        if (isBrave && canSupportLocalVoiceEngine()) {
          preferLocalWhisperRef.current = true;
          void startLocalWhisperRecording(currentAttemptId, pushToTalk);
          return;
        }

        if (typeof Recognition.available === "function") {
          try {
            const availRes = await withTimeout(
              Recognition.available({
                langs: ["en-US"],
                processLocally: true,
              }),
              800
            );

            if (currentAttemptId !== attemptIdRef.current) return;

            if (!availRes.timedOut && availRes.value === "available") {
              startNativeSpeech(Recognition, true, currentAttemptId, pushToTalk);
              return;
            }
          } catch {
          }
        }

        startNativeSpeech(Recognition, false, currentAttemptId, pushToTalk);
      })();
    },
    [
      isListening,
      isProcessing,
      startLocalWhisperRecording,
      startNativeSpeech,
      stopAndCancel,
      stopRecorderWithTail,
    ]
  );

  const downloadProgress =
    (isListening || isProcessing) &&
    !engineState.cached &&
    engineState.downloadProgress !== null
      ? engineState.downloadProgress
      : null;

  const statusMessage =
    localStatus ??
    (isProcessing && engineState.cached && !engineState.ready
      ? "Warming up cached voice engine..."
      : null);

  return {
    isSupported,
    isListening,
    isPushToTalk,
    isProcessing,
    downloadProgress,
    statusMessage,
    errorMessage,
    startListening,
    finishListening,
    stopListening: stopAndCancel,
    clearError,
  };
}
