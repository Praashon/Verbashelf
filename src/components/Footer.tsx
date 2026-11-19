import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LEGAL_COPYRIGHT_YEAR, LEGAL_OPERATOR } from "@/lib/legal";

export function Footer() {
  return (
    <footer className="border-t border-border/70 bg-white/75 backdrop-blur-xl transition-colors dark:bg-black/75">
      <div className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Link
              href="/"
              className="inline-flex items-center transition-opacity hover:opacity-85"
            >
              <BrandLogo />
            </Link>
            <p className="text-xs text-muted-foreground">
              Local-first vocabulary vault · Zero accounts · Zero tracking
            </p>
          </div>

          <nav
            aria-label="Legal and policy links"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground sm:text-sm"
          >
            <Link
              href="/privacy"
              className="transition-colors hover:text-primary"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-primary"
            >
              Terms of Service
            </Link>
            <Link
              href="/legal#storage"
              className="transition-colors hover:text-primary"
            >
              Cookies &amp; Storage
            </Link>
            <Link
              href="/legal"
              className="transition-colors hover:text-primary"
            >
              Legal &amp; Contact
            </Link>
          </nav>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>
              &copy; {LEGAL_COPYRIGHT_YEAR} {LEGAL_OPERATOR.productName}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span>Operated by {LEGAL_OPERATOR.name}</span>
            <span aria-hidden="true">&middot;</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" />
              <span>{LEGAL_OPERATOR.location}</span>
            </span>
          </p>

          <a
            href={`mailto:${LEGAL_OPERATOR.email}`}
            className="inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-primary"
          >
            <Mail className="h-3.5 w-3.5 text-primary" />
            <span>{LEGAL_OPERATOR.email}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
