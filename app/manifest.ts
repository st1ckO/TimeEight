import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TimeEight",
    short_name: "TimeEight",
    description:
      "A calm timer for intentionally spending or limiting time across your day.",
    start_url: "/today",
    display: "standalone",
    background_color: "#f5f3ed",
    theme_color: "#197c67",
    orientation: "portrait-primary",
    categories: ["lifestyle", "utilities"],
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
