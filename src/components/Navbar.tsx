"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  HelpCircle,
  Library,
  Moon,
  Search,
  Settings,
  Share2,
  Sun,
} from "lucide-react";
import { useAppUI } from "@/app/Providers";
import { useVault } from "@/hooks/useVault";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    theme,
    toggleTheme,
    setIsProfileOpen,
    setIsSettingsOpen,
    setIsShareOpen,
    openOnboarding,
  } = useAppUI();
  const { words, dueWords, profile } = useVault();

  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/vault");
    router.prefetch("/study");
  }, [router]);

  const initials = (profile.displayName || "R")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-white/80 backdrop-blur-xl transition-colors dark:bg-black/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link
            href="/"
            prefetch={true}
            className="flex shrink-0 items-center transition-opacity hover:opacity-85"
          >
            <BrandLogo />
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden sm:flex items-center gap-1 rounded-full border border-border/70 bg-muted/70 p-1"
          >
            <Link
              href="/"
              prefetch={true}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                pathname === "/"
                  ? "bg-card-solid text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Lookup</span>
            </Link>
            <Link
              href="/vault"
              prefetch={true}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                pathname.startsWith("/vault")
                  ? "bg-card-solid text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Library className="h-3.5 w-3.5" />
              <span>Vault</span>
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                {words.length}
              </span>
            </Link>
            <Link
              href="/study"
              prefetch={true}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                pathname.startsWith("/study")
                  ? "bg-card-solid text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Study</span>
              {dueWords.length > 0 ? (
                <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#5227cc] dark:text-violet-300">
                  {dueWords.length}
                </span>
              ) : null}
            </Link>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={openOnboarding}
            aria-label="Open interactive live guide"
            title="Interactive Live Guide"
            className="h-8 w-8 border border-border/60 bg-card-solid/70 sm:h-9 sm:w-9"
          >
            <HelpCircle className="h-4 w-4 text-primary" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              theme === "light" ? "Switch to dark theme" : "Switch to light theme"
            }
            title={
              theme === "light" ? "Switch to Dark theme" : "Switch to Light theme"
            }
            className="h-8 w-8 border border-border/60 bg-card-solid/70 sm:h-9 sm:w-9"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4 text-slate-700" />
            ) : (
              <Sun className="h-4 w-4 text-amber-400" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsShareOpen(true)}
            aria-label="Share vocabulary"
            className="h-8 w-8 rounded-full bg-card-solid/70 px-0 sm:h-8 sm:w-auto sm:px-3"
          >
            <Share2 className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
            title="Settings & Backup"
            className="h-8 w-8 border border-border/60 bg-card-solid/70 sm:h-9 sm:w-9"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            title="Edit profile"
            className="flex cursor-pointer items-center gap-2 rounded-full border border-border/70 bg-card-solid/80 p-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted/80 sm:py-1 sm:pl-1 sm:pr-2.5"
          >
            {profile.avatarDataUrl ? (
              <Image
                src={profile.avatarDataUrl}
                alt={profile.displayName}
                width={28}
                height={28}
                unoptimized
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                {initials}
              </span>
            )}
            <span className="hidden max-w-[100px] truncate sm:inline">
              {profile.displayName}
            </span>
          </button>
        </div>
      </div>

      <div className="border-t border-border/50 px-3 py-2 sm:hidden">
        <nav
          aria-label="Mobile navigation"
          className="grid grid-cols-3 gap-1 rounded-full border border-border/70 bg-muted/70 p-1"
        >
          <Link
            href="/"
            prefetch={true}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors",
              pathname === "/"
                ? "bg-card-solid text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Lookup</span>
          </Link>
          <Link
            href="/vault"
            prefetch={true}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors",
              pathname.startsWith("/vault")
                ? "bg-card-solid text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Library className="h-3.5 w-3.5" />
            <span>Vault</span>
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
              {words.length}
            </span>
          </Link>
          <Link
            href="/study"
            prefetch={true}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors",
              pathname.startsWith("/study")
                ? "bg-card-solid text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Study</span>
            {dueWords.length > 0 ? (
              <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#5227cc] dark:text-violet-300">
                {dueWords.length}
              </span>
            ) : null}
          </Link>
        </nav>
      </div>
    </header>
  );
}
