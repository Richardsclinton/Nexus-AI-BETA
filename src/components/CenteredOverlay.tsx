"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type CenteredOverlayProps = {
  isOpen: boolean;
  title: string;
  message: string;
  primaryLabel?: string;
  /** Désactive le bouton principal (ex. pendant un paiement en cours). */
  primaryDisabled?: boolean;
  /** Centre le titre au lieu de l’aligner à gauche. */
  titleCentered?: boolean;
  autoHideMs?: number;
  onPrimary?: () => void;
  onClose: () => void;
  /** Si fourni, affiché à la place de message (pour formulaire txHash etc.). */
  children?: ReactNode;
  /** Si fourni, remplace la zone du bouton principal. Peut être un nœud ou une fonction recevant onPrimary (ex. bouton Retry). */
  footer?: ReactNode | ((onPrimary: () => void) => ReactNode);
};

export function CenteredOverlay({
  isOpen,
  title,
  message,
  primaryLabel = "Close",
  primaryDisabled = false,
  titleCentered = false,
  autoHideMs = 5000,
  onPrimary,
  onClose,
  children,
  footer,
}: CenteredOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKey);

    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }

    let timer: number | undefined;
    if (autoHideMs && autoHideMs > 0) {
      timer = window.setTimeout(onClose, autoHideMs);
    }

    return () => {
      window.removeEventListener("keydown", handleKey);
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [isOpen, autoHideMs, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-black/90 backdrop-blur-lg p-8 shadow-2xl"
          >
            <div className={`relative mb-4 ${titleCentered ? "flex flex-col items-center text-center" : "flex justify-between items-start"}`}>
              <h3 className="text-lg md:text-xl font-semibold text-white">
                {title}
              </h3>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className={`absolute top-0 right-0 text-white/60 hover:text-white text-sm ${titleCentered ? "" : "ml-4"}`}
                aria-label="Close payment confirmation"
              >
                ✕
              </button>
            </div>
            {children != null ? (
              <div className="text-sm md:text-base text-white/80 mb-6 max-h-[12rem] overflow-y-auto">{children}</div>
            ) : (
              <p className="text-sm md:text-base text-white/80 mb-6">
                {message}
              </p>
            )}
            {footer != null ? (
              <div className="mt-4">
                {typeof footer === "function" ? footer(onPrimary ?? onClose) : footer}
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  onClick={onPrimary ?? onClose}
                  disabled={primaryDisabled}
                  className="px-5 py-2.5 rounded-xl bg-neon-pink/80 hover:bg-neon-pink text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {primaryLabel}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

