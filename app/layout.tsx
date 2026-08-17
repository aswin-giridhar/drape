import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drape — know what suits you",
  description:
    "Personal colour analysis from measured skin, eye and lip colour, with apparel try-on. Powered by the YouCam API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Turntable viewer for the garment meshes. Loaded as a module so it
            degrades to nothing if it fails - the page never depends on it. */}
        <script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
          async
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
