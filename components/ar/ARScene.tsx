"use client";

import { Canvas } from "@react-three/fiber";
import { XR, createXRStore, XRControllerModel, XRHandModel } from '@react-three/xr';
import { PerspectiveCamera, OrbitControls, Environment, Sky, Stars } from "@react-three/drei";
import { useState, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getVisibleBuildings } from "@/lib/arGeo";
import BuildingLabel from "./BuildingLabel";

interface ARSceneProps {
  userLocation: { lat: number; lng: number } | null;
  heading: number | null;
  isDemo: boolean;
  debugMode?: boolean;
}

function SceneContent({ userLocation, heading, isDemo, debugMode }: ARSceneProps) {
  const [visibleBuildings, setVisibleBuildings] = useState<any[]>([]);
  const lastUpdateRef = useRef<number>(0);

  // Update visible buildings when location or heading changes
  useEffect(() => {
    if (!userLocation || heading === null) return;

    // Throttled updates for performance
    const now = Date.now();
    if (now - lastUpdateRef.current < 500) return;
    lastUpdateRef.current = now;

    const buildings = getVisibleBuildings(
      userLocation.lat,
      userLocation.lng,
      heading,
      500, // maxDistance
      10,  // maxResults
      75   // fov
    );
    setVisibleBuildings(buildings);
  }, [userLocation, heading]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.6, 0]} />
      {isDemo && <OrbitControls target={[0, 1.6, -5]} />}
      
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      {isDemo && (
        <>
          <Sky sunPosition={[100, 20, 100]} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <Environment preset="night" />
        </>
      )}

      {/* AuraLens Grounding Matrix */}
      <gridHelper 
        args={[100, 100, "#4f46e5", "#1e1b4b"]} 
        position={[0, -0.01, 0]} 
        rotation={[0, 0, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial 
          color="#000" 
          transparent 
          opacity={0.4} 
        />
      </mesh>

      {/* Building Labels */}
      {visibleBuildings.map((building) => (
        <BuildingLabel 
          key={building.id} 
          building={building} 
          isDemo={isDemo}
        />
      ))}

      {debugMode && (
        <mesh position={[0, 1.6, -5]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="red" />
        </mesh>
      )}
    </>
  );
}


export default function ARScene(props: ARSceneProps) {
  const [isClient, setIsClient] = useState(false);
  const store = useMemo(() => createXRStore({
    depthSensing: true,
    handTracking: true,
  }), []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <div className="fixed inset-0 w-full h-full cursor-none">
      {/* WebXR Enter Button */}
      {!props.isDemo && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60]">
          <button 
            onClick={() => store.enterAR()}
            className="bg-white text-black px-10 py-4 rounded-full font-black uppercase tracking-tighter shadow-3xl hover:bg-neutral-200 transition-all"
          >
            START AR VIEW
          </button>
        </div>
      )}

      <Canvas
        shadows
        gl={{ 
          antialias: true, 
          alpha: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping 
        }}
      >
        <XR store={store}>
          <SceneContent {...props} />
          <XRControllerModel />
          <XRHandModel />
        </XR>
      </Canvas>
    </div>
  );
}
