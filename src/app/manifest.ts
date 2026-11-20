import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VerbaShelf: Personal Vocabulary & Speaking Vault",
    short_name: "VerbaShelf",
    description:
      "Your 100% local-first personal vocabulary vault, spaced-repetition trainer, and offline voice dictionary.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1d9bf0",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
