import Link from "next/link";
import { Code2, Mail, MapPin, Scale, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LEGAL_COPYRIGHT_YEAR, LEGAL_OPERATOR } from "@/lib/legal";

const navLinks = [
  { label: "Lookup", href: "/" },
  { label: "Vault", href: "/vault" },
  { label: "Study", href: "/study" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookies", href: "/legal#storage" },
  { label: "Legal", href: "/legal" },
] as const;

export function Footer16() {
  return (
    <footer className="relative bg-transparent text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link
              href="/"
              className="inline-flex items-center transition-opacity hover:opacity-85"
            >
              <BrandLogo className="scale-90" />
            </Link>

            <span
              aria-hidden="true"
              className="hidden h-3.5 w-px bg-foreground/15 dark:bg-white/15 sm:inline-block"
            />

            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-xs font-medium text-foreground/80 transition-colors hover:text-foreground dark:text-zinc-200 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <span
              aria-hidden="true"
              className="hidden h-3.5 w-px bg-foreground/15 dark:bg-white/15 sm:inline-block"
            />

            <div className="flex items-center gap-1.5">
              <a
                href={`mailto:${LEGAL_OPERATOR.email}`}
                aria-label={`Email ${LEGAL_OPERATOR.name}`}
                title={`Email ${LEGAL_OPERATOR.email}`}
                className="grid size-7 place-items-center rounded-full border border-foreground/12 bg-white/55 text-foreground/80 shadow-xs backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-white/85 hover:text-foreground dark:border-white/15 dark:bg-white/10 dark:text-zinc-200 dark:hover:border-white/30 dark:hover:bg-white/20 dark:hover:text-white"
              >
                <Mail className="size-3.5" />
              </a>

              <Link
                href="/privacy"
                aria-label="Privacy Policy"
                title="Privacy Policy"
                className="grid size-7 place-items-center rounded-full border border-foreground/12 bg-white/55 text-foreground/80 shadow-xs backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-white/85 hover:text-foreground dark:border-white/15 dark:bg-white/10 dark:text-zinc-200 dark:hover:border-white/30 dark:hover:bg-white/20 dark:hover:text-white"
              >
                <ShieldCheck className="size-3.5" />
              </Link>

              <Link
                href="/legal"
                aria-label="Legal Notice, Cookies & Storage"
                title="Legal Notice & Cookies"
                className="grid size-7 place-items-center rounded-full border border-foreground/12 bg-white/55 text-foreground/80 shadow-xs backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-white/85 hover:text-foreground dark:border-white/15 dark:bg-white/10 dark:text-zinc-200 dark:hover:border-white/30 dark:hover:bg-white/20 dark:hover:text-white"
              >
                <Scale className="size-3.5" />
              </Link>

              <a
                href="https://github.com/Praashon/Verbashelf"
                target="_blank"
                rel="noreferrer"
                aria-label="VerbaShelf on GitHub"
                title="View source on GitHub"
                className="grid size-7 place-items-center rounded-full border border-foreground/12 bg-white/55 text-foreground/80 shadow-xs backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-white/85 hover:text-foreground dark:border-white/15 dark:bg-white/10 dark:text-zinc-200 dark:hover:border-white/30 dark:hover:bg-white/20 dark:hover:text-white"
              >
                <Code2 className="size-3.5" />
              </a>
            </div>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-foreground/15 to-transparent dark:via-white/15" />

          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] text-foreground/75 dark:text-zinc-200">
            <span>
              &copy; {LEGAL_COPYRIGHT_YEAR} {LEGAL_OPERATOR.productName}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span>
              Built by{" "}
              <strong className="font-semibold text-foreground dark:text-white">
                {LEGAL_OPERATOR.name}
              </strong>
            </span>
            <span aria-hidden="true">&middot;</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3 text-foreground/70 dark:text-zinc-200" />
              <span>{LEGAL_OPERATOR.location}</span>
            </span>
            <span aria-hidden="true">&middot;</span>
            <a
              href={`mailto:${LEGAL_OPERATOR.email}`}
              className="font-medium text-foreground/90 transition-colors hover:text-foreground hover:underline dark:text-zinc-200 dark:hover:text-white"
            >
              {LEGAL_OPERATOR.email}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer16;
