import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { useSofia } from './hooks/useSofia';
import { Background } from './components/Background';
import { Orb } from './components/Orb';
import { Header } from './components/Header';
import { ReceptionistHero } from './components/ReceptionistHero';
import { TranscriptPanel } from './components/TranscriptPanel';
import { Controls, Metrics } from './components/Controls';
import { SuggestedPrompts } from './components/SuggestedPrompts';
import { VoiceStateBadge } from './components/VoiceStateBadge';
import { CanvasWaveform } from './components/CanvasWaveform';

export default function Demo() {
  const {
    connectionState,
    voiceState,
    isMuted,
    transcript,
    duration,
    volume,
    inputVolume,
    waveformBands,
    connect,
    disconnect,
    toggleMute,
  } = useSofia();

  const connected = connectionState === 'connected';
  const showPrompts = connected && transcript.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="relative w-full min-h-[100dvh] overflow-hidden bg-[#020617] font-sans text-slate-100 selection:bg-indigo-500/30"
    >
      {/* Ambient gradient overlays */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.15),transparent)]" />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(76,29,149,0.12),transparent)]" />

      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 5.2], fov: 42 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          shadows
        >
          <Suspense fallback={null}>
            <Background voiceState={voiceState} />
            <Orb
              voiceState={voiceState}
              volume={volume}
              inputVolume={inputVolume}
              waveformBands={waveformBands}
              active={connected}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* 2D waveform ring overlay */}
      <CanvasWaveform
        waveformBands={waveformBands}
        voiceState={voiceState}
        volume={volume}
        inputVolume={inputVolume}
        active={connected}
      />

      <Header connectionState={connectionState} />

      <AnimatePresence>{!connected && <ReceptionistHero />}</AnimatePresence>

      <VoiceStateBadge voiceState={voiceState} connectionState={connectionState} duration={duration} />
      <TranscriptPanel transcript={transcript} connected={connected} />
      <Metrics />

      <AnimatePresence>{showPrompts && <SuggestedPrompts visible={showPrompts} />}</AnimatePresence>

      <Controls
        connectionState={connectionState}
        isMuted={isMuted}
        onConnect={connect}
        onDisconnect={disconnect}
        onToggleMute={toggleMute}
      />
    </motion.div>
  );
}
