import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 네컷 포토부스",
  description: "경남과학고 수학과학페스티벌 AI 네컷 포토부스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
