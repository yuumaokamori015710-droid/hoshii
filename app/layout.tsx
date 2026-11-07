import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "くらしの懸賞便｜すきま時間に見つかる、うれしい懸賞",
  description: "公式情報から、ギフト券・食品・家電などの懸賞を探せます。応募条件を確認して、欲しいものに合う新着をお知らせします。",
  applicationName: "くらしの懸賞便",
  icons: {
    icon: "/favicon.svg?v=kurashi-1",
    shortcut: "/favicon.svg?v=kurashi-1",
    apple: "/apple-touch-icon.png",
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
