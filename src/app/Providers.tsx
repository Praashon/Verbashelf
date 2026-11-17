"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CheckCircle2, Info, AlertCircle } from "lucide-react";
import { ensureInitialSeed } from "@/lib/db";
import {
  preloadLocalVoiceModel,
  shouldAutoPreloadLocalVoice,
} from "@/lib/localVoiceEngine";
import { VaultProvider } from "@/hooks/useVault";
import { ProfileModal } from "@/components/ProfileModal";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { ShareModal } from "@/components/ShareModal";
import { OnboardingDemo } from "@/components/OnboardingDemo";

export type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "verbashelf-theme";
const ACTIVE_TOPIC_STORAGE_KEY = "verbashelf-active-topic";
const ONBOARDING_STORAGE_KEY = "verbashelf-onboarding-v1";

const themeListeners = new Set<() => void>();

function subscribeTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

function getThemeSnapshot(): ThemeMode {
  if (typeof document === "undefined") {
    return "light";
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerThemeSnapshot(): ThemeMode {
  return "light";
}

function applyThemeToDom(next: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
  }
  themeListeners.forEach((listener) => listener());
}

const activeTopicListeners = new Set<() => void>();

function subscribeActiveTopic(listener: () => void): () => void {
  activeTopicListeners.add(listener);
  return () => {
    activeTopicListeners.delete(listener);
  };
}

function getStoredTopicId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_TOPIC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function getServerStoredTopicId(): number | null {
  return null;
}

function writeStoredTopicId(id: number): void {
  try {
    localStorage.setItem(ACTIVE_TOPIC_STORAGE_KEY, String(id));
  } catch {
  }
  activeTopicListeners.forEach((listener) => listener());
}

const onboardingListeners = new Set<() => void>();

function subscribeOnboarding(listener: () => void): () => void {
  onboardingListeners.add(listener);
  return () => {
    onboardingListeners.delete(listener);
  };
}

function getOnboardingDoneSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "done";
  } catch {
    return true;
  }
}

function getServerOnboardingDoneSnapshot(): boolean {
  return true;
}

function markOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
  } catch {
  }
  onboardingListeners.forEach((listener) => listener());
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
  action?: ToastAction;
}

interface AppUIContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  storedTopicId: number | null;
  setActiveTopicId: (topicId: number) => void;
  isProfileOpen: boolean;
  setIsProfileOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isShareOpen: boolean;
  setIsShareOpen: (open: boolean) => void;
  isOnboardingOpen: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  showToast: (
    message: string,
    tone?: "info" | "success" | "error",
    action?: ToastAction
  ) => void;
}

const AppUIContext = createContext<AppUIContextValue | null>(null);

export function useAppUI(): AppUIContextValue {
  const ctx = useContext(AppUIContext);
  if (!ctx) {
    throw new Error("useAppUI must be used within Providers.");
  }
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const storedTopicId = useSyncExternalStore(
    subscribeActiveTopic,
    getStoredTopicId,
    getServerStoredTopicId
  );

  const hasSeenOnboarding = useSyncExternalStore(
    subscribeOnboarding,
    getOnboardingDoneSnapshot,
    getServerOnboardingDoneSnapshot
  );

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [forceOnboardingOpen, setForceOnboardingOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const isOnboardingOpen = !hasSeenOnboarding || forceOnboardingOpen;

  useEffect(() => {
    void ensureInitialSeed();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (shouldAutoPreloadLocalVoice()) {
        preloadLocalVoiceModel();
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hasSeenOnboarding) return;
    const handleUnload = () => {
      markOnboardingDone();
    };
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [hasSeenOnboarding]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const setTheme = useCallback((next: ThemeMode) => {
    applyThemeToDom(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const current = getThemeSnapshot();
    applyThemeToDom(current === "light" ? "dark" : "light");
  }, []);

  const setActiveTopicId = useCallback((topicId: number) => {
    writeStoredTopicId(topicId);
  }, []);

  const openOnboarding = useCallback(() => {
    setForceOnboardingOpen(true);
  }, []);

  const closeOnboarding = useCallback(() => {
    markOnboardingDone();
    setForceOnboardingOpen(false);
  }, []);

  const showToast = useCallback(
    (
      message: string,
      tone: "info" | "success" | "error" = "info",
      action?: ToastAction
    ) => {
      setToast({ id: Date.now(), message, tone, action });
    },
    []
  );

  const value = useMemo<AppUIContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      storedTopicId,
      setActiveTopicId,
      isProfileOpen,
      setIsProfileOpen,
      isSettingsOpen,
      setIsSettingsOpen,
      isShareOpen,
      setIsShareOpen,
      isOnboardingOpen,
      openOnboarding,
      closeOnboarding,
      showToast,
    }),
    [
      theme,
      setTheme,
      toggleTheme,
      storedTopicId,
      setActiveTopicId,
      isProfileOpen,
      isSettingsOpen,
      isShareOpen,
      isOnboardingOpen,
      openOnboarding,
      closeOnboarding,
      showToast,
    ]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppUIContext.Provider value={value}>
        <VaultProvider>
          {children}
          <ProfileModal />
          <SettingsDrawer />
          <ShareModal />
          <OnboardingDemo />
          {toast ? (
            <div
              role="status"
              aria-live="polite"
              className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 rounded-2xl border border-border bg-card-solid/95 px-4 py-3 text-sm font-medium text-foreground shadow-xl backdrop-blur-md animate-word-drop"
            >
              {toast.tone === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : toast.tone === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              ) : (
                <Info className="h-4 w-4 shrink-0 text-primary" />
              )}
              <span>{toast.message}</span>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    setToast(null);
                  }}
                  className="ml-1 shrink-0 cursor-pointer rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
          ) : null}
        </VaultProvider>
      </AppUIContext.Provider>
    </QueryClientProvider>
  );
}
