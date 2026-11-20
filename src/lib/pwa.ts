"use client";

import { useSyncExternalStore } from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

export interface PwaStateSnapshot {
  isOnline: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  isIos: boolean;
  swReady: boolean;
}

const SERVER_PWA_SNAPSHOT: PwaStateSnapshot = {
  isOnline: true,
  isStandalone: false,
  canInstall: false,
  isIos: false,
  swReady: false,
};

let currentSnapshot: PwaStateSnapshot = { ...SERVER_PWA_SNAPSHOT };
let initializedClientListeners = false;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let swRegistrationRequested = false;

const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function updateSnapshot(patch: Partial<PwaStateSnapshot>): void {
  const next: PwaStateSnapshot = {
    ...currentSnapshot,
    ...patch,
  };
  if (
    next.isOnline === currentSnapshot.isOnline &&
    next.isStandalone === currentSnapshot.isStandalone &&
    next.canInstall === currentSnapshot.canInstall &&
    next.isIos === currentSnapshot.isIos &&
    next.swReady === currentSnapshot.swReady
  ) {
    return;
  }
  currentSnapshot = next;
  notifyListeners();
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(nav.standalone)
  );
}

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !("MSStream" in window)
  );
}

function ensureClientListeners(): void {
  if (typeof window === "undefined" || initializedClientListeners) {
    return;
  }
  initializedClientListeners = true;

  currentSnapshot = {
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isStandalone: detectStandalone(),
    canInstall: deferredPrompt !== null,
    isIos: detectIos(),
    swReady: currentSnapshot.swReady,
  };

  window.addEventListener("online", () => updateSnapshot({ isOnline: true }));
  window.addEventListener("offline", () => updateSnapshot({ isOnline: false }));

  window.addEventListener("beforeinstallprompt", (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    updateSnapshot({ canInstall: true });
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    updateSnapshot({ canInstall: false, isStandalone: true });
  });

  const mediaQuery = window.matchMedia("(display-mode: standalone)");
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", () => {
      updateSnapshot({ isStandalone: detectStandalone() });
    });
  }
}

export function subscribePwaState(listener: () => void): () => void {
  ensureClientListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPwaSnapshot(): PwaStateSnapshot {
  ensureClientListeners();
  return currentSnapshot;
}

export function getServerPwaSnapshot(): PwaStateSnapshot {
  return SERVER_PWA_SNAPSHOT;
}

export function usePwaStatus(): PwaStateSnapshot {
  return useSyncExternalStore(
    subscribePwaState,
    getPwaSnapshot,
    getServerPwaSnapshot
  );
}

export function registerServiceWorker(): void {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    swRegistrationRequested
  ) {
    return;
  }

  if (!window.isSecureContext) {
    return;
  }

  swRegistrationRequested = true;
  void navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then(() => {
      updateSnapshot({ swReady: true });
    })
    .catch(() => {
      swRegistrationRequested = false;
    });
}

export async function triggerPwaInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  if (!deferredPrompt) {
    return "unavailable";
  }

  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  updateSnapshot({ canInstall: false });

  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  if (choice.outcome === "accepted") {
    updateSnapshot({ isStandalone: true });
  }
  return choice.outcome;
}
