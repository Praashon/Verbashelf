import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Copyright,
  FileText,
  HardDrive,
  Scale,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  LegalSection,
  LegalShell,
  type LegalTocItem,
} from "@/components/LegalShell";
import { LEGAL_EFFECTIVE_DATE, LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service | VerbaShelf",
  description:
    "Terms of Service governing your use of VerbaShelf, local-first browser data responsibility, open dictionary source attributions, and operator contact details.",
};

const TERMS_TOC: ReadonlyArray<LegalTocItem> = [
  { id: "acceptance", label: "1. Acceptance of Terms" },
  { id: "service", label: "2. Description of Service" },
  { id: "local-data", label: "3. Local Storage & Backups" },
  { id: "acceptable-use", label: "4. Acceptable Use" },
  { id: "third-party-content", label: "5. Dictionary & Open Licenses" },
  { id: "intellectual-property", label: "6. Intellectual Property" },
  { id: "disclaimers", label: "7. Disclaimers" },
  { id: "liability", label: "8. Limitation of Liability" },
  { id: "modifications", label: "9. Changes to Service & Terms" },
  { id: "governing-law", label: "10. Governing Law & Contact" },
];

export default function TermsOfServicePage() {
  return (
    <LegalShell
      activePage="terms"
      badge="Terms & Conditions"
      title="Terms of Service"
      subtitle="Clear, straightforward terms for using VerbaShelf, managing your browser-stored vocabulary vault, and respecting third-party dictionary and open-source licenses."
      toc={TERMS_TOC}
    >
      <LegalSection
        id="acceptance"
        title="1. Acceptance of Terms"
        icon={<FileText className="h-4 w-4" />}
      >
        <p>
          By accessing or using <strong className="text-foreground">{LEGAL_OPERATOR.productName}</strong>,
          you agree to these Terms of Service (effective{" "}
          <strong className="text-foreground">{LEGAL_EFFECTIVE_DATE}</strong>), as well as our{" "}
          <Link href="/privacy" className="font-medium text-primary hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/legal" className="font-medium text-primary hover:underline">
            Legal &amp; Storage Disclosure
          </Link>
          . {LEGAL_OPERATOR.productName} is operated by{" "}
          <strong className="text-foreground">{LEGAL_OPERATOR.name}</strong> in{" "}
          <strong className="text-foreground">{LEGAL_OPERATOR.location}</strong>. If you do not
          agree to these terms, please discontinue using the application.
        </p>
      </LegalSection>

      <LegalSection
        id="service"
        title="2. Description of the Service"
        icon={<Sparkles className="h-4 w-4" />}
      >
        <p>
          {LEGAL_OPERATOR.productName} is a free, client-side, local-first personal vocabulary vault
          and speaking companion. It provides dictionary lookups via public third-party APIs,
          on-device and browser-assisted voice search, local topic organization, chronological
          browsing, portable JSON export/import, and URL-fragment (<code className="font-mono text-xs">#v1=</code>)
          deck sharing.
        </p>
        <p>
          Features such as dictionary lookup, audio pronunciation playback, and first-time Whisper
          model downloads depend on external network availability and third-party public endpoints.
        </p>
      </LegalSection>

      <LegalSection
        id="local-data"
        title="3. Local Storage &amp; Data Backup Responsibility"
        icon={<HardDrive className="h-4 w-4" />}
      >
        <p>
          Because {LEGAL_OPERATOR.productName} stores your vocabulary vault, topics, Trash, and
          profile exclusively inside your browser&apos;s IndexedDB and{" "}
          <code className="font-mono text-xs">localStorage</code> without a remote cloud backup:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-foreground">No remote recovery:</strong> We cannot view,
            restore, or recover lost words if you clear browser data, use private/incognito browsing,
            switch devices, uninstall your browser, or run the Settings{" "}
            <code className="font-mono text-xs">DELETE</code> wipe.
          </li>
          <li>
            <strong className="text-foreground">Regular backups recommended:</strong> You are
            responsible for safeguarding your own vocabulary records by using{" "}
            <strong className="text-foreground">Settings &rarr; Export Vault (.json)</strong>{" "}
            periodically.
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="acceptable-use"
        title="4. Acceptable Use"
        icon={<ShieldAlert className="h-4 w-4" />}
      >
        <p>When using {LEGAL_OPERATOR.productName}, you agree not to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Use automated bots, excessive scripted polling, or scraping tools that overload or abuse
            upstream dictionary, Wiktionary, Wikipedia, Datamuse, or CDN endpoints.
          </li>
          <li>
            Craft or distribute malicious, unlawful, harassing, defamatory, or infringing content
            through shared <code className="font-mono text-xs">/share#v1=</code> links or{" "}
            <code className="font-mono text-xs">.json</code> files.
          </li>
          <li>
            Attempt to disrupt, probe, or interfere with the availability or security of the hosted
            static application or connected third-party services.
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="third-party-content"
        title="5. Third-Party Content &amp; Open Licenses"
        icon={<BookOpen className="h-4 w-4" />}
      >
        <p>
          Dictionary definitions, phonetics, synonyms, usage examples, and reference summaries are
          retrieved dynamically from independent public providers, including{" "}
          <strong className="text-foreground">Free Dictionary API</strong>,{" "}
          <strong className="text-foreground">FreeDictionaryAPI</strong>,{" "}
          <strong className="text-foreground">Simple English Wiktionary</strong>,{" "}
          <strong className="text-foreground">Wikipedia</strong>, and{" "}
          <strong className="text-foreground">Datamuse</strong>.
        </p>
        <p>
          Encyclopedic and Wiktionary extracts remain subject to their respective open licenses
          (such as Creative Commons Attribution-ShareAlike 4.0 / CC BY-SA 4.0 where applicable).
          {LEGAL_OPERATOR.productName} does not guarantee the linguistic completeness, accuracy, or
          uninterrupted availability of any upstream data source.
        </p>
      </LegalSection>

      <LegalSection
        id="intellectual-property"
        title="6. Intellectual Property &amp; Your Content"
        icon={<Copyright className="h-4 w-4" />}
      >
        <p>
          The {LEGAL_OPERATOR.productName} brand name, logo mark, interface design, and original
          application code belong to <strong className="text-foreground">{LEGAL_OPERATOR.name}</strong>,
          subject to applicable open-source package licenses for underlying libraries.
        </p>
        <p>
          You retain full ownership and control over your personal vocabulary collections, custom
          topic folder names, local profile display name, and uploaded avatar image stored on your
          device.
        </p>
      </LegalSection>

      <LegalSection
        id="disclaimers"
        title="7. Disclaimer of Warranties"
        icon={<AlertTriangle className="h-4 w-4" />}
      >
        <p>
          {LEGAL_OPERATOR.productName} is provided on an{" "}
          <strong className="text-foreground">&ldquo;AS IS&rdquo;</strong> and{" "}
          <strong className="text-foreground">&ldquo;AS AVAILABLE&rdquo;</strong> basis, without
          warranties of any kind, whether express, implied, or statutory, including implied warranties
          of merchantability, fitness for a particular purpose, accuracy of dictionary definitions or
          speech transcriptions, and non-infringement.
        </p>
      </LegalSection>

      <LegalSection
        id="liability"
        title="8. Limitation of Liability"
        icon={<Scale className="h-4 w-4" />}
      >
        <p>
          To the fullest extent permitted by applicable law,{" "}
          <strong className="text-foreground">{LEGAL_OPERATOR.name}</strong> shall not be liable for
          any indirect, incidental, special, consequential, or punitive damages, or any loss of
          local browser data, vocabulary collections, or service interruptions arising out of or
          related to your use of {LEGAL_OPERATOR.productName}.
        </p>
      </LegalSection>

      <LegalSection
        id="modifications"
        title="9. Changes to the Service &amp; Terms"
        icon={<FileText className="h-4 w-4" />}
      >
        <p>
          We may update, modify, or discontinue features of {LEGAL_OPERATOR.productName} or revise
          these Terms of Service at any time. Continued use of the application after updated terms
          are posted on this page constitutes acceptance of the revised terms.
        </p>
      </LegalSection>

      <LegalSection
        id="governing-law"
        title="10. Governing Law &amp; Contact"
        icon={<Scale className="h-4 w-4" />}
      >
        <p>
          These Terms of Service are governed by and construed in accordance with the laws of Nepal,
          without prejudice to any mandatory consumer protections applicable in your jurisdiction.
        </p>
        <p>
          For legal notices, feedback, or support inquiries, contact{" "}
          <strong className="text-foreground">{LEGAL_OPERATOR.name}</strong> ({LEGAL_OPERATOR.location})
          at{" "}
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
