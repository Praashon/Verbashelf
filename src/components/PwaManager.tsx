"use client";

import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { registerServiceWorker, usePwaStatus } from "@/lib/pwa";

export function PwaManager() {
  const { isOnline } = usePwaStatus();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-500/30 bg-amber-500/12 px-3 py-2 text-center text-xs font-medium text-amber-900 dark:text-amber-200"
    >
      <span className="inline-flex items-center gap-2">
        <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
        <span>
          Offline mode: Vault, Study, voice AI &amp; saved words work locally.
        </span>
      </span>
    </div>
  );
}
