import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HOSHII — 欲しいものに合う懸賞が届く",
  description: "公式情報から、あなたの欲しいものに合う懸賞をお知らせします。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
