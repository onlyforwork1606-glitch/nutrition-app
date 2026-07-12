import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { BufferGeometry, BufferAttribute, type Points, type Mesh } from "three";

const TEX = {
  day: "https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_atmos_2048.jpg",
  normal: "https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_normal_2048.jpg",
  clouds: "https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_clouds_1024.png",
};

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMO_FRAG = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
    gl_FragColor = vec4(0.30, 0.60, 1.0, 1.0) * intensity;
  }
`;

function Earth() {
  const [day, normal, clouds] = useTexture([TEX.day, TEX.normal, TEX.clouds]);
  const globe = useRef<Mesh>(null);
  const cloud = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (globe.current) globe.current.rotation.y += delta * 0.03;
    if (cloud.current) cloud.current.rotation.y += delta * 0.045;
  });

  return (
    <group rotation={[0, 0, 0.41]}>
      {/* Surface */}
      <mesh ref={globe}>
        <sphereGeometry args={[2.6, 96, 96]} />
        <meshStandardMaterial
          map={day}
          normalMap={normal}
          normalScale={new THREE.Vector2(0.85, 0.85)}
          metalness={0.05}
          roughness={0.85}
        />
      </mesh>

      {/* Clouds */}
      <mesh ref={cloud} scale={1.012}>
        <sphereGeometry args={[2.6, 96, 96]} />
        <meshStandardMaterial
          map={clouds}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>

      {/* Atmosphere glow */}
      <mesh scale={1.16}>
        <sphereGeometry args={[2.6, 64, 64]} />
        <shaderMaterial
          vertexShader={ATMO_VERT}
          fragmentShader={ATMO_FRAG}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------ starfield -------------------------------- */

function Stars({ count = 900 }: { count?: number }) {
  const geom = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 14 + Math.random() * 16;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi) - 10;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(arr, 3));
    return g;
  }, [count]);

  const ref = useRef<Points>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.006;
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial size={0.06} color="#ffffff" transparent opacity={0.7} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* --------------------------------- scene ---------------------------------- */

function Scene() {
  return (
    <group>
      {/* Sun + soft fill so we get a real day/night terminator */}
      <ambientLight intensity={0.12} />
      <directionalLight position={[6, 3, 5]} intensity={2.4} color="#fff6e8" />
      <directionalLight position={[-5, -2, -4]} intensity={0.25} color="#3b82f6" />

      <Suspense fallback={null}>
        <Earth />
      </Suspense>

      <Stars count={900} />
    </group>
  );
}

export function ThreeBackground({ reduceMotion = false }: { reduceMotion?: boolean }) {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 12], fov: 50 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true }}
        frameloop={reduceMotion ? "demand" : "always"}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
