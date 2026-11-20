"use client";

export interface SpeakWordOptions {
  word: string;
  audioUrl?: string | null;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

export type PronunciationChannel = "audio" | "speech" | "unavailable";

const DICTIONARY_AUDIO_PREFIX = "https://api.dictionaryapi.dev/media/pronunciations/";
const AUDIO_LOAD_TIMEOUT_MS = 2500;
const SPEECH_SAFETY_TIMEOUT_MS = 5000;

const failedAudioUrls = new Set<string>();
let brokenDictAudioCount = 0;

let activeAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let safetyTimer: number | null = null;
let playbackToken = 0;

function clearSafetyTimer(): void {
  if (safetyTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(safetyTimer);
  }
  safetyTimer = null;
}

export function stopPronunciation(): void {
  playbackToken += 1;
  clearSafetyTimer();

  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.oncanplaythrough = null;
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio = null;
  }

  activeUtterance = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
    }
  }
}

function isHttpAudioUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed);
}

function shouldSkipAudioUrl(url: string): boolean {
  if (failedAudioUrls.has(url)) {
    return true;
  }
  if (
    brokenDictAudioCount >= 2 &&
    url.startsWith(DICTIONARY_AUDIO_PREFIX)
  ) {
    return true;
  }
  return false;
}

function markAudioUrlFailed(url: string): void {
  if (!failedAudioUrls.has(url)) {
    failedAudioUrls.add(url);
    if (url.startsWith(DICTIONARY_AUDIO_PREFIX)) {
      brokenDictAudioCount += 1;
    }
  }
}

function pickPreferredEnglishVoice(
  synth: SpeechSynthesis
): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (voices.length === 0) return null;

  const englishVoices = voices.filter((voice) =>
    /^en(?:[-_]|$)/i.test(voice.lang)
  );
  if (englishVoices.length === 0) return null;

  const scoreVoice = (voice: SpeechSynthesisVoice): number => {
    let score = 0;
    const lang = voice.lang.toLowerCase();
    const name = voice.name.toLowerCase();
    if (lang === "en-us" || lang === "en_us") score += 4;
    else if (lang === "en-gb" || lang === "en_gb") score += 3;
    if (
      name.includes("natural") ||
      name.includes("google") ||
      name.includes("microsoft") ||
      name.includes("samantha") ||
      name.includes("daniel")
    ) {
      score += 3;
    }
    if (voice.localService) score += 1;
    if (voice.default) score += 1;
    return score;
  };

  let best = englishVoices[0];
  let bestScore = scoreVoice(best);
  for (let i = 1; i < englishVoices.length; i += 1) {
    const candidate = englishVoices[i];
    const score = scoreVoice(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function tryPlayAudioUrl(
  url: string,
  token: number,
  onStart?: () => void,
  onEnd?: () => void
): Promise<"played" | "failed"> {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return Promise.resolve("failed");
  }

  return new Promise<"played" | "failed">((resolve) => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = url;
    activeAudio = audio;

    let settled = false;
    let started = false;
    let loadTimer: number | null = window.setTimeout(() => {
      if (!started) {
        markAudioUrlFailed(url);
        finish("failed");
      }
    }, AUDIO_LOAD_TIMEOUT_MS);

    const clearLoadTimer = () => {
      if (loadTimer !== null) {
        window.clearTimeout(loadTimer);
        loadTimer = null;
      }
    };

    const finish = (outcome: "played" | "failed") => {
      if (settled) return;
      settled = true;
      clearLoadTimer();
      audio.onended = null;
      audio.onerror = null;
      audio.oncanplaythrough = null;
      if (activeAudio === audio) {
        activeAudio = null;
      }
      if (outcome === "failed") {
        audio.pause();
        audio.removeAttribute("src");
      } else if (started && token === playbackToken) {
        onEnd?.();
      }
      resolve(outcome);
    };

    audio.onerror = () => {
      markAudioUrlFailed(url);
      finish("failed");
    };

    audio.onended = () => {
      finish("played");
    };

    void audio
      .play()
      .then(() => {
        if (token !== playbackToken) {
          finish("failed");
          return;
        }
        clearLoadTimer();
        started = true;
        onStart?.();
      })
      .catch(() => {
        markAudioUrlFailed(url);
        finish("failed");
      });
  });
}

function speakWithSpeechSynthesis(
  word: string,
  rate: number,
  token: number,
  onStart?: () => void,
  onEnd?: () => void
): Promise<"speech" | "unavailable"> {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    return Promise.resolve("unavailable");
  }

  const synth = window.speechSynthesis;
  try {
    synth.cancel();
  } catch {
  }

  return new Promise<"speech" | "unavailable">((resolve) => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = rate;

    const preferredVoice = pickPreferredEnglishVoice(synth);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    activeUtterance = utterance;
    let settled = false;
    let started = false;

    const finish = (channel: "speech" | "unavailable") => {
      if (settled) return;
      settled = true;
      clearSafetyTimer();
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
      if (activeUtterance === utterance) {
        activeUtterance = null;
      }
      if (token === playbackToken) {
        onEnd?.();
      }
      resolve(channel);
    };

    const notifyStart = () => {
      if (!started && token === playbackToken) {
        started = true;
        onStart?.();
      }
    };

    utterance.onstart = () => {
      notifyStart();
    };

    utterance.onend = () => {
      finish("speech");
    };

    utterance.onerror = () => {
      finish("speech");
    };

    clearSafetyTimer();
    safetyTimer = window.setTimeout(() => {
      finish("speech");
    }, SPEECH_SAFETY_TIMEOUT_MS);

    try {
      notifyStart();
      synth.speak(utterance);
    } catch {
      finish("unavailable");
    }
  });
}

export async function speakWord({
  word,
  audioUrl,
  rate = 0.94,
  onStart,
  onEnd,
}: SpeakWordOptions): Promise<PronunciationChannel> {
  const cleanWord = word.trim();
  if (!cleanWord) {
    return "unavailable";
  }

  stopPronunciation();
  const token = playbackToken;

  if (isHttpAudioUrl(audioUrl) && !shouldSkipAudioUrl(audioUrl.trim())) {
    const audioOutcome = await tryPlayAudioUrl(
      audioUrl.trim(),
      token,
      onStart,
      onEnd
    );
    if (token !== playbackToken) {
      return "audio";
    }
    if (audioOutcome === "played") {
      return "audio";
    }
  }

  if (token !== playbackToken) {
    return "unavailable";
  }

  return speakWithSpeechSynthesis(cleanWord, rate, token, onStart, onEnd);
}
