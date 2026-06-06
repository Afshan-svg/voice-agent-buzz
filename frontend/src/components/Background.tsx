import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { VoiceState } from '../hooks/useSofia';

interface BackgroundProps {
  voiceState: VoiceState;
}

export function Background({ voiceState }: BackgroundProps) {
  const particlesRef = useRef<THREE.Points>(null);
  const dustRef = useRef<THREE.Points>(null);
  const { pointer } = useThree();

  const { positions, colors, dustPositions } = useMemo(() => {
    const count = 800;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const dust = new Float32Array(400 * 3);
    const c1 = new THREE.Color('#0f172a');
    const c2 = new THREE.Color('#312e81');
    const c3 = new THREE.Color('#1e3a8a');

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 4;
      const mix = c1.clone().lerp(Math.random() > 0.5 ? c2 : c3, Math.random() * 0.6);
      col[i * 3] = mix.r;
      col[i * 3 + 1] = mix.g;
      col[i * 3 + 2] = mix.b;
    }
    for (let i = 0; i < 400; i++) {
      dust[i * 3] = (Math.random() - 0.5) * 30;
      dust[i * 3 + 1] = (Math.random() - 0.5) * 20;
      dust[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return { positions: pos, colors: col, dustPositions: dust };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const parallaxX = pointer.x * 0.3;
    const parallaxY = pointer.y * 0.2;

    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.03 + parallaxX * 0.1;
      particlesRef.current.rotation.x = t * 0.015 + parallaxY * 0.08;
      particlesRef.current.position.x = THREE.MathUtils.lerp(particlesRef.current.position.x, parallaxX, 0.02);
      particlesRef.current.position.y = THREE.MathUtils.lerp(particlesRef.current.position.y, parallaxY, 0.02);
    }
    if (dustRef.current) {
      dustRef.current.rotation.z = t * 0.01;
      dustRef.current.position.x = parallaxX * 0.5;
    }
  });

  const accent = voiceState === 'speaking' ? '#3b82f6' : voiceState === 'listening' ? '#10b981' : voiceState === 'thinking' ? '#8b5cf6' : '#6366f1';

  return (
    <>
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 6, 18]} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 8, 5]} intensity={0.35} color="#e2e8f0" />
      <pointLight position={[0, 0, 4]} intensity={0.6} color={accent} distance={12} />
      <pointLight position={[-6, -4, 2]} intensity={0.25} color="#4c1d95" distance={10} />

      <mesh position={[0, 0, -8]} rotation={[0, 0, 0]}>
        <planeGeometry args={[40, 30]} />
        <meshBasicMaterial color="#0b1120" transparent opacity={0.5} />
      </mesh>

      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.04} vertexColors transparent opacity={0.55} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>

      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.015} color="#64748b" transparent opacity={0.25} sizeAttenuation depthWrite={false} />
      </points>
    </>
  );
}
