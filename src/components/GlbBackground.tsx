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
          color: "#050816",
          emissive: "#A3D8F4",
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.9,
          roughness: 0.35,
          metalness: 0.6,
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
      <spotLight
        position={[0, 3, 6]}
        angle={0.5}
        penumbra={0.8}
        intensity={1.2}
        color="#A3D8F4"
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
          "radial-gradient(ellipse 110% 120% at 50% 0%, rgba(10, 20, 40, 0.9) 0%, rgba(0, 0, 0, 0.98) 60%)",
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

