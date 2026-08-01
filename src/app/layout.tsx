import type { Metadata } from "next";
import { Chakra_Petch, Figtree } from "next/font/google";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-chakra-petch",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fede Longhi — Senior Salesforce Engineer",
  description:
    "Senior Salesforce engineer with 5+ years designing and shipping platform solutions. Apex, LWC, integrations, architecture, mentoring. Based in Martínez, Buenos Aires.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${chakraPetch.variable} ${figtree.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
