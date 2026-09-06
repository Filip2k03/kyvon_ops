import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useGLTF } from '@react-three/drei';
import type { Group } from 'three';
import { STATES, type CharacterState, type Pet } from './character';

/**
 * The 3D companion viewer.
 *
 * Three things this deliberately does not do:
 *
 * * It does not load on import. The canvas mounts only once the section is on
 *   screen, so a visitor reading the headline is not paying for WebGL.
 * * It does not assume WebGL exists. Where it is unavailable — old hardware,
 *   a locked-down browser, a headless test — the fallback is shown, not a
 *   blank rectangle.
 * * It does not animate when the visitor has asked it not to.
 *   `prefers-reduced-motion` stops the idle loop and the auto-rotate.
 */

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

function Model({ url, animate }: { url: string; animate: boolean }) {
  const { scene } = useGLTF(url);
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (animate && ref.current) ref.current.rotation.y += delta * 0.25;
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

export function PetViewer({ pet, state = 'idle' }: { pet: Pet; state?: CharacterState }) {
  const [visible, setVisible] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();
  const presentation = STATES[state];

  useEffect(() => {
    setWebgl(hasWebGL());
    const node = holder.current;
    if (!node) return;
    // Only pay for the scene when it is actually about to be seen.
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const showCanvas = visible && webgl === true;

  return (
    <div
      ref={holder}
      className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60"
    >
      {/* The state is announced, not merely coloured. */}
      <p role="status" className="sr-only">
        {presentation.announce}
      </p>

      {showCanvas ? (
        <Canvas camera={{ position: [0, 0.6, 6], fov: 35 }} dpr={[1, 1.75]}>
          <ambientLight intensity={0.75} />
          <directionalLight position={[3, 4, 2]} intensity={1.5} />
          <directionalLight position={[-3, 1, -2]} intensity={0.6} color="#38bdf8" />
          <Suspense fallback={null}>
            {/*
              `Bounds` frames whatever it wraps, and `Center` puts the model's
              own centre at the origin. Together they keep every companion
              fully in frame regardless of its proportions — a fixed camera
              cropped the taller silhouettes, and the roster deliberately
              varies them.
            */}
            <Bounds fit clip observe margin={1.15}>
              <Center>
                <Model url={pet.model} animate={!reduced} />
              </Center>
            </Bounds>
          </Suspense>
          <OrbitControls
            makeDefault
            enablePan={false}
            enableZoom
            autoRotate={false}
            minDistance={2.5}
            maxDistance={12}
          />
        </Canvas>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <div
            aria-hidden="true"
            className="h-16 w-16 rounded-2xl border border-sky-400/30 bg-sky-400/10"
          />
          <p className="text-sm font-medium text-slate-200">{pet.name}</p>
          <p className="max-w-xs text-xs leading-relaxed text-slate-400">
            {webgl === false
              ? '3D preview needs WebGL, which this browser does not provide. Everything else on this page works normally.'
              : 'Preview loads when it scrolls into view.'}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 text-[11px]">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-400" />
        <span className="text-slate-300">{presentation.label}</span>
      </div>
    </div>
  );
}

// Preloading is deliberately not called at module scope; see the note above.
export const preloadPet = (url: string) => useGLTF.preload(url);
