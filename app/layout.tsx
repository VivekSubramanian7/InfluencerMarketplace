import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Clipline — book video creators",
  description:
    "Book sponsored videos from vetted micro-influencers on YouTube, TikTok, and Instagram.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} h-full antialiased font-sans`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
