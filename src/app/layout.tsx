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
  title: "Fede Longhi — Senior Software Engineer · Salesforce",
  description:
    "Portfolio of Fede Longhi: Senior Software Engineer specializing in Salesforce, plus hardware projects, tools, art, and games. / Portafolio de Fede Longhi: Senior Software Engineer especialista en Salesforce, proyectos de hardware, herramientas, arte y juegos.",
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
