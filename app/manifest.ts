import type { MetadataRoute } from "next";

// Lets people add Discipline to their home screen (needed on iPhone for
// push notifications) and gives it a name, colours and icons there.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Discipline",
    short_name: "Discipline",
    description: "A feed built for focus, not scrolling.",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    background_color: "#14110f",
    theme_color: "#14110f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
