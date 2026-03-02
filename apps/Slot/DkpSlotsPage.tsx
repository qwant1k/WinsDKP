import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
interface SpinResult {
  tier: string; label: string; symbol: string;
  multiplier: number; payout: number; net: number;
  spinHash: string; seed: string; remainingBalance: number;
}
interface LogEntry {
  id: string; tier: string; multiplier: number; payout: number; createdAt: string;
  user: { id: string; username: string; avatarUrl?: string };
}
interface PayoutInfo {
  bet: number;
  tiers: { id: string; label: string; symbol: string; multiplier: number; payout: number; chance: string }[];
}

/* ═══════════════════════════════════════════════════════════
   TIER CONFIG  — symbol glyphs drawn on canvas reels
═══════════════════════════════════════════════════════════ */
const TC: Record<string, { glyph: string; color: string; glow: string; rank: number }> = {
  skull:   { glyph: '☠',  color: '#ef4444', glow: 'rgba(239,68,68,0.7)',    rank: 0 },
  sword:   { glyph: '⚔',  color: '#94a3b8', glow: 'rgba(148,163,184,0.6)', rank: 1 },
  moon:    { glyph: '☽',  color: '#fbbf24', glow: 'rgba(251,191,36,0.65)',  rank: 2 },
  star:    { glyph: '✦',  color: '#4ade80', glow: 'rgba(74,222,128,0.65)',  rank: 3 },
  diamond: { glyph: '◈',  color: '#60a5fa', glow: 'rgba(96,165,250,0.7)',   rank: 4 },
  crystal: { glyph: '✸',  color: '#e879f9', glow: 'rgba(232,121,249,0.8)',  rank: 5 },
};
const SYMBOLS = ['skull','sword','moon','star','diamond','crystal'];

/* ═══════════════════════════════════════════════════════════
   GLOBAL CSS
═══════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

.sl-root,  .sl-root *, .sl-root *::before, .sl-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── viewport lock ── */
.sl-root {
  position: fixed; inset: 0; overflow: hidden;
  background: #080610;
  font-family: 'Rajdhani', sans-serif;
  color: #e2e8f0;
  display: flex; flex-direction: column;
}

