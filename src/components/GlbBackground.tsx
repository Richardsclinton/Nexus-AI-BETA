"use client";

import { useRef, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const GLB_PATH = "/glb/brain_hologram.glb";

if (typeof window !== "undefined") {
  useGLTF.preload(GLB_PATH);
}

function BrainMesh() {
  const { scene } = useGLTF(GLB_PATH);
  const modelRef = useRef<THREE.Group>(null);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  useMemo(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        child.material = new THREE.MeshStandardMaterial({
          // base sombre neutre
          color: "#020617",
          // émissif gris clair pour un rendu holographique neutre
          emissive: "#9ca3af",
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.9,
          roughness: 0.4,
          metalness: 0.5,
        });
      }
    });
  }, [clonedScene]);

  useFrame((_, delta) => {
    if (!modelRef.current) return;
    modelRef.current.rotation.y += delta * 0.18;
    modelRef.current.position.y = Math.sin(performance.now() / 1200) * 0.06;
  });

  return (
    <group ref={modelRef}>
      <primitive object={clonedScene} position={[0, 0, 0]} scale={[1.2, 1.2, 1.2]} />
    </group>
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.25} />
      {/* key light gris froid */}
      <spotLight
        position={[0, 3, 6]}
        angle={0.5}
        penumbra={0.8}
        intensity={1.1}
        color="#e5e7eb"
      />
      {/* rim light gris bleuté */}
      <spotLight
        position={[-3, 1.5, -2]}
        angle={0.7}
        penumbra={0.9}
        intensity={0.7}
        color="#9ca3af"
      />
      <Suspense fallback={null}>
        <BrainMesh />
      </Suspense>
    </>
  );
}

function GlbBackgroundCanvas() {
  return (
      <Canvas
      camera={{ position: [0, 0.7, 4.2], fov: 50 }}
      className="fixed inset-0 w-full h-full"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(ellipse 120% 140% at 50% 0%, rgba(75, 85, 99, 0.55) 0%, rgba(17, 24, 39, 1) 45%, rgba(0, 0, 0, 1) 80%)",
        zIndex: 0,
        pointerEvents: "none",
      }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
      }}
    >
      <Scene />
    </Canvas>
  );
}

export default function GlbBackground() {
  const DynamicCanvas = useMemo(
    () =>
      dynamic(() => Promise.resolve(GlbBackgroundCanvas), {
        ssr: false,
        loading: () => null,
      }),
    []
  );

  return (
    <>
      <DynamicCanvas />
    </>
  );
}

