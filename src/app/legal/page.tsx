import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  Cookie,
  FileText,
  Mail,
  Scale,
  ShieldCheck,
} from "lucide-react";
import {
  LegalSection,
  LegalShell,
  type LegalTocItem,
} from "@/components/LegalShell";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_OPERATOR,
  LOCAL_STORAGE_INVENTORY,
  THIRD_PARTY_SERVICES,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Legal Notice, Cookies & Policies | VerbaShelf",
  description:
    "Official legal imprint, operator contact details (Prashon Gautam, Kathmandu, Nepal), zero-cookie browser storage disclosure, and third-party attributions for VerbaShelf.",
};

const LEGAL_TOC: ReadonlyArray<LegalTocItem> = [
  { id: "imprint", label: "1. Operator Imprint" },
  { id: "policies", label: "2. Policy Directory" },
  { id: "storage", label: "3. Cookies & Browser Storage" },
  { id: "attributions", label: "4. Sources & Open-Source" },
  { id: "contact", label: "5. Legal & Privacy Contact" },
];

const OPEN_SOURCE_PACKAGES = [
  "Next.js",
  "React",
  "Dexie.js",
  "TanStack Query",
  "@huggingface/transformers (Whisper ONNX)",
  "Zod",
  "LZ-String",
  "Lucide Icons",
] as const;

export default function LegalCenterPage() {
  return (
    <LegalShell
      activePage="legal"
      badge="Legal Center & Imprint"
      title="Legal Notice, Cookies &amp; Policies"
      subtitle="Transparent operator details, complete browser storage disclosure, third-party dictionary attributions, and direct contact information for VerbaShelf."
      toc={LEGAL_TOC}
    >
      <LegalSection
        id="imprint"
        title="1. Operator &amp; Publisher Information (Imprint)"
        icon={<Building2 className="h-4 w-4" />}
      >
        <p>
          {LEGAL_OPERATOR.productName} is independently developed, published, and maintained by the
          operator listed below:
        </p>

        <dl className="grid gap-3 rounded-xl border border-border/70 bg-background/60 p-4 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Operator
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {LEGAL_OPERATOR.name}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Role
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {LEGAL_OPERATOR.role}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </dt>
            <dd className="mt-0.5">
              <a
                href={`mailto:${LEGAL_OPERATOR.email}`}
                className="font-semibold text-primary hover:underline"
              >
                {LEGAL_OPERATOR.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Location
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {LEGAL_OPERATOR.location}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Application
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {LEGAL_OPERATOR.productName} &mdash; {LEGAL_OPERATOR.tagline}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Effective Date
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {LEGAL_EFFECTIVE_DATE}
            </dd>
          </div>
        </dl>
      </LegalSection>

      <LegalSection
        id="policies"
        title="2. Policy Directory"
        icon={<Scale className="h-4 w-4" />}
      >
        <p>
          Review our dedicated policy documents covering personal data privacy, terms of use, and
          local browser storage practices:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/privacy"
            className="group rounded-xl border border-border/80 bg-background/60 p-4 transition-colors hover:border-primary/50 hover:bg-muted/60"
          >
            <div className="flex items-center gap-2 font-bold text-foreground group-hover:text-primary">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Privacy Policy</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Details on local IndexedDB storage, on-device Whisper speech recognition, public API
              lookups, and your deletion rights.
            </p>
          </Link>

          <Link
            href="/terms"
            className="group rounded-xl border border-border/80 bg-background/60 p-4 transition-colors hover:border-primary/50 hover:bg-muted/60"
          >
            <div className="flex items-center gap-2 font-bold text-foreground group-hover:text-primary">
              <FileText className="h-4 w-4 text-primary" />
              <span>Terms of Service</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Rules of acceptable use, local data backup responsibilities, warranties, and governing
              law.
            </p>
          </Link>
        </div>
      </LegalSection>

      <LegalSection
        id="storage"
        title="3. Cookie &amp; Browser Storage Disclosure"
        icon={<Cookie className="h-4 w-4" />}
      >
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3.5 text-xs text-foreground sm:text-sm">
          <strong className="text-emerald-700 dark:text-emerald-300">
            Zero Tracking Cookies:
          </strong>{" "}
          {LEGAL_OPERATOR.productName} sets{" "}
          <strong>zero advertising, analytics, cross-site tracking, or session cookies</strong>. All
          persistence stays inside your browser using IndexedDB,{" "}
          <code className="font-mono text-xs">localStorage</code>, and Cache Storage strictly for
          core app functionality.
        </div>

        <div className="space-y-2.5 pt-1">
          {LOCAL_STORAGE_INVENTORY.map((item) => (
            <div
              key={item.keyName}
              className="rounded-xl border border-border/75 bg-background/60 p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-foreground sm:text-[13px]">
                  {item.keyName}
                </span>
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {item.category}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{item.purpose}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/90">
                <strong className="text-foreground">Retention:</strong> {item.retention}
              </p>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection
        id="attributions"
        title="4. Third-Party Data Sources &amp; Open-Source Attributions"
        icon={<BookOpen className="h-4 w-4" />}
      >
        <p>
          {LEGAL_OPERATOR.productName} connects directly from your browser to public reference and
          voice model services:
        </p>

        <ul className="list-disc space-y-1.5 pl-5">
          {THIRD_PARTY_SERVICES.map((service) => (
            <li key={service.name}>
              <strong className="text-foreground">{service.name}</strong> (
              <code className="font-mono text-xs">{service.host}</code>) &mdash; {service.purpose}{" "}
              {service.notes}
            </li>
          ))}
        </ul>

        <p>
          Content retrieved from Wikipedia and Simple English Wiktionary is attributed to Wikimedia
          contributors and available under the{" "}
          <strong className="text-foreground">CC BY-SA 4.0</strong> license.
        </p>

        <div className="pt-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Core Open-Source Technologies
          </p>
          <div className="flex flex-wrap gap-1.5">
            {OPEN_SOURCE_PACKAGES.map((pkg) => (
              <span
                key={pkg}
                className="rounded-full border border-border/80 bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground"
              >
                {pkg}
              </span>
            ))}
          </div>
        </div>
      </LegalSection>

      <LegalSection
        id="contact"
        title="5. Legal, Copyright &amp; Privacy Inquiries"
        icon={<Mail className="h-4 w-4" />}
      >
        <p>
          If you have any legal notice, copyright or attribution concern, privacy question, or
          feedback about {LEGAL_OPERATOR.productName}, please write directly to{" "}
          <strong className="text-foreground">{LEGAL_OPERATOR.name}</strong> in{" "}
          <strong className="text-foreground">{LEGAL_OPERATOR.location}</strong> at{" "}
          <a
            href={`mailto:${LEGAL_OPERATOR.email}`}
            className="font-medium text-primary hover:underline"
          >
            {LEGAL_OPERATOR.email}
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
