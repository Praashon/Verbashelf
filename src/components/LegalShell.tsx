import React from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, ShieldCheck } from "lucide-react";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_OPERATOR,
  LEGAL_ROUTES,
  type LegalRouteId,
} from "@/lib/legal";
import { cn } from "@/lib/utils";

export interface LegalTocItem {
  id: string;
  label: string;
}

interface LegalShellProps {
  activePage: LegalRouteId;
  badge: string;
  title: string;
  subtitle: string;
  toc: ReadonlyArray<LegalTocItem>;
  children: React.ReactNode;
}

interface LegalSectionProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function LegalSection({ id, title, icon, children }: LegalSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-border/80 bg-card/90 p-5 shadow-xs backdrop-blur-md sm:p-6"
    >
      <div className="mb-3 flex items-center gap-2.5">
        {icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            {icon}
          </span>
        ) : null}
        <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
          {title}
        </h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function LegalShell({
  activePage,
  badge,
  title,
  subtitle,
  toc,
  children,
}: LegalShellProps) {
  const otherRoutes = LEGAL_ROUTES.filter((route) => route.id !== activePage);

  return (
    <div className="mx-auto w-full max-w-5xl px-3.5 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/85 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-xs backdrop-blur-md transition-colors hover:border-primary/50 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Lookup</span>
        </Link>

        <nav
          aria-label="Legal documents"
          className="flex flex-wrap items-center gap-1 rounded-full border border-border/70 bg-muted/75 p-1 backdrop-blur-md"
        >
          {LEGAL_ROUTES.map((route) => {
            const active = route.id === activePage;
            return (
              <Link
                key={route.id}
                href={route.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-card-solid text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {route.shortLabel}
              </Link>
            );
          })}
        </nav>
      </div>

      <header className="mt-6 space-y-3.5 sm:mt-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#63e]/25 bg-white/80 px-3.5 py-1 text-xs font-medium text-[#5227cc] shadow-xs backdrop-blur-md dark:border-violet-400/25 dark:bg-zinc-900/80 dark:text-violet-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{badge}</span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>

        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {subtitle}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/80 bg-card/85 px-3 py-1 font-medium text-foreground">
            Effective: {LEGAL_EFFECTIVE_DATE}
          </span>
          <span className="rounded-full border border-border/80 bg-card/85 px-3 py-1 font-medium">
            Operator: <strong className="text-foreground">{LEGAL_OPERATOR.name}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/85 px-3 py-1 font-medium">
            <MapPin className="h-3 w-3 text-primary" />
            <span>{LEGAL_OPERATOR.location}</span>
          </span>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-24">
          <nav
            aria-label="Table of contents"
            className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xs backdrop-blur-md"
          >
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              On this page
            </p>
            <ul className="space-y-1">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xs backdrop-blur-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Operator &amp; Contact
            </p>
            <p className="mt-2 text-sm font-bold text-foreground">
              {LEGAL_OPERATOR.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {LEGAL_OPERATOR.role}
            </p>
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{LEGAL_OPERATOR.location}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                <a
                  href={`mailto:${LEGAL_OPERATOR.email}`}
                  className="truncate font-medium text-primary hover:underline"
                >
                  {LEGAL_OPERATOR.email}
                </a>
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          {children}

          <section className="rounded-2xl border border-primary/25 bg-card/95 p-5 shadow-xs backdrop-blur-md sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-foreground">
                  Questions or Legal Inquiries?
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Contact <strong className="text-foreground">{LEGAL_OPERATOR.name}</strong> in{" "}
                  {LEGAL_OPERATOR.location} directly for privacy, copyright, or legal matters.
                </p>
              </div>
              <a
                href={`mailto:${LEGAL_OPERATOR.email}`}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:text-sm"
              >
                <Mail className="h-4 w-4" />
                <span>{LEGAL_OPERATOR.email}</span>
              </a>
            </div>

            <div className="mt-4 grid gap-2.5 border-t border-border/70 pt-4 sm:grid-cols-2">
              {otherRoutes.map((route) => (
                <Link
                  key={route.id}
                  href={route.href}
                  className="group rounded-xl border border-border/80 bg-background/60 p-3.5 transition-colors hover:border-primary/50 hover:bg-muted/60"
                >
                  <p className="text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
                    {route.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {route.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
