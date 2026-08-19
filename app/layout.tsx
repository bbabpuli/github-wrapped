import type { Metadata } from "next";
import { Black_Han_Sans, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

const display = Black_Han_Sans({
  weight: "400",
  preload: false,
  variable: "--font-display-face",
});

const body = IBM_Plex_Sans_KR({
  weight: ["400", "600"],
  preload: false,
  variable: "--font-body-face",
});

export const metadata: Metadata = {
  title: "GitHub Wrapped",
  description: "올해 당신의 GitHub, 카드 한 장으로",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