/* ── animated bg grid ── */
.sl-bg {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    linear-gradient(rgba(232,121,249,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(232,121,249,0.03) 1px, transparent 1px);
  background-size: 48px 48px;
  animation: bg-scroll 20s linear infinite;
}
@keyframes bg-scroll { to { background-position: 48px 48px; } }

.sl-bg-glow {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(ellipse 70% 50% at 50% -5%,  rgba(109,40,217,0.18) 0%, transparent 70%),
    radial-gradient(ellipse 40% 40% at 10% 100%, rgba(232,121,249,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 40% 40% at 90% 100%, rgba(96,165,250,0.08)  0%, transparent 60%);
}

/* ── header ── */
.sl-header {
  position: relative; z-index: 2; flex-shrink: 0;
  height: 60px; padding: 0 28px;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid rgba(232,121,249,0.12);
  background: rgba(8,6,16,0.8); backdrop-filter: blur(10px);
}
.sl-logo {
  font-family: 'Orbitron', monospace; font-weight: 900;
  font-size: clamp(14px, 2vw, 20px); letter-spacing: 0.12em;
  background: linear-gradient(90deg, #c084fc, #e879f9, #fff, #e879f9, #c084fc);
  background-size: 200% auto;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  animation: shimmer 3s linear infinite;
  text-transform: uppercase;
}
@keyframes shimmer { to { background-position: 200% center; } }

.sl-bal-wrap { text-align: right; }
.sl-bal-lbl  { font-family: 'Orbitron', monospace; font-size: 9px; letter-spacing: 0.2em; color: #3d2a5a; text-transform: uppercase; margin-bottom: 1px; }
.sl-bal-val  { font-family: 'Orbitron', monospace; font-size: clamp(16px,2.5vw,24px); font-weight: 700; color: #e879f9; text-shadow: 0 0 18px rgba(232,121,249,0.6); line-height: 1; }

/* ── body ── */
.sl-body {
  position: relative; z-index: 1; flex: 1; min-height: 0;
  display: grid; grid-template-columns: 1fr 320px;
  gap: 20px; padding: 16px 22px 16px;
}

/* ── left column ── */
.sl-left { display: flex; flex-direction: column; align-items: center; gap: 14px; min-height: 0; }

/* ── cabinet ── */
.sl-cabinet {
  position: relative; flex-shrink: 0;
  padding: 20px 28px 16px;
  border-radius: 20px;
  background: linear-gradient(180deg, #0e0a1e 0%, #090614 60%, #0e0a1e 100%);
  border: 1px solid rgba(232,121,249,0.2);
  box-shadow:
    0 0 0 1px rgba(232,121,249,0.08),
    inset 0 1px 0 rgba(255,255,255,0.04),
    0 0 60px rgba(109,40,217,0.15),
    0 20px 40px rgba(0,0,0,0.6);
}
/* Cabinet top light strip */
.sl-cabinet::before {
  content: '';
  position: absolute; top: 0; left: 20px; right: 20px; height: 2px;
  background: linear-gradient(90deg, transparent, #e879f9, #c084fc, #e879f9, transparent);
  border-radius: 2px;
  box-shadow: 0 0 12px rgba(232,121,249,0.8);
}
/* Cabinet bottom light strip */
.sl-cabinet::after {
  content: '';
  position: absolute; bottom: 0; left: 20px; right: 20px; height: 2px;
  background: linear-gradient(90deg, transparent, #60a5fa, #818cf8, #60a5fa, transparent);
  border-radius: 2px;
  box-shadow: 0 0 12px rgba(96,165,250,0.6);
}

/* ── reel window ── */
.sl-reel-frame {
  display: flex; gap: 10px;
  background: #04030a;
  border-radius: 12px;
  padding: 10px;
  border: 1px solid rgba(232,121,249,0.15);
  box-shadow: inset 0 4px 20px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.02);
  position: relative; overflow: hidden;
}
/* Scanline overlay */
.sl-reel-frame::after {
  content: '';
  position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px);
  border-radius: 12px;
}
/* Win-line highlight */
.sl-win-line {
  position: absolute; left: 0; right: 0;
  height: 100px; top: 50%; transform: translateY(-50%);
  pointer-events: none; z-index: 3; border-radius: 4px;
  border-top: 1px solid rgba(251,191,36,0.25);
  border-bottom: 1px solid rgba(251,191,36,0.25);
}

/* ── single reel ── */
.sl-reel {
  width: 100px; height: 290px;
  border-radius: 8px; overflow: hidden;
  background: #06050e;
  border: 1px solid rgba(255,255,255,0.04);
  position: relative;
}
.sl-reel-inner {
  display: flex; flex-direction: column;
  transition: none;
}
.sl-reel-cell {
  width: 100px; height: 96px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 44px; position: relative;
}

/* ── multiplier display ── */
.sl-multiplier {
  text-align: center;
  font-family: 'Orbitron', monospace; font-weight: 900;
  font-size: clamp(22px, 3.5vw, 36px);
  letter-spacing: 0.06em;
  transition: color 0.3s, text-shadow 0.3s;
  line-height: 1;
  margin-top: 4px;
}

/* ── payout strip ── */
.sl-payout-strip {
  display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;
  padding: 0 4px;
}
.sl-payout-chip {
  padding: 4px 10px; border-radius: 20px; font-size: 11px;
  font-family: 'Rajdhani', sans-serif; font-weight: 600;
  letter-spacing: 0.04em; cursor: default;
  transition: transform 0.15s, box-shadow 0.15s;
  white-space: nowrap;
}
.sl-payout-chip:hover { transform: translateY(-1px); }

/* ── spin button ── */
.sl-spin-btn {
  width: 100%; padding: 15px 24px; border-radius: 14px; border: none; cursor: pointer;
  font-family: 'Orbitron', monospace; font-size: 14px; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  position: relative; overflow: hidden;
  transition: transform 0.15s, box-shadow 0.2s;
}
.sl-spin-btn:not(:disabled):hover  { transform: translateY(-2px); }
.sl-spin-btn:not(:disabled):active { transform: translateY(0); }
.sl-spin-btn::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  transform: translateX(-100%); transition: transform 0.8s;
}
.sl-spin-btn:not(:disabled):hover::after { transform: translateX(100%); }

/* ── right panel ── */
.sl-right { display: flex; flex-direction: column; gap: 12px; min-height: 0; }

.sl-panel {
  background: linear-gradient(145deg, rgba(12,8,22,0.96) 0%, rgba(8,5,15,0.98) 100%);
  border: 1px solid rgba(232,121,249,0.1); border-radius: 14px;
  position: relative; overflow: hidden;
}
.sl-panel::before {
  content: ''; position: absolute; inset: 0; border-radius: 14px;
  background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%);
  pointer-events: none;
}
.sl-panel-head {
  padding: 10px 14px 8px; border-bottom: 1px solid rgba(232,121,249,0.06);
  font-family: 'Orbitron', monospace; font-size: 8.5px;
  letter-spacing: 0.2em; text-transform: uppercase; color: #3d2a5a;
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}
.sl-panel-body {
  overflow-y: auto; flex: 1; min-height: 0;
}
.sl-panel-body::-webkit-scrollbar { width: 3px; }
.sl-panel-body::-webkit-scrollbar-track { background: transparent; }
.sl-panel-body::-webkit-scrollbar-thumb { background: #1e0a30; border-radius: 2px; }

/* ── paytable ── */
.sl-pt-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.02);
  transition: background 0.15s;
}
.sl-pt-row:hover { background: rgba(255,255,255,0.012); }
.sl-pt-row:last-child { border-bottom: none; }

/* ── log row ── */
.sl-log-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 12px; transition: background 0.15s;
}
.sl-log-row:hover { background: rgba(255,255,255,0.012); }

/* ── win flash ── */
@keyframes win-flash { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
.sl-win-flash { animation: win-flash 0.4s ease-in-out 3; }

/* ── jackpot shake ── */
@keyframes jackpot-shake {
  0%,100%{transform:translate(0,0) rotate(0deg);}
  10%{transform:translate(-4px,-2px) rotate(-1deg);}
  20%{transform:translate(4px,2px) rotate(1deg);}
  30%{transform:translate(-3px,3px) rotate(-0.5deg);}
  40%{transform:translate(3px,-3px) rotate(0.5deg);}
  50%{transform:translate(-2px,2px) rotate(-1deg);}
  60%{transform:translate(2px,-2px) rotate(1deg);}
  70%{transform:translate(-4px,4px) rotate(-0.5deg);}
  80%{transform:translate(4px,-4px) rotate(0.5deg);}
  90%{transform:translate(-2px,2px) rotate(0deg);}
}
.sl-jackpot { animation: jackpot-shake 0.6s ease-in-out; }

/* ── particle ── */
@keyframes particle-burst {
  0%   { opacity:1; transform:translate(0,0) scale(1); }
  100% { opacity:0; transform:translate(var(--px),var(--py)) scale(0); }
}
.sl-particle {
  position:absolute; border-radius:50%; pointer-events:none;
  animation: particle-burst var(--pd,0.8s) ease-out forwards;
}

/* ── reel bounce on stop ── */
@keyframes reel-bounce {
  0%   { transform: translateY(0); }
  30%  { transform: translateY(-8px); }
  55%  { transform: translateY(3px); }
  75%  { transform: translateY(-2px); }
  100% { transform: translateY(0); }
}
.sl-reel-bounce { animation: reel-bounce 0.35s ease-out; }

/* ── fade up ── */
@keyframes fade-up { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:translateY(0);} }
.sl-fadein { animation: fade-up 0.35s ease-out both; }

/* ── spin icon ── */
@keyframes spin-icon { to{transform:rotate(360deg);} }
.sl-spin-icon { animation: spin-icon 0.7s linear infinite; display: inline-block; }

/* ── number counter anim ── */
@keyframes num-pop { 0%{transform:scale(1.4);} 100%{transform:scale(1);} }
.sl-num-pop { animation: num-pop 0.3s cubic-bezier(0.34,1.56,0.64,1); }

/* win modal */
.sl-overlay { position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.88);backdrop-filter:blur(12px); }
@keyframes modal-pop { from{opacity:0;transform:scale(0.7) translateY(30px);} to{opacity:1;transform:scale(1) translateY(0);} }
.sl-modal { animation: modal-pop 0.45s cubic-bezier(0.34,1.56,0.64,1); width:300px; border-radius:20px; overflow:hidden; position:relative; }

/* glow ring on jackpot */
@keyframes jackpot-ring { 0%,100%{opacity:0.4;transform:scale(0.96);} 50%{opacity:0.9;transform:scale(1.04);} }
.sl-jackpot-ring { animation: jackpot-ring 0.8s ease-in-out infinite; }
`;

/* ═══════════════════════════════════════════════════════════
   REEL  (canvas-drawn symbols)
═══════════════════════════════════════════════════════════ */
function Reel({ targetSymbol, spinning, delay, onStop }: {
  targetSymbol: string; spinning: boolean; delay: number; onStop: () => void;
}) {
  const reelRef  = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number>();
  const posRef   = useRef(0);
  const CELL_H   = 96;
  const STRIP    = SYMBOLS.length;
  const [bouncing, setBouncing] = useState(false);

  // Build a long strip: repeating symbols
  const strip = [...SYMBOLS, ...SYMBOLS, ...SYMBOLS, ...SYMBOLS];
  const stripH = strip.length * CELL_H;

  const setY = (y: number) => {
    if (innerRef.current) innerRef.current.style.transform = `translateY(${y}px)`;
  };

  useEffect(() => {
    if (!spinning) return;
    let velocity = 22;         // pixels/frame
    let started = false;
    const startDelay = delay;
    let elapsed = 0;
    const startTime = performance.now();

    // target position: land on targetSymbol
    const targetIdx = strip.findLastIndex(s => s === targetSymbol);
    // center it in the middle slot (slot 1 of 3, index=1 in 290/3 ≈ 96+48)
    const targetY = -(targetIdx * CELL_H - CELL_H); // center of middle cell

    const tick = () => {
      const now = performance.now();
      elapsed = now - startTime;

      if (elapsed < startDelay) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      posRef.current -= velocity;
      // wrap
      if (posRef.current < -stripH + 300) posRef.current += stripH - STRIP * CELL_H;
      setY(posRef.current);

      // how far from target?
      const diff = Math.abs(posRef.current - targetY);
      if (diff < velocity * 1.5 && elapsed > startDelay + 600) {
        // snap to target
        posRef.current = targetY;
        setY(posRef.current);
        setBouncing(true);
        setTimeout(() => { setBouncing(false); onStop(); }, 350);
        return;
      }

      // decelerate in final 200px
      if (elapsed > startDelay + 400) {
        velocity = Math.max(3, velocity * 0.93);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current!);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  return (
    <div className={`sl-reel${bouncing ? ' sl-reel-bounce' : ''}`} ref={reelRef}>
      <div ref={innerRef} className="sl-reel-inner" style={{ transform: `translateY(${posRef.current}px)` }}>
        {strip.map((sym, i) => {
          const t = TC[sym];
          return (
            <div key={i} className="sl-reel-cell" style={{
              textShadow: `0 0 20px ${t.color}`,
              color: t.color,
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              {t.glyph}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PARTICLE BURST
═══════════════════════════════════════════════════════════ */
function ParticleBurst({ color, trigger }: { color: string; trigger: boolean }) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; a: number; r: number }[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (!trigger) return;
    const newP = Array.from({ length: 28 }, () => ({
      id: idRef.current++,
      x: (Math.random() - .5) * 260,
      y: (Math.random() - .5) * 180 - 60,
      a: Math.random() * Math.PI * 2,
      r: 3 + Math.random() * 5,
    }));
    setParticles(newP);
    const t = setTimeout(() => setParticles([]), 1200);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!particles.length) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 10 }}>
      {particles.map(p => (
        <div key={p.id} className="sl-particle" style={{
          width: p.r * 2, height: p.r * 2,
          background: color, boxShadow: `0 0 6px ${color}`,
          left: `calc(50% + ${p.x / 2}px)`, top: '50%',
          '--px': `${p.x}px`, '--py': `${p.y}px`,
          '--pd': `${0.6 + Math.random() * 0.6}s`,
          animationDelay: `${Math.random() * 0.2}s`,
        } as React.CSSProperties} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   WIN MODAL
═══════════════════════════════════════════════════════════ */
function WinModal({ result, onClose }: { result: SpinResult; onClose: () => void }) {
  const tc  = TC[result.symbol] || TC.sword;
  const big = result.multiplier >= 4;
  const [proof, setProof] = useState(false);
  const isJackpot = result.multiplier >= 10;
  return (
    <div className="sl-overlay" onClick={onClose}>
      <div className="sl-modal" onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(160deg,#09060f 0%,#0e0918 100%)',
        border: `1px solid ${tc.color}50`,
        boxShadow: `0 0 80px ${tc.glow}, 0 0 160px ${tc.glow}50, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>
        {/* top bar */}
        <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${tc.color},transparent)` }} />
        {isJackpot && (
          <div className="sl-jackpot-ring" style={{
            position: 'absolute', inset: -4, borderRadius: 24,
            border: `2px solid ${tc.color}50`, pointerEvents: 'none', zIndex: 0,
          }} />
        )}
        <ParticleBurst color={tc.color} trigger />
        <div style={{ padding: '24px 22px 20px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {isJackpot && (
            <div style={{
              fontFamily: 'Orbitron, monospace', fontSize: 10, letterSpacing: '0.3em',
              color: tc.color, textTransform: 'uppercase', marginBottom: 4,
              animation: 'shimmer 1s linear infinite',
              background: `linear-gradient(90deg,${tc.color},#fff,${tc.color})`,
              backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>◆ JACKPOT ◆</div>
          )}
          {/* symbol */}
          <div style={{
            fontSize: 60, lineHeight: 1, marginBottom: 8,
            color: tc.color, textShadow: `0 0 40px ${tc.glow}`,
          }}>{tc.glyph}</div>
          {/* tier badge */}
          <div style={{
            display: 'inline-block', padding: '3px 14px', borderRadius: 20, marginBottom: 10,
            border: `1px solid ${tc.color}40`, background: `${tc.color}10`,
            fontFamily: 'Orbitron, monospace', fontSize: 9, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: tc.color,
          }}>{result.label}</div>

          {/* multiplier */}
          <div style={{
            fontFamily: 'Orbitron, monospace', fontWeight: 900,
            fontSize: 42, color: tc.color, lineHeight: 1,
            textShadow: `0 0 30px ${tc.glow}`, marginBottom: 4,
          }}>×{result.multiplier}</div>

          {/* payout */}
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 16, color: '#94a3b8', marginBottom: 4 }}>
            Выигрыш: <span style={{ color: '#f8f8ff', fontWeight: 700, fontSize: 20 }}>{result.payout} DKP</span>
          </div>
          <div style={{
            fontSize: 13, color: result.net >= 0 ? '#4ade80' : '#f87171',
            marginBottom: 16, fontFamily: 'Share Tech Mono, monospace',
          }}>
            {result.net >= 0 ? '+' : ''}{result.net.toFixed(1)} DKP чистыми
          </div>

          {/* proof */}
          <button onClick={() => setProof(p => !p)} style={{
            display: 'block', width: '100%', marginBottom: 8, padding: '5px',
            background: 'transparent', border: '1px solid #1a0c28', borderRadius: 8,
            color: '#2a1a3a', fontSize: 10, fontFamily: 'Rajdhani', cursor: 'pointer',
          }}>🔒 Provably fair {proof ? '▲' : '▼'}</button>
          {proof && (
            <div style={{
              textAlign: 'left', padding: '7px 9px', borderRadius: 7, marginBottom: 12,
              background: '#04020a', border: '1px solid #0e0618',
              fontFamily: 'Share Tech Mono, monospace', fontSize: 9.5, color: '#2a1a3a',
              wordBreak: 'break-all', lineHeight: 1.7,
            }}>
              <div style={{ color: '#3d2a5a', marginBottom: 2 }}>Seed:</div>{result.seed}
              <div style={{ color: '#3d2a5a', margin: '3px 0 2px' }}>SHA-256:</div>{result.spinHash}
            </div>
          )}

          <button onClick={onClose} style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${tc.color} 0%, ${tc.color}aa 100%)`,
            color: '#05020a', fontFamily: 'Orbitron, monospace', fontSize: 13,
            fontWeight: 700, letterSpacing: '0.1em',
            boxShadow: `0 6px 24px ${tc.glow}`,
          }}>ПРИНЯТЬ</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export function DkpSlotsPage() {
  const { user }     = useAuthStore();
  const clanId       = user?.clanMembership?.clanId ?? '';
  const queryClient  = useQueryClient();

  const [spinning,  setSpin]    = useState(false);
  const [reelSyms,  setSyms]    = useState(['skull','skull','skull']);
  const [stopped,   setStopped] = useState([true, true, true]);
  const [win,       setWin]     = useState<SpinResult | null>(null);
  const [pending,   setPending] = useState<SpinResult | null>(null);
  const [flash,     setFlash]   = useState(false);
  const [jackpot,   setJackpot] = useState(false);
  const [multText,  setMultText]= useState<string | null>(null);
  const cabinetRef = useRef<HTMLDivElement>(null);

  const { data: info }        = useQuery<PayoutInfo>({ queryKey: ['slots-info'],                queryFn: () => api.get('/slots/info').then(r => r.data) });
  const { data: balD }        = useQuery<{ balance: number }>({ queryKey: ['slots-bal', user?.id], queryFn: () => api.get('/slots/balance').then(r => r.data), enabled: !!user, refetchInterval: 30_000 });
  const { data: logs = [] }   = useQuery<LogEntry[]>({ queryKey: ['slots-logs', clanId],        queryFn: () => api.get('/slots/logs?limit=40').then(r => r.data), refetchInterval: 7_000, enabled: !!clanId });

  const mut = useMutation({
    mutationFn: () => api.post('/slots/spin').then(r => r.data),
    onSuccess: (res: SpinResult) => {
      setPending(res);
      setSyms([res.symbol, res.symbol, res.symbol]);
    },
    onError: (e: any) => { setSpin(false); setStopped([true,true,true]); toast.error(e?.response?.data?.message ?? 'Ошибка'); },
  });

  const handleSpin = () => {
    if (spinning) return;
    setSpin(true);
    setStopped([false, false, false]);
    setFlash(false); setJackpot(false);
    setPending(null);
    // Random symbols for spinning (will be replaced by result)
    setSyms([
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    ]);
    mut.mutate();
  };

  const handleReelStop = useCallback((i: number) => {
    setStopped(prev => {
      const next = [...prev]; next[i] = true;
      return next;
    });
  }, []);

  // When all 3 reels stopped
  useEffect(() => {
    if (!spinning || !stopped.every(Boolean) || !pending) return;
    setTimeout(() => {
      // effects
      if (pending.multiplier >= 10) {
        setJackpot(true);
        if (cabinetRef.current) cabinetRef.current.classList.add('sl-jackpot');
        setTimeout(() => cabinetRef.current?.classList.remove('sl-jackpot'), 700);
      } else if (pending.multiplier >= 2) {
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      }
      setMultText(`×${pending.multiplier}`);
      setTimeout(() => setMultText(null), 2000);

      queryClient.invalidateQueries({ queryKey: ['slots-logs'] });
      queryClient.invalidateQueries({ queryKey: ['slots-bal'] });
      setWin(pending);
      setSpin(false);
    }, 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopped, spinning, pending]);

  const closeWin = () => { setWin(null); setPending(null); };

  const balance  = balD?.balance ?? 0;
  const canSpin  = !spinning && balance >= 5;
  const betColor = '#e879f9';
  const tc       = TC[reelSyms[0]] || TC.skull;

  return (
    <>
      <style>{CSS}</style>
      <div className="sl-root">
        <div className="sl-bg" /><div className="sl-bg-glow" />

        {/* ── HEADER ── */}
        <header className="sl-header">
          <div>
            <div className="sl-logo">⬡ Аркан Слоты</div>
            <div style={{ color: '#2a1a3a', fontSize: 11, marginTop: 2, fontFamily: 'Rajdhani' }}>
              Ставка 5 DKP · выиграй до ×10
            </div>
          </div>
          <div className="sl-bal-wrap">
            <div className="sl-bal-lbl">DKP Баланс</div>
            <div className="sl-bal-val">{balance}</div>
          </div>
        </header>

        {/* ── BODY ── */}
        <div className="sl-body">

          {/* ── LEFT ── */}
          <div className="sl-left">

            {/* CABINET */}
            <div className="sl-cabinet" ref={cabinetRef} style={{ width: '100%', maxWidth: 440 }}>
              <ParticleBurst color={tc.color} trigger={jackpot} />

              {/* Title display */}
              <div style={{
                textAlign: 'center', marginBottom: 12,
                fontFamily: 'Orbitron, monospace', fontSize: 11,
                letterSpacing: '0.22em', color: '#3d2a5a', textTransform: 'uppercase',
              }}>— Arcane Reels —</div>

              {/* Reel frame */}
              <div className={`sl-reel-frame${flash ? ' sl-win-flash' : ''}`}>
                <div className="sl-win-line" />
                {[0,1,2].map(i => (
                  <Reel
                    key={i}
                    targetSymbol={reelSyms[i]}
                    spinning={spinning && !stopped[i]}
                    delay={i * 350}
                    onStop={() => handleReelStop(i)}
                  />
                ))}
              </div>

              {/* Multiplier display */}
              <div className="sl-multiplier" style={{
                color: spinning ? '#3d2a5a' : tc.color,
                textShadow: spinning ? 'none' : `0 0 20px ${tc.glow}`,
              }}>
                {spinning
                  ? <span style={{ color: '#2a1a3a', fontSize: 14, letterSpacing: '0.2em' }}>ВРАЩЕНИЕ…</span>
                  : multText ?? `×${pending?.multiplier ?? '?'}`}
              </div>

              {/* Payout chips */}
              <div className="sl-payout-strip" style={{ marginTop: 12 }}>
                {(info?.tiers ?? []).map(t => {
                  const tc2 = TC[t.symbol] || TC.skull;
                  const active = pending?.symbol === t.symbol && !spinning;
                  return (
                    <div key={t.id} className="sl-payout-chip" style={{
                      background: active ? `${tc2.color}20` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${active ? tc2.color + '60' : 'rgba(255,255,255,0.04)'}`,
                      color: active ? tc2.color : '#3d2a5a',
                      boxShadow: active ? `0 0 12px ${tc2.color}30` : 'none',
                      transform: active ? 'translateY(-2px) scale(1.05)' : 'none',
                    }}>
                      <span style={{ marginRight: 4 }}>{tc2.glyph}</span>
                      {t.payout} DKP
                      <span style={{ opacity: 0.5, marginLeft: 4, fontSize: 10 }}>{t.chance}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SPIN BUTTON */}
            <div style={{ width: '100%', maxWidth: 440 }}>
              <button className="sl-spin-btn" onClick={handleSpin} disabled={!canSpin} style={{
                background: canSpin
                  ? `linear-gradient(135deg, #3b0764 0%, ${betColor} 45%, #3b0764 100%)`
                  : '#0a0614',
                color: canSpin ? '#f5e6ff' : '#2a1a3a',
                border: `1px solid ${canSpin ? betColor + '45' : '#1a0c28'}`,
                boxShadow: canSpin ? `0 0 30px ${betColor}30, 0 6px 20px rgba(0,0,0,0.7)` : 'none',
              }}>
                {spinning
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <svg className="sl-spin-icon" style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                      Вращение…
                    </span>
                  : balance < 5 ? '⚠ Недостаточно DKP'
                  : '⚡ КРУТИТЬ  ·  5 DKP'}
              </button>
            </div>

          </div>

          {/* ── RIGHT ── */}
          <div className="sl-right">

            {/* Paytable */}
            <div className="sl-panel" style={{ flexShrink: 0 }}>
              <div className="sl-panel-head">
                <span style={{ color: betColor }}>◈</span> Таблица выплат
              </div>
              <div>
                {(info?.tiers ?? []).map(t => {
                  const tc2 = TC[t.symbol] || TC.skull;
                  return (
                    <div key={t.id} className="sl-pt-row">
                      {/* Glyph */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: `${tc2.color}0d`, border: `1px solid ${tc2.color}25`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, color: tc2.color, textShadow: `0 0 10px ${tc2.glow}`,
                      }}>{tc2.glyph}</div>
                      {/* Label + multiplier */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'Orbitron, monospace', fontSize: 10, color: tc2.color,
                          letterSpacing: '0.08em',
                        }}>{t.label} ×{t.multiplier}</div>
                        <div style={{ fontSize: 11, color: '#2a1a3a', fontFamily: 'Rajdhani' }}>
                          Шанс: {t.chance}%
                        </div>
                      </div>
                      {/* Payout */}
                      <div style={{
                        fontFamily: 'Orbitron, monospace', fontWeight: 700,
                        fontSize: 13, color: tc2.color, flexShrink: 0,
                        textShadow: `0 0 10px ${tc2.glow}`,
                      }}>+{t.payout}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Logs */}
            <div className="sl-panel" style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="sl-panel-head">
                <span style={{ color: '#4ade80' }}>⚡</span> История спинов
              </div>
              <div className="sl-panel-body" style={{ padding: '4px 0' }}>
                {logs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 16px', color: '#1a0c28', fontStyle: 'italic', fontSize: 13, fontFamily: 'Rajdhani' }}>
                    Нет истории…
                  </div>
                ) : logs.map((log, i) => {
                  const tc2 = TC[log.tier] || TC.skull;
                  const ago = (() => {
                    const s = Math.floor((Date.now() - new Date(log.createdAt).getTime()) / 1000);
                    if (s < 60) return `${s}с`; if (s < 3600) return `${Math.floor(s/60)}м`;
                    return `${Math.floor(s/3600)}ч`;
                  })();
                  const isWin = log.multiplier > 1;
                  return (
                    <div key={log.id} className="sl-log-row sl-fadein"
                      style={{ borderLeft: `3px solid ${tc2.color}40`, animationDelay: `${i*0.03}s` }}>
                      {/* Avatar */}
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        border: `1px solid ${tc2.color}28`, overflow: 'hidden',
                        background: log.user.avatarUrl ? 'transparent' : `${tc2.color}12`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: tc2.color, fontFamily: 'Orbitron',
                      }}>
                        {log.user.avatarUrl
                          ? <img src={log.user.avatarUrl} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                          : log.user.username[0].toUpperCase()}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap: 4 }}>
                          <span style={{ color:'#cbd5e1', fontFamily:'Rajdhani', fontSize:12, fontWeight:600, overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{log.user.username}</span>
                          <span style={{ color:'#1a0c28', fontSize:9 }}>·</span>
                          <span style={{ color: tc2.color, fontSize:10, fontFamily:'Share Tech Mono', flexShrink:0 }}>×{log.multiplier}</span>
                        </div>
                        <div style={{ fontSize:11, color: isWin ? '#4ade80' : '#f87171', fontFamily:'Share Tech Mono' }}>
                          {isWin ? '+' : ''}{(log.payout - 5).toFixed(1)} DKP
                        </div>
                      </div>
                      <span style={{ color:'#1a0c28', fontSize:10, flexShrink:0, fontFamily:'Share Tech Mono' }}>{ago}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {win && <WinModal result={win} onClose={closeWin} />}
    </>
  );
}

export default DkpSlotsPage;
