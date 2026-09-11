import { useEffect, useRef, useState } from 'react';
import { createRenderer } from './optimized-black-hole-utils/renderer';

/**
 * Pure-CSS black-hole visual — no WebGL required. Used whenever the WebGL
 * renderer can't run (GPU disabled, driver rejects the shader, browser has
 * no WebGL support, etc.) so the background never degrades to flat black.
 */
function CssBlackHoleFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
      <style>{`
        @keyframes obh-spin { to { transform: rotate(360deg); } }
        @keyframes obh-twinkle { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.9; } }
      `}</style>

      {/* starfield */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(1.5px 1.5px at 10% 20%, #fff, transparent),
            radial-gradient(1.5px 1.5px at 80% 15%, #fff, transparent),
            radial-gradient(1px 1px at 30% 70%, #fff, transparent),
            radial-gradient(1px 1px at 65% 85%, #fff, transparent),
            radial-gradient(1.5px 1.5px at 90% 60%, #fff, transparent),
            radial-gradient(1px 1px at 45% 35%, #fff, transparent),
            radial-gradient(1px 1px at 20% 90%, #fff, transparent),
            radial-gradient(1.5px 1.5px at 55% 10%, #fff, transparent)
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: '600px 600px',
          animation: 'obh-twinkle 4s ease-in-out infinite',
        }}
      />

      {/* rotating accretion disk glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: 'min(60vw, 60vh)',
          height: 'min(60vw, 60vh)',
          background: 'conic-gradient(from 0deg, #ff6a1a, #ffd699, #ff6a1a 40%, #1a0f24 60%, #ff6a1a)',
          filter: 'blur(28px)',
          opacity: 0.55,
          animation: 'obh-spin 18s linear infinite',
        }}
      />

      {/* photon ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 'min(26vw, 26vh)',
          height: 'min(26vw, 26vh)',
          boxShadow: '0 0 40px 12px rgba(255, 210, 160, 0.55)',
          border: '2px solid rgba(255, 220, 180, 0.8)',
        }}
      />

      {/* event horizon core */}
      <div
        className="absolute rounded-full bg-black"
        style={{ width: 'min(22vw, 22vh)', height: 'min(22vw, 22vh)' }}
      />

      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, #000 90%)' }}
      />
    </div>
  );
}

/** Standalone animated black-hole background — WebGL when available, CSS otherwise. */
export function OptimizedBlackHole() {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'webgl' | 'css'

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // createRenderer is defensive internally, but guard the call site too —
    // this background must never be able to crash the page that hosts it.
    let renderer;
    try {
      renderer = createRenderer({ canvas });
    } catch (err) {
      console.warn('[optimized-black-hole] Failed to initialize, using CSS fallback:', err);
      if (!cancelled) setStatus('css');
      return;
    }

    renderer.ready
      .then(() => {
        if (!cancelled) setStatus(renderer.ok ? 'webgl' : 'css');
      })
      .catch(() => {
        if (!cancelled) setStatus('css');
      });

    return () => {
      cancelled = true;
      try {
        renderer.dispose();
      } catch (err) {
        // ignore cleanup failures
      }
    };
  }, []);

  if (status === 'css') {
    return <CssBlackHoleFallback />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className={`block h-full w-full touch-none transition-opacity duration-500 ${
          status === 'webgl' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}

export default OptimizedBlackHole;
