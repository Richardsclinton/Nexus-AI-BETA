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
    <section className="relative w-full py-10 md:py-12 overflow-hidden">
      {/* Texte au-dessus */}
      <div className="text-center mb-6 md:mb-8 px-4" />

      {/* Container de la bande avec effet fade */}
      <div className="relative w-full">
        <div
          className="absolute left-0 top-0 bottom-0 w-32 md:w-48 z-10 pointer-events-none"
          style={{
            background: "linear-gradient(to right, rgba(0, 0, 0, 0.8) 0%, transparent 100%)",
          }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-32 md:w-48 z-10 pointer-events-none"
          style={{
            background: "linear-gradient(to left, rgba(0, 0, 0, 0.8) 0%, transparent 100%)",
          }}
        />

        {/* Bande de logos animée — minimaliste & luxueuse */}
        <div className="flex overflow-hidden border-y border-white/10 bg-black/30 py-2">
          <motion.div
            className="flex gap-8 md:gap-10 lg:gap-12 py-4 md:py-5"
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
                  scale: 1.15,
                  opacity: 1,
                }}
                initial={{ opacity: 0.85 }}
                style={{
                  width: "56px",
                  height: "56px",
                  transition: "all 0.3s ease",
                }}
              >
                <Image
                  src={logo.path}
                  alt={logo.name}
                  width={100}
                  height={100}
                  className="object-contain w-full h-full"
                  style={{
                    opacity: 0.9,
                    filter:
                      "brightness(1.15) contrast(1.1) drop-shadow(0 0 8px rgba(163, 216, 244, 0.45))",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.filter =
                        "brightness(1.3) contrast(1.15) drop-shadow(0 0 18px rgba(255, 123, 198, 0.9))";
                  }}
                  onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0.9";
                      e.currentTarget.style.filter =
                        "brightness(1.15) contrast(1.1) drop-shadow(0 0 10px rgba(163, 216, 244, 0.45))";
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
        className="text-center mt-8 md:mt-12 text-sm md:text-base text-white/50 px-4"
      >
        Powered by the world&apos;s best AI models.
      </motion.p>
    </section>
  );
}

