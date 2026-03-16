import type { ReactNode } from "react";
import { Suspense } from "react";
import { DappNav } from "@/components/DappNav";
import GlbBackground from "@/components/GlbBackground";
import "./globals.css";

export const metadata = {
  title: "Nexus AI BETA",
  description: "Private beta dApp. Access by invitation only.",
  icons: {
    icon: "/Nexus%20Logo/Nexuslogo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#000] text-white antialiased">
        <GlbBackground />
        <div className="relative z-10 min-h-screen flex flex-col w-full pt-12">
          <DappNav />
          <main className="flex-1 w-full overflow-x-hidden">
            <Suspense fallback={null}>{children}</Suspense>
          </main>
        </div>
      </body>
    </html>
  );
}
