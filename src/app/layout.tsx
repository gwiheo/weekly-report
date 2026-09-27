import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "주간 연구계획 마인드맵",
  description:
    "연구 주제와 추진 내용, 주간 일정을 마인드맵으로 정리하고 주간업무표 형식의 docx / xlsx 로 저장합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
