"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Mic,
  Play,
  RotateCcw,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { speakWord, stopPronunciation } from "@/lib/pronunciation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PronunciationPracticeProps {
  word: string;
  audioUrl?: string | null;
  phonetic?: string | null;
  onClose?: () => void;
}

const LIVE_BAR_COUNT = 16;
const WAVEFORM_BAR_COUNT = 32;
const MAX_RECORDING_MS = 6000;

const EMPTY_LIVE_BARS = Array.from({ length: LIVE_BAR_COUNT }, () => 0.14);
const DEFAULT_RECORDED_BARS = Array.from(
  { length: WAVEFORM_BAR_COUNT },
  (_, idx) => 0.25 + ((idx * 7) % 5) * 0.12
);

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

async function computeWaveformPeaks(blob: Blob): Promise<number[]> {
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioCtx) {
    return DEFAULT_RECORDED_BARS;
  }

  const ctx = new AudioCtx();
  try {
    const buffer = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(buffer);
    const channel = decoded.getChannelData(0);
    if (channel.length === 0) return DEFAULT_RECORDED_BARS;

    const bucketSize = Math.max(1, Math.floor(channel.length / WAVEFORM_BAR_COUNT));
    const rawPeaks: number[] = [];
    let maxPeak = 0.01;

    for (let i = 0; i < WAVEFORM_BAR_COUNT; i += 1) {
      const start = i * bucketSize;
      const end = Math.min(channel.length, start + bucketSize);
      let peak = 0;
      for (let j = start; j < end; j += 1) {
        const val = Math.abs(channel[j]);
        if (val > peak) peak = val;
      }
      if (peak > maxPeak) maxPeak = peak;
      rawPeaks.push(peak);
    }

    return rawPeaks.map((p) => Math.max(0.14, Math.min(1, p / maxPeak)));
  } catch {
    return DEFAULT_RECORDED_BARS;
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

export function PronunciationPractice({
  word,
  audioUrl,
  phonetic,
  onClose,
}: PronunciationPracticeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [liveBars, setLiveBars] = useState<number[]>(EMPTY_LIVE_BARS);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedBars, setRecordedBars] = useState<number[]>([]);
  const [activePlayer, setActivePlayer] = useState<
    "model" | "mine" | "compare" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const compareTimerRef = useRef<number | null>(null);
  const mineAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const compareTokenRef = useRef(0);

  const cleanupRecordingResources = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, []);

  const stopAllPlayback = useCallback(() => {
    compareTokenRef.current += 1;
    if (compareTimerRef.current !== null) {
      window.clearTimeout(compareTimerRef.current);
      compareTimerRef.current = null;
    }
    stopPronunciation();
    if (mineAudioRef.current) {
      mineAudioRef.current.onended = null;
      mineAudioRef.current.onerror = null;
      mineAudioRef.current.pause();
      mineAudioRef.current = null;
    }
    if (mountedRef.current) {
      setActivePlayer(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopAllPlayback();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
        }
      }
      cleanupRecordingResources();
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
        recordedUrlRef.current = null;
      }
    };
  }, [cleanupRecordingResources, stopAllPlayback]);

  const handleStopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      try {
        recorderRef.current.stop();
      } catch {
      }
    }
  }, []);

  const handleStartRecording = async () => {
    stopAllPlayback();
    setError(null);

    if (
      typeof window === "undefined" ||
      !window.isSecureContext ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Microphone recording requires HTTPS or localhost in a supported browser."
      );
      return;
    }

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
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError(
          "Microphone permission was denied. Allow mic access to record yourself."
        );
      } else {
        setError("Unable to access microphone on this device.");
      }
      return;
    }

    if (!mountedRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    streamRef.current = stream;
    const mimeType = pickRecorderMimeType();
    const chunks: BlobPart[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (ev: BlobEvent) => {
      if (ev.data.size > 0) {
        chunks.push(ev.data);
      }
    };

    recorder.onstop = () => {
      cleanupRecordingResources();
      recorderRef.current = null;
      if (!mountedRef.current) return;
      setIsRecording(false);
      setLiveBars(EMPTY_LIVE_BARS);

      const blob = new Blob(chunks, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      if (blob.size < 300) {
        setError("No audio captured. Hold closer to your mic and try again.");
        return;
      }

      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
      }
      const nextUrl = URL.createObjectURL(blob);
      recordedUrlRef.current = nextUrl;
      setRecordedUrl(nextUrl);

      void computeWaveformPeaks(blob).then((peaks) => {
        if (mountedRef.current) {
          setRecordedBars(peaks);
        }
      });
    };

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        let lastFrameAt = 0;

        const tick = (now: number) => {
          if (!mountedRef.current || recorder.state !== "recording") return;
          if (now - lastFrameAt >= 55) {
            lastFrameAt = now;
            analyser.getByteFrequencyData(freqData);
            const nextBars: number[] = [];
            for (let i = 0; i < LIVE_BAR_COUNT; i += 1) {
              const sample = freqData[i % freqData.length] ?? 0;
              nextBars.push(Math.max(0.14, Math.min(1, sample / 180)));
            }
            setLiveBars(nextBars);
          }
          rafRef.current = window.requestAnimationFrame(tick);
        };
        rafRef.current = window.requestAnimationFrame(tick);
      }
    } catch {
    }

    maxTimerRef.current = window.setTimeout(() => {
      handleStopRecording();
    }, MAX_RECORDING_MS);

    recorder.start(100);
    setIsRecording(true);
  };

  const handlePlayModel = () => {
    if (activePlayer === "model") {
      stopAllPlayback();
      return;
    }
    stopAllPlayback();
    void speakWord({
      word,
      audioUrl,
      onStart: () => {
        if (mountedRef.current) setActivePlayer("model");
      },
      onEnd: () => {
        if (mountedRef.current) setActivePlayer(null);
      },
    });
  };

  const playRecordedClip = (onEnded?: () => void) => {
    if (!recordedUrl) return;
    const audio = new Audio(recordedUrl);
    mineAudioRef.current = audio;
    audio.onended = () => {
      if (mineAudioRef.current === audio) {
        mineAudioRef.current = null;
      }
      onEnded?.();
    };
    audio.onerror = () => {
      if (mineAudioRef.current === audio) {
        mineAudioRef.current = null;
      }
      onEnded?.();
    };
    void audio.play().catch(() => {
      onEnded?.();
    });
  };

  const handlePlayMine = () => {
    if (!recordedUrl) return;
    if (activePlayer === "mine") {
      stopAllPlayback();
      return;
    }
    stopAllPlayback();
    setActivePlayer("mine");
    playRecordedClip(() => {
      if (mountedRef.current) setActivePlayer(null);
    });
  };

  const handleCompare = () => {
    if (!recordedUrl) return;
    if (activePlayer === "compare") {
      stopAllPlayback();
      return;
    }
    stopAllPlayback();
    const token = ++compareTokenRef.current;
    setActivePlayer("compare");

    void speakWord({
      word,
      audioUrl,
      onEnd: () => {
        if (!mountedRef.current || token !== compareTokenRef.current) return;
        compareTimerRef.current = window.setTimeout(() => {
          if (!mountedRef.current || token !== compareTokenRef.current) return;
          playRecordedClip(() => {
            if (mountedRef.current && token === compareTokenRef.current) {
              setActivePlayer(null);
            }
          });
        }, 350);
      },
    });
  };

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-primary/25 bg-primary/6 p-3.5 text-xs backdrop-blur-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            Pronunciation Practice: <span className="capitalize">{word}</span>
            {phonetic ? (
              <span className="ml-2 font-mono font-normal text-muted-foreground">
                {phonetic}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Listen to the model voice, record yourself locally, and compare side by side.
          </p>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pronunciation practice"
            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={activePlayer === "model" ? "primary" : "outline"}
          size="sm"
          onClick={handlePlayModel}
        >
          <Volume2 className="h-3.5 w-3.5" />
          <span>{activePlayer === "model" ? "Playing Model" : "Play Model"}</span>
        </Button>

        {isRecording ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleStopRecording}
          >
            <Square className="h-3.5 w-3.5" />
            <span>Stop Recording</span>
          </Button>
        ) : (
          <Button
            variant={recordedUrl ? "outline" : "primary"}
            size="sm"
            onClick={() => void handleStartRecording()}
          >
            {recordedUrl ? (
              <RotateCcw className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
            <span>{recordedUrl ? "Record Again" : "Record Yourself"}</span>
          </Button>
        )}

        {recordedUrl && !isRecording ? (
          <>
            <Button
              variant={activePlayer === "mine" ? "primary" : "outline"}
              size="sm"
              onClick={handlePlayMine}
            >
              <Play className="h-3.5 w-3.5" />
              <span>{activePlayer === "mine" ? "Playing Mine" : "Play Mine"}</span>
            </Button>

            <Button
              variant={activePlayer === "compare" ? "primary" : "secondary"}
              size="sm"
              onClick={handleCompare}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>
                {activePlayer === "compare"
                  ? "Comparing..."
                  : "Compare (Model -> Mine)"}
              </span>
            </Button>
          </>
        ) : null}
      </div>

      {isRecording ? (
        <div
          aria-label="Live microphone volume bars"
          className="flex h-10 items-end justify-center gap-1 rounded-xl border border-primary/30 bg-background/80 px-3 py-2"
        >
          {liveBars.map((level, idx) => (
            <span
              key={idx}
              className="w-1.5 rounded-full bg-primary transition-all duration-75"
              style={{ height: `${Math.round(level * 24)}px` }}
            />
          ))}
        </div>
      ) : recordedUrl ? (
        <div
          aria-label="Your recorded pronunciation waveform"
          className="flex h-11 items-center gap-1 rounded-xl border border-border/80 bg-background/75 px-3 py-2"
        >
          <span className="mr-2 shrink-0 text-[11px] font-medium text-muted-foreground">
            Your take
          </span>
          <div className="flex flex-1 items-center justify-between gap-0.5">
            {recordedBars.map((level, idx) => (
              <span
                key={idx}
                className={cn(
                  "flex-1 rounded-full transition-colors",
                  activePlayer === "mine" || activePlayer === "compare"
                    ? "bg-primary"
                    : "bg-primary/45"
                )}
                style={{ height: `${Math.round(level * 24)}px` }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
