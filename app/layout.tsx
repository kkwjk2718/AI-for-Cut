import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI와 함께하는 수과정페 네컷",
  description: "2026. 진주시와 함께하는 경남과학고등학교 수학, 과학, 정보 페스티벌 AI와 함께하는 수과정페 네컷",
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
