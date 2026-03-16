"use client";

import { useEffect, useState } from "react";

/**
 * Flux de flammes roses en bas de la page, comme sur la page tool du site principal.
 */
export default function PinkFlamesBackground({ atPageBottom = true }: { atPageBottom?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <>
      <div
        className={`left-0 right-0 w-full pointer-events-none z-[6] opacity-90 ${
          atPageBottom ? "fixed" : "fixed bottom-0"
        }`}
        style={{
          height: "14vh",
          ...(atPageBottom ? { bottom: "30px" } : {}),
        }}
        aria-hidden
      >
        {/* Base du flux — dégradé rose intense vers le bas */}
        <div
          className="absolute inset-0 w-full"
          style={{
            background: `
              linear-gradient(to top, 
                rgba(255, 10, 100, 0.98) 0%, 
                rgba(255, 80, 160, 0.85) 35%,
                rgba(255, 123, 198, 0.4) 65%,
                transparent 100%
              )
            `,
          }}
        />
        {/* Couche de langues de feu — forme ondulante */}
        <div
          className="absolute inset-0 w-full animate-flame-flicker"
          style={{
            background: `
              linear-gradient(105deg, 
                transparent 0%, 
                rgba(255, 123, 198, 0.25) 20%,
                rgba(255, 60, 140, 0.5) 40%,
                rgba(255, 123, 198, 0.3) 60%,
                transparent 80%
              ),
              linear-gradient(75deg, 
                transparent 0%, 
                rgba(255, 123, 198, 0.2) 30%,
                rgba(255, 80, 160, 0.45) 50%,
                transparent 70%
              )
            `,
            maskImage: "linear-gradient(to top, black 0%, black 40%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to top, black 0%, black 40%, transparent 100%)",
          }}
        />
        {/* Lueur / glow au ras du bas */}
        <div
          className="absolute left-0 right-0 bottom-0 h-[60%] animate-flame-glow"
          style={{
            background:
              "radial-gradient(ellipse 180% 100% at 50% 100%, rgba(255, 123, 198, 0.9) 0%, rgba(255, 123, 198, 0.4) 40%, transparent 70%)",
            boxShadow:
              "0 -20px 80px 20px rgba(255, 123, 198, 0.5), 0 -40px 120px 30px rgba(255, 123, 198, 0.3)",
          }}
        />
        {/* Particules / étincelles légères */}
        <div
          className="absolute inset-0 w-full opacity-60"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.4) 0%, transparent 2%),
              radial-gradient(circle at 50% 90%, rgba(255, 255, 255, 0.3) 0%, transparent 1.5%),
              radial-gradient(circle at 80% 85%, rgba(255, 255, 255, 0.35) 0%, transparent 2%),
              radial-gradient(circle at 35% 95%, rgba(255, 255, 255, 0.25) 0%, transparent 1%),
              radial-gradient(circle at 65% 92%, rgba(255, 255, 255, 0.3) 0%, transparent 1.5%)
            `,
            maskImage: "linear-gradient(to top, transparent 0%, black 50%, black 100%)",
            WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 50%, black 100%)",
          }}
        />
      </div>
    </>
  );
}

