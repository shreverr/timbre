import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Voice widget",
  robots: { index: false, follow: false },
};

// The root layout sets `bg-background` on <body>. We override that here so the
// host page shows through everywhere except the launcher button + popup.
const TRANSPARENT_BODY_CSS = `
  html, body {
    background: transparent !important;
    color-scheme: normal !important;
  }
  body {
    overflow: hidden;
  }
`;

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TRANSPARENT_BODY_CSS }} />
      {children}
    </>
  );
}
