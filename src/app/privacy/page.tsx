import type { Metadata } from "next";
import Link from "next/link";
import {
  Cookie,
  Database,
  Globe,
  HardDrive,
  Lock,
  Mail,
  Mic,
  Share2,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import {
  LegalSection,
  LegalShell,
  type LegalTocItem,
} from "@/components/LegalShell";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_OPERATOR,
  THIRD_PARTY_SERVICES,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | VerbaShelf",
  description:
    "Learn how VerbaShelf protects your privacy with 100% local IndexedDB storage, on-device Whisper voice recognition, zero tracking cookies, and direct public dictionary lookups.",
};

const PRIVACY_TOC: ReadonlyArray<LegalTocItem> = [
  { id: "overview", label: "1. Overview & Operator" },
  { id: "no-collection", label: "2. What We Do Not Collect" },
  { id: "local-storage", label: "3. Local Device Storage" },
  { id: "voice-microphone", label: "4. Microphone & Voice AI" },
  { id: "third-party", label: "5. Dictionary & Reference APIs" },
  { id: "sharing-backups", label: "6. Link Sharing & Backups" },
  { id: "your-control", label: "7. Your Control & Deletion" },
  { id: "children", label: "8. Children's Privacy" },
  { id: "updates-contact", label: "9. Policy Updates & Contact" },
];

