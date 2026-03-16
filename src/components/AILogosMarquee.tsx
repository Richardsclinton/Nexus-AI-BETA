"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useMemo } from "react";

// Logos provenant du dossier public/caroussel de la private dApp
const AI_LOGOS = [
  { name: "Claude", path: "/caroussel/claude (1).png" },
  { name: "Gemini", path: "/caroussel/gemini.png" },
  { name: "Ideogram", path: "/caroussel/ideogram.png" },
  { name: "Luma", path: "/caroussel/lumai.png" },
  { name: "Meta", path: "/caroussel/meta.png" },
  { name: "Midjourney", path: "/caroussel/midjourney.png" },
  { name: "Mistral", path: "/caroussel/mistral.png" },
  { name: "OpenAI", path: "/caroussel/oppenai.png" },
  { name: "Pika", path: "/caroussel/pika.png" },
  { name: "Runway", path: "/caroussel/runwy (2).png" },
  { name: "Partner", path: "/caroussel/images.png" },
];

const DUPLICATE_COUNT = 3;

export default function AILogosMarquee() {
  const duplicatedLogos = useMemo(() => {
    const logos: typeof AI_LOGOS = [];
    for (let i = 0; i < DUPLICATE_COUNT; i++) {
      logos.push(...AI_LOGOS);
    }
    return logos;
  }, []);

  return (
    <section className="relative w-full py-6 md:py-8 overflow-hidden">
      {/* Container global centré et plus compact */}
      <div className="mx-auto max-w-5xl px-4">
        {/* Texte au-dessus (légère accroche luxe) */}
        <div className="text-center mb-4 md:mb-6">
          <p className="text-[11px] md:text-xs tracking-[0.25em] uppercase text-white/40">
            Trusted AI ecosystem
          </p>
        </div>

        {/* Container de la bande avec effet fade */}
        <div className="relative w-full rounded-3xl border border-white/10 bg-gradient-to-r from-white/5 via-white/0 to-white/5 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.6)]">
          <div
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 md:w-24 z-10"
            style={{
              background: "linear-gradient(to right, rgba(0, 0, 0, 0.9) 0%, transparent 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 md:w-24 z-10"
            style={{
              background: "linear-gradient(to left, rgba(0, 0, 0, 0.9) 0%, transparent 100%)",
            }}
          />

          {/* Bande de logos animée — plus petite & plus luxueuse */}
          <div className="flex overflow-hidden rounded-3xl bg-black/40 py-3 md:py-4">
            <motion.div
              className="flex gap-6 md:gap-8 lg:gap-10 py-2 md:py-3"
            animate={{
              x: ["0%", `-${100 / DUPLICATE_COUNT}%`],
            }}
            transition={{
              repeat: Infinity,
              repeatType: "loop",
              duration: 60,
              ease: "linear",
            }}
            style={{
              willChange: "transform",
            }}
            >
              {duplicatedLogos.map((logo, index) => (
                <motion.div
                  key={`${logo.name}-${index}`}
                  className="flex-shrink-0 flex items-center justify-center"
                  whileHover={{
                    scale: 1.12,
                    opacity: 1,
                  }}
                  initial={{ opacity: 0.85 }}
                  style={{
                    width: "44px",
                    height: "44px",
                    transition: "all 0.3s ease",
                  }}
                >
                  <Image
                    src={logo.path}
                    alt={logo.name}
                    width={80}
                    height={80}
                    className="object-contain w-full h-full rounded-xl"
                    style={{
                      opacity: 0.92,
                      filter:
                        "brightness(1.18) contrast(1.15) drop-shadow(0 0 12px rgba(163, 216, 244, 0.55))",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.filter =
                        "brightness(1.3) contrast(1.2) drop-shadow(0 0 22px rgba(255, 123, 198, 0.95))";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0.92";
                      e.currentTarget.style.filter =
                        "brightness(1.18) contrast(1.15) drop-shadow(0 0 12px rgba(163, 216, 244, 0.55))";
                    }}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mt-6 md:mt-8 text-xs md:text-sm text-white/50"
        >
          Powered by the world&apos;s best AI models.
        </motion.p>
      </div>
    </section>
  );
}

