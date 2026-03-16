"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

interface NeuralLineConnectorProps {
  sectionRefs: React.RefObject<HTMLElement>[];
  className?: string;
}

export default function NeuralLineConnector({ 
  sectionRefs, 
  className = "" 
}: NeuralLineConnectorProps) {
  const [pathData, setPathData] = useState<string>("");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  
  // Animate path length based on scroll
  const pathLength = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, 1]),
    { stiffness: 100, damping: 30 }
  );

  // Calculate path based on section positions
  useEffect(() => {
    const calculatePath = () => {
      if (sectionRefs.length === 0) {
        setPathData("");
        return;
      }

      const validRefs = sectionRefs.filter(ref => ref.current);
      if (validRefs.length === 0) {
        setPathData("");
        return;
      }

      const points: { x: number; y: number }[] = [];
      const documentHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );

      // Helper function to get absolute position
      const getAbsolutePosition = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
        return {
          top: rect.top + scrollY,
          left: rect.left + scrollX,
          width: rect.width,
          height: rect.height
        };
      };

      validRefs.forEach((ref, index) => {
        const element = ref.current;
        if (!element) return;

        const pos = getAbsolutePosition(element);
        const centerX = pos.left + pos.width / 2;
        const curveOffset = Math.min(pos.width * 0.4, 200);

        if (index === 0) {
          // Start point above first card
          points.push({ 
            x: centerX, 
            y: Math.max(100, pos.top - 150) 
          });
        }
        
        // Top left curve
        points.push({ 
          x: centerX - curveOffset, 
          y: pos.top 
        });
        
        // Top center (slight curve)
        points.push({ 
          x: centerX - curveOffset * 0.3, 
          y: pos.top + pos.height * 0.1 
        });
        
        // Middle
        points.push({ 
          x: centerX, 
          y: pos.top + pos.height / 2 
        });
        
        // Bottom center (slight curve)
        points.push({ 
          x: centerX + curveOffset * 0.3, 
          y: pos.top + pos.height * 0.9 
        });
        
        // Bottom right curve
        points.push({ 
          x: centerX + curveOffset, 
          y: pos.top + pos.height 
        });
      });

      if (points.length < 2) {
        setPathData("");
        return;
      }

      // Create smooth SVG path using quadratic bezier curves
      let path = `M ${points[0].x} ${points[0].y}`;
      
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const currentPoint = points[i];
        const nextPoint = points[i + 1];
        
        if (nextPoint) {
          // Use quadratic bezier for smoother curves
          // Control point is between current and next point
          const controlX = (currentPoint.x + nextPoint.x) / 2;
          const controlY = currentPoint.y;
          
          path += ` Q ${controlX} ${controlY} ${currentPoint.x} ${currentPoint.y}`;
        } else {
          // Last point - smooth curve to it
          const controlX = (prevPoint.x + currentPoint.x) / 2;
          const controlY = prevPoint.y + (currentPoint.y - prevPoint.y) * 0.8;
          
          path += ` Q ${controlX} ${controlY} ${currentPoint.x} ${currentPoint.y}`;
        }
      }

      // Use full document dimensions for viewBox
      const docWidth = Math.max(
        document.documentElement.scrollWidth,
        window.innerWidth
      );
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );

      setPathData(path);
      setDimensions({ 
        width: docWidth,
        height: docHeight,
        x: 0,
        y: 0
      });
    };

    // Initial calculation
    const timeoutId = setTimeout(calculatePath, 100);

    // Recalculate on scroll and resize
    const handleUpdate = () => {
      requestAnimationFrame(calculatePath);
    };

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, { passive: true });

    // Observe sections for changes
    const observers: IntersectionObserver[] = [];
    sectionRefs.forEach((ref) => {
      const element = ref.current;
      if (!element) return;

      const observer = new IntersectionObserver(
        () => {
          requestAnimationFrame(calculatePath);
        },
        { threshold: [0, 0.5, 1] }
      );
      observer.observe(element);
      observers.push(observer);
    });

    // Periodic update to catch dynamic changes
    const interval = setInterval(calculatePath, 1000);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate);
      observers.forEach((observer) => observer.disconnect());
      clearInterval(interval);
    };
  }, [sectionRefs]);

  // Glow intensity based on scroll progress
  const glowOpacity = useTransform(
    scrollYProgress,
    [0, 0.2, 0.8, 1],
    [0.4, 0.9, 0.9, 0.4]
  );

  // Derived opacity values - must be declared unconditionally
  const outerGlowOpacity = useTransform(glowOpacity, (val) => val * 0.25);
  const innerCoreOpacity = useTransform(glowOpacity, (val) => Math.min(val * 1.4, 1));

  if (!pathData || dimensions.width === 0) {
    return null;
  }

  const content = (
    <div 
      ref={containerRef}
      className={`fixed inset-0 pointer-events-none z-[4] overflow-visible ${className}`}
      style={{ overflow: "visible" }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${dimensions.x} ${dimensions.y} ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="none"
        className="absolute top-0 left-0"
        style={{ 
          overflow: "visible",
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          {/* Glow filter */}
          <filter id="neon-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Outer glow */}
          <filter id="neon-glow-outer" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
          </filter>
          
          {/* Gradient */}
          <linearGradient id="neon-line-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF7BC6" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#FF7BC6" stopOpacity="1" />
            <stop offset="100%" stopColor="#A3D8F4" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Outer glow layer */}
        <motion.path
          d={pathData}
          fill="none"
          stroke="url(#neon-line-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#neon-glow-outer)"
          style={{
            pathLength,
            opacity: outerGlowOpacity,
          }}
        />

        {/* Main neon line */}
        <motion.path
          d={pathData}
          fill="none"
          stroke="url(#neon-line-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#neon-glow-filter)"
          style={{
            pathLength,
            opacity: glowOpacity,
          }}
        />

        {/* Inner bright core */}
        <motion.path
          d={pathData}
          fill="none"
          stroke="#FF7BC6"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            pathLength,
            opacity: innerCoreOpacity,
          }}
        />
      </svg>
    </div>
  );

  // Rendu dans body pour éviter d'être coupé par le conteneur scale(0.8)
  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
