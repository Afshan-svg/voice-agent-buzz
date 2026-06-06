import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { VoiceState } from '../hooks/useSofia';

interface OrbProps {
  voiceState: VoiceState;
  volume: number;
  inputVolume: number;
  waveformBands: number[];
  active: boolean;
}

function ListeningRipples({ active, inputVolume }: { active: boolean; inputVolume: number }) {
  const ripples = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    if (!active) return;
    ripples.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = state.clock.elapsedTime;
      const phase = (t * 1.2 + i * 0.6) % 2;
      const scale = 1.15 + phase * 0.35 + inputVolume * 0.2;
      mesh.scale.setScalar(scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.35 - phase * 0.18);
    });
  });

  if (!active) return null;

  return (
    <>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => { ripples.current[i] = el; }}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color="#34d399" transparent opacity={0.2} wireframe />
        </mesh>
      ))}
    </>
  );
}

function WaveformRing({ bands, active, volume }: { bands: number[]; active: boolean; volume: number }) {
  const lineRef = useRef<THREE.Line>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  const initial = useMemo(() => {
    const arr = new Float32Array(65 * 3);
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      arr[i * 3] = Math.cos(angle) * 1.35;
      arr[i * 3 + 1] = Math.sin(angle) * 1.35;
    }
    return arr;
  }, []);

  useFrame(() => {
    if (!lineRef.current || !active || !geometryRef.current) return;
    const pos = geometryRef.current.attributes.position as THREE.BufferAttribute;
    const baseRadius = 1.35 + volume * 0.15;
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      const band = bands[i % bands.length] ?? 0;
      const r = baseRadius + band * 0.45;
      pos.setXYZ(i, Math.cos(angle) * r, Math.sin(angle) * r, 0);
    }
    pos.needsUpdate = true;
  });

  if (!active) return null;

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <line ref={lineRef as any}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[initial, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#60a5fa" transparent opacity={0.75} />
    </line>
  );
}

export function Orb({ voiceState, volume, inputVolume, waveformBands, active }: OrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<unknown>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const currentScale = useRef(new THREE.Vector3(1, 1, 1));

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    let scaleMultiplier = active ? 1 + Math.sin(time * 1.5) * 0.04 : 0.85 + Math.sin(time * 1.2) * 0.02;
    let distort = active ? 0.28 : 0.18;
    let speed = active ? 1.8 : 1.2;
    let color = new THREE.Color('#6366f1');
    let glowOpacity = active ? 0.12 : 0.06;

    if (voiceState === 'listening') {
      scaleMultiplier = 1.05 + inputVolume * 0.18 + Math.sin(time * 3) * 0.04;
      distort = 0.38 + inputVolume * 0.15;
      speed = 3.5;
      color = new THREE.Color('#10b981');
      glowOpacity = 0.2 + inputVolume * 0.2;
    } else if (voiceState === 'thinking') {
      scaleMultiplier = 1 + Math.sin(time * 4) * 0.03;
      distort = 0.55;
      speed = 5.5;
      color = new THREE.Color('#8b5cf6');
      glowOpacity = 0.18;
    } else if (voiceState === 'speaking') {
      scaleMultiplier = 1 + volume * 0.35;
      distort = 0.42 + volume * 0.45;
      speed = 4 + volume * 6;
      color = new THREE.Color('#3b82f6');
      glowOpacity = 0.15 + volume * 0.35;
    }

    targetScale.setScalar(scaleMultiplier);
    currentScale.current.lerp(targetScale, 0.12);
    meshRef.current?.scale.copy(currentScale.current);

    if (materialRef.current) {
      const mat = materialRef.current as { distort: number; speed: number; color: THREE.Color };
      mat.distort = THREE.MathUtils.lerp(mat.distort, distort, 0.12);
      mat.speed = THREE.MathUtils.lerp(mat.speed, speed, 0.12);
      mat.color.lerp(color, 0.1);
    }

    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, glowOpacity, 0.1);
      glowRef.current.scale.setScalar(currentScale.current.x * 1.15);
    }
  });

  return (
    <group position={[0, active ? 0 : -0.3, 0]} scale={active ? 1 : 0.7}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.08, 32, 32]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.06} depthWrite={false} />
      </mesh>

      <Sphere ref={meshRef} args={[1, 128, 128]}>
        <MeshDistortMaterial
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={materialRef as any}
          color="#6366f1"
          envMapIntensity={0.8}
          clearcoat={0.9}
          clearcoatRoughness={0.05}
          metalness={0.85}
          roughness={0.15}
          distort={0.18}
          speed={1.2}
          transparent
          opacity={active ? 1 : 0.35}
        />
      </Sphere>

      {active && (
        <>
          <ListeningRipples active={voiceState === 'listening'} inputVolume={inputVolume} />
          <WaveformRing bands={waveformBands} active={voiceState === 'speaking' || volume > 0.05} volume={volume} />
        </>
      )}

      <spotLight position={[0, 4, 6]} angle={0.4} penumbra={0.8} intensity={active ? 1.2 : 0.5} color="#ffffff" />
      <pointLight position={[3, 2, 4]} intensity={active ? 0.8 : 0.3} color="#818cf8" />
      <pointLight position={[-4, -2, 3]} intensity={0.3} color="#312e81" />
    </group>
  );
}
