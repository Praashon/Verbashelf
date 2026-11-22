import { Suspense } from "react";
import { HomeClient } from "@/components/HomeClient";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl px-3.5 py-16 text-center text-sm text-muted-foreground sm:px-6">
          Loading lookup...
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
