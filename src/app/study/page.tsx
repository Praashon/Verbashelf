import { Suspense } from "react";
import type { Metadata } from "next";
import { StudyClient } from "@/components/StudyClient";

export const metadata: Metadata = {
  title: "Practice & Memory Review | VerbaShelf",
  description:
    "Review saved words with smart memory timing, flashcards, word games, listening practice, and sound-spelling challenges.",
};

export default function StudyPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl px-3.5 py-12 text-center text-sm text-muted-foreground sm:px-6">
          Loading study session...
        </div>
      }
    >
      <StudyClient />
    </Suspense>
  );
}
