"use client";

import { useEffect, useState } from "react";

export default function AppBootLoader() {
  const [visible, setVisible] = useState(true);
  const [displayText, setDisplayText] = useState("");
  const [dotCount, setDotCount] = useState(0);

  const FULL_TEXT = "Establishing private execution environment";

  // Typewriter effect for the main sentence + même style de son que la home
  useEffect(() => {
    if (typeof window === "undefined") return;

    let index = 0;
    let cancelled = false;

    // Son court et mystérieux pour chaque lettre (privacy / chargement)
    const AudioContextClass =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx: AudioContext = new AudioContextClass();

    const playTick = () => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        // Tonalité plus grave, légèrement descendante, pour un effet "mysterious"
        osc.type = "sine";
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.12);

        // Volume très discret, avec petite traîne
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.start(now);
        osc.stop(now + 0.2);
      } catch {
        // ignore audio errors (e.g. autoplay blocked)
      }
    };

    const step = () => {
      if (cancelled) return;
      index += 1;
      setDisplayText(FULL_TEXT.slice(0, index));
      playTick();
      if (index < FULL_TEXT.length) {
        setTimeout(step, 55);
      }
    };

    // petit délai avant de commencer l'animation
    const initial = setTimeout(step, 150);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      ctx.close().catch(() => {});
    };
  }, []);

  // Dots animation: ., .., ..., then loop
  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Hide once page is fully loaded / ready
  useEffect(() => {
    // Affiche le loader pendant ~6 secondes pour introduire l'environnement privé
    const timer = setTimeout(() => {
      setVisible(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const dots = dotCount === 0 ? "" : ".".repeat(dotCount);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black pointer-events-auto"
    >
      <p className="text-[13px] sm:text-sm md:text-base text-[#EAEAEA] tracking-[0.16em] uppercase animate-[fadeIn_0.4s_ease-out_forwards]">
        {displayText}
        {dots}
      </p>
    </div>
  );
}

