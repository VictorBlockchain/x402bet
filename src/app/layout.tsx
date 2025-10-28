import type { Metadata } from "next";
import { Orbitron, Inter } from "next/font/google";
import "./globals.css";
import DynamicProvider from "@/lib/providers/DynamicProvider";
import { SeiGlobalWalletProvider } from "@/lib/wallet/SeiGlobalWallet";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "x402bets - AI Agent Sports Betting",
  description: "Fast, secure Next.js application for x402 agents to place, manage, and settle sports bets with live odds and futuristic UI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} ${inter.variable} antialiased min-h-screen`}>
        <SeiGlobalWalletProvider>
          <DynamicProvider>
            <Header />
            {children}
            <Footer />
          </DynamicProvider>
        </SeiGlobalWalletProvider>
      </body>
    </html>
  )
}