const PRIVACY_HIGHLIGHTS = [
  {
    icon: HardDrive,
    title: "Local IndexedDB Only",
    description:
      "Saved words, topics, Trash items, and your profile avatar live strictly inside your browser.",
  },
  {
    icon: Cookie,
    title: "Zero Accounts & Cookies",
    description:
      "No login walls, no tracking cookies, no analytics SDKs, and no behavioral profiling.",
  },
  {
    icon: Mic,
    title: "On-Device Whisper Voice",
    description:
      "Microphone audio is transcribed locally in a Web Worker using quantized Whisper WASM.",
  },
  {
    icon: Globe,
    title: "Direct Public Lookups",
    description:
      "Your browser queries public dictionary APIs directly without routing through a VerbaShelf DB.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalShell
      activePage="privacy"
      badge="Privacy-First Policy"
      title="Privacy Policy"
      subtitle="VerbaShelf is architected from the ground up as a 100% client-side, local-first vocabulary vault. Your personal words, topics, profile, and voice recordings stay on your own device."
      toc={PRIVACY_TOC}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {PRIVACY_HIGHLIGHTS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xs backdrop-blur-md"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Icon className="h-4 w-4 text-primary" />
                <span>{item.title}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>

      <LegalSection
        id="overview"
        title="1. Overview &amp; Operator Identity"
        icon={<ShieldCheck className="h-4 w-4" />}
      >
        <p>
          This Privacy Policy explains how <strong className="text-foreground">{LEGAL_OPERATOR.productName}</strong>{" "}
          handles information when you use the web application. {LEGAL_OPERATOR.productName} is
          independently created and operated by{" "}
          <strong className="text-foreground">{LEGAL_OPERATOR.name}</strong>, based in{" "}
          <strong className="text-foreground">{LEGAL_OPERATOR.location}</strong> (contact:{" "}
          <a
            href={`mailto:${LEGAL_OPERATOR.email}`}
            className="font-medium text-primary hover:underline"
          >
            {LEGAL_OPERATOR.email}
          </a>
          ).
        </p>
        <p>
          Effective date: <strong className="text-foreground">{LEGAL_EFFECTIVE_DATE}</strong>. Because{" "}
          {LEGAL_OPERATOR.productName} operates without a remote user database or account system,
          we do not collect, store, rent, or sell your personal vocabulary vault on our own servers.
        </p>
      </LegalSection>

      <LegalSection
        id="no-collection"
        title="2. Local-First Architecture (What We Do Not Collect)"
        icon={<Lock className="h-4 w-4" />}
      >
        <p>
          By design, {LEGAL_OPERATOR.productName} omits server-side user tracking and personal data
          collection infrastructure:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-foreground">No accounts or credentials:</strong> We do not ask
            for your email address, password, phone number, or payment details to use the app.
          </li>
          <li>
            <strong className="text-foreground">No remote vocabulary database:</strong> Your word
            lookups, custom topic shelves, Trash items, and display profile are never synced to a
            cloud database operated by us.
          </li>
          <li>
            <strong className="text-foreground">No analytics or ad trackers:</strong> We do not
            embed third-party advertising networks, behavioral analytics scripts, session replay
            tools, or cross-site tracking pixels.
          </li>
          <li>
            <strong className="text-foreground">Zero HTTP tracking cookies:</strong> VerbaShelf sets
            no first-party advertising, analytics, or authentication cookies.
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="local-storage"
        title="3. Data Stored Locally on Your Device"
        icon={<Database className="h-4 w-4" />}
      >
        <p>
          To provide instant offline-ready browsing, your browser stores application data strictly on
          your own device:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-foreground">IndexedDB (VerbaShelfDB via Dexie.js):</strong>{" "}
            Stores your <code className="font-mono text-xs">topics</code>,{" "}
            <code className="font-mono text-xs">words</code> (including definitions, phonetics,
            examples, and lookup dates), <code className="font-mono text-xs">trash</code>{" "}
            (soft-deleted words), and <code className="font-mono text-xs">profile</code> (local
            display name, canvas-compressed avatar up to 160&times;160 px, display mode, typing
            speed, and push-to-talk shortcut).
          </li>
          <li>
            <strong className="text-foreground">localStorage preferences:</strong> Stores lightweight
            UI state under <code className="font-mono text-xs">verbashelf-theme</code>,{" "}
            <code className="font-mono text-xs">verbashelf-active-topic</code>,{" "}
            <code className="font-mono text-xs">verbashelf-onboarding-v1</code>, and{" "}
            <code className="font-mono text-xs">verbashelf-voice-model-v2</code>.
          </li>
          <li>
            <strong className="text-foreground">Browser Cache Storage:</strong> When local voice AI
            is enabled, your browser caches the quantized Whisper WASM model assets locally so voice
            searches do not need to re-download weights on repeat visits.
          </li>
        </ul>
        <p>
          For a complete key-by-key breakdown of every local storage mechanism, visit our{" "}
          <Link href="/legal#storage" className="font-medium text-primary hover:underline">
            Cookie &amp; Browser Storage Disclosure
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection
        id="voice-microphone"
        title="4. Microphone &amp; Voice Search Privacy"
        icon={<Mic className="h-4 w-4" />}
      >
        <p>
          Microphone access is optional and only requested when you explicitly activate voice search
          (by clicking the microphone button or holding your configured push-to-talk key).
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-foreground">On-device Whisper transcription:</strong> When
            using the local Whisper engine (<code className="font-mono text-xs">onnx-community/whisper-base.en</code>{" "}
            via <code className="font-mono text-xs">@huggingface/transformers</code>), recorded audio
            is decoded and transcribed entirely inside an isolated browser Web Worker on your
            device. Audio is never uploaded to {LEGAL_OPERATOR.productName} servers.
          </li>
          <li>
            <strong className="text-foreground">Initial model download:</strong> To run speech
            recognition locally, your browser downloads the open-weight Whisper WASM model files
            from Hugging Face CDN (<code className="font-mono text-xs">huggingface.co</code>) once
            and caches them locally.
          </li>
          <li>
            <strong className="text-foreground">Browser Web Speech API fallback:</strong> On
            supported browsers before the local Whisper model finishes warming up, VerbaShelf may
            invoke the browser&apos;s native <code className="font-mono text-xs">SpeechRecognition</code>{" "}
            API. Depending on your browser vendor and OS settings, native speech recognition may
            process audio locally or via your browser vendor&apos;s speech service under their own
            privacy policy.
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="third-party"
        title="5. Third-Party Dictionary &amp; Reference Lookups"
        icon={<Globe className="h-4 w-4" />}
      >
        <p>
          Because {LEGAL_OPERATOR.productName} has no backend dictionary server, your browser
          requests definitions and pronunciation audio directly from public external APIs when you
          look up a word. Those services receive standard network request metadata (such as your IP
          address, browser user-agent, and the queried word) governed by their respective privacy
          policies. Your local profile name, avatar, and topic folders are never sent to them.
        </p>

        <div className="space-y-2.5 pt-1">
          {THIRD_PARTY_SERVICES.map((service) => (
            <div
              key={service.name}
              className="rounded-xl border border-border/70 bg-background/60 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-foreground">{service.name}</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-primary">
                  {service.host}
                </code>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{service.purpose}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/85">{service.notes}</p>
            </div>
          ))}
        </div>

        <p>
          Typography assets (<code className="font-mono text-xs">Geist</code> and{" "}
          <code className="font-mono text-xs">Geist Mono</code>) are bundled at build time via{" "}
          <code className="font-mono text-xs">next/font/google</code>, avoiding runtime requests to
          Google Fonts servers during page visits.
        </p>
      </LegalSection>

      <LegalSection
        id="sharing-backups"
        title="6. Link Sharing (#v1=) &amp; JSON Backups"
        icon={<Share2 className="h-4 w-4" />}
      >
        <p>
          {LEGAL_OPERATOR.productName} lets you share selected words without a server database using
          client-side <code className="font-mono text-xs">lz-string</code> compression placed in the
          URL hash fragment (<code className="font-mono text-xs">/share#v1=...</code>) or by
          downloading a shareable <code className="font-mono text-xs">.json</code> file.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-foreground">URL fragments stay client-side:</strong> Standard
            browsers do not transmit the <code className="font-mono text-xs">#hash</code> fragment
            of a URL in HTTP requests to web servers, and VerbaShelf stores no copy of shared decks.
          </li>
          <li>
            <strong className="text-foreground">What shared links include:</strong> Shared payloads
            contain only the words you select (term, topic name, save date, concise meaning,
            optional example), your local display name (<code className="font-mono text-xs">sharedBy</code>),
            and an export timestamp.
          </li>
          <li>
            <strong className="text-foreground">Recipient access &amp; link hygiene:</strong> Anyone
            who receives a shared URL or <code className="font-mono text-xs">.json</code> export can
            view and import its contents. Messaging apps or browser history may retain links you
            paste into them, so only share words and display names you intend recipients to see.
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="your-control"
        title="7. Your Control, Retention &amp; Deletion"
        icon={<Trash2 className="h-4 w-4" />}
      >
        <p>
          You hold complete control over all data stored in your browser and can manage, export, or
          delete it at any time:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-foreground">Export &amp; Portability:</strong> Open{" "}
            <strong className="text-foreground">Settings &rarr; Export Vault (.json)</strong> to
            download a portable, Zod-validated backup of your profile, topics, and words.
          </li>
          <li>
            <strong className="text-foreground">Individual &amp; Trash Deletion:</strong> Move
            words to Trash or permanently empty Trash inside the{" "}
            <Link href="/vault" className="font-medium text-primary hover:underline">
              Vault
            </Link>{" "}
            view.
          </li>
          <li>
            <strong className="text-foreground">Full Local Wipe:</strong> In{" "}
            <strong className="text-foreground">Settings &rarr; Danger Zone</strong>, type{" "}
            <code className="font-mono text-xs">DELETE</code> to purge all IndexedDB tables (words,
            topics, profile, and trash) from your browser immediately.
          </li>
          <li>
            <strong className="text-foreground">Browser Site Data:</strong> You can also clear
            IndexedDB, <code className="font-mono text-xs">localStorage</code>, and cached Whisper
            model files anytime through your browser&apos;s site storage settings.
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="children"
        title="8. Children&apos;s Privacy"
        icon={<UserCheck className="h-4 w-4" />}
      >
        <p>
          {LEGAL_OPERATOR.productName} is a general-purpose educational and vocabulary tool. Because
          we do not operate user accounts or collect personal data on our servers, we do not
          knowingly collect personal information from children. Parents and guardians should
          supervise younger learners when granting browser microphone permissions or sharing links.
        </p>
      </LegalSection>

      <LegalSection
        id="updates-contact"
        title="9. Policy Updates &amp; Contact Information"
        icon={<Mail className="h-4 w-4" />}
      >
        <p>
          We may update this Privacy Policy from time to time to reflect improvements to{" "}
          {LEGAL_OPERATOR.productName} or changes in applicable requirements. The effective date at
          the top of this page shows when the policy was last revised.
        </p>
        <p>
          If you have privacy questions, requests, or feedback, please contact:
        </p>
        <div className="rounded-xl border border-border/70 bg-background/60 p-3.5 text-xs text-foreground sm:text-sm">
          <p className="font-bold">{LEGAL_OPERATOR.name}</p>
          <p className="text-muted-foreground">{LEGAL_OPERATOR.role}</p>
          <p className="mt-1 text-muted-foreground">{LEGAL_OPERATOR.location}</p>
          <p className="mt-1">
            Email:{" "}
            <a
              href={`mailto:${LEGAL_OPERATOR.email}`}
              className="font-medium text-primary hover:underline"
            >
              {LEGAL_OPERATOR.email}
            </a>
          </p>
        </div>
      </LegalSection>
    </LegalShell>
  );
}
