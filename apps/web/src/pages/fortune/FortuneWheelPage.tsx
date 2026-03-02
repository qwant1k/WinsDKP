import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
interface FortuneItem { id: string; name: string; rarity: Rarity; imageUrl?: string; quantity: number; }
interface SpinLog     { id: string; bet: number; wonRarity: string; createdAt: string; user: { id: string; username: string; avatarUrl?: string }; wonItem?: { id: string; name: string; rarity: string; imageUrl?: string }; }
interface SpinResult  { wonItem?: FortuneItem; wonRarity: Rarity; spinHash: string; seed: string; remainingBalance: number; }
interface Chances     { [bet: number]: { COMMON: number; UNCOMMON: number; RARE: number; EPIC: number; LEGENDARY: number }; }
type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const RC: Record<Rarity, { label: string; hex: string; glow: string; icon: string }> = {
  COMMON:    { label: 'Обычный',     hex: '#94a3b8', glow: 'rgba(148,163,184,0.35)', icon: '◈' },
  UNCOMMON:  { label: 'Необычный',   hex: '#4ade80', glow: 'rgba(74,222,128,0.4)',   icon: '◆' },
  RARE:      { label: 'Редкий',      hex: '#60a5fa', glow: 'rgba(96,165,250,0.45)',  icon: '❋' },
  EPIC:      { label: 'Эпический',   hex: '#c084fc', glow: 'rgba(192,132,252,0.5)',  icon: '✦' },
  LEGENDARY: { label: 'Легендарный', hex: '#fbbf24', glow: 'rgba(251,191,36,0.6)',   icon: '★' },
};

const BETS = [
  { val: 5,  label: 'Бронза',  color: '#cd7f32', dark: '#431407', roman: 'I'   },
  { val: 10, label: 'Серебро', color: '#cbd5e1', dark: '#1e293b', roman: 'II'  },
  { val: 15, label: 'Золото',  color: '#fbbf24', dark: '#451a03', roman: 'III' },
  { val: 20, label: 'Платина', color: '#e879f9', dark: '#3b0764', roman: 'IV'  },
];

/* ═══════════════════════════════════════════════════════════════
   CSS  (injected once, scoped to .fw-root)
═══════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@600;700&family=Manrope:wght@500;700;800&display=swap');

/* ── reset ── */
.fw-root, .fw-root *, .fw-root *::before, .fw-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── root inside main layout ── */
.fw-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #050508;
  color: #ffffff;
  font-family: 'Manrope', 'Segoe UI', Tahoma, sans-serif;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── ambient bg ── */
.fw-bg {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 80% 60% at 30% -10%, rgba(109,40,217,0.12) 0%, transparent 70%),
    radial-gradient(ellipse 60% 50% at 80% 110%, rgba(180,83,9,0.1)  0%, transparent 70%),
    radial-gradient(1px 1px at 15% 20%, rgba(255,255,255,0.5) 0%, transparent 100%),
    radial-gradient(1px 1px at 35% 70%, rgba(255,255,255,0.4) 0%, transparent 100%),
    radial-gradient(1px 1px at 55% 35%, rgba(255,255,255,0.5) 0%, transparent 100%),
    radial-gradient(1px 1px at 75% 80%, rgba(255,255,255,0.35) 0%, transparent 100%),
    radial-gradient(1px 1px at 90% 15%, rgba(255,255,255,0.45) 0%, transparent 100%),
    radial-gradient(2px 2px at 20% 90%, rgba(251,191,36,0.2)  0%, transparent 100%),
    radial-gradient(2px 2px at 65%  5%, rgba(192,132,252,0.15) 0%, transparent 100%);
  z-index: 0;
}
.fw-vignette {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background: radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(5,5,8,0.6) 100%);
}

/* ── header ── */
.fw-header {
  position: relative; z-index: 1; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 28px;
  height: 88px;
  border-bottom: 1px solid #131326;
  background: #080812;
  backdrop-filter: blur(12px);
}
.fw-title {
  font-family: 'Cinzel Decorative', serif; font-weight: 900;
  font-size: clamp(26px, 2.6vw, 38px); letter-spacing: 0.03em;
  background: linear-gradient(90deg, #d97706 0%, #fbbf24 35%, #fef3c7 55%, #fbbf24 75%, #d97706 100%);
  background-size: 200% auto;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  animation: shimmer 3s linear infinite;
}
@keyframes shimmer { to { background-position: 200% center; } }

.fw-balance-label {
  font-family: 'Cinzel', serif; font-size: 16px;
  letter-spacing: 0.12em; text-transform: uppercase; color: #f8fafc;
  margin-bottom: 2px;
}
.fw-balance-val {
  font-family: 'Cinzel', serif; font-size: clamp(30px, 3vw, 44px);
  font-weight: 700; color: #fbbf24; line-height: 1;
  text-shadow: 0 0 20px rgba(251,191,36,0.5);
}

/* ── body ── */
.fw-body {
  position: relative; z-index: 1; flex: 1; min-height: 0;
  display: grid;
  grid-template-columns: 1fr 460px;
  gap: 24px;
  padding: 20px 24px 20px;
}

/* ── left column ── */
.fw-left {
  display: flex; flex-direction: column; gap: 12px;
  min-height: 0; overflow: hidden;
}

/* ── wheel wrapper – takes remaining space ── */
.fw-wheel-wrap {
  flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  position: relative;
}

/* ── bets row ── */
.fw-bets {
  flex-shrink: 0;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
}
.fw-bet-btn {
  padding: 14px 8px 12px; border-radius: 14px; border: none; cursor: pointer;
  background: #0a0a14;
  border: 1px solid #161626;
  transition: transform 0.15s, box-shadow 0.2s, border-color 0.2s;
  position: relative;
}
.fw-bet-btn:hover:not(:disabled) { transform: translateY(-2px); }
.fw-bet-btn.active { transform: translateY(-3px); }
.fw-bet-btn:disabled { cursor: not-allowed; opacity: 0.7; }
.fw-bet-roman {
  font-family: 'Cinzel', serif; font-size: 24px; font-weight: 700;
  line-height: 1; margin-bottom: 2px; transition: color 0.2s, text-shadow 0.2s;
}
.fw-bet-label {
  font-family: 'Cinzel', serif; font-size: 15px; letter-spacing: 0.06em;
  margin-bottom: 3px; transition: color 0.2s;
}
.fw-bet-val {
  font-family: 'Cinzel', serif; font-size: 28px; font-weight: 700;
  line-height: 1; transition: color 0.2s;
}
.fw-bet-dkp { font-size: 14px; color: #f8fafc; font-family: 'Cinzel', serif; letter-spacing: 0.08em; margin-top: 2px; }
.fw-bet-dot {
  position: absolute; top: 6px; right: 6px;
  width: 6px; height: 6px; border-radius: 50%;
  background: #ef4444; box-shadow: 0 0 6px #ef4444;
}

/* ── spin button ── */
.fw-spin-btn {
  flex-shrink: 0;
  width: 100%; padding: 18px; border-radius: 14px; border: none; cursor: pointer;
  font-family: 'Cinzel', serif; font-size: 24px; font-weight: 700; letter-spacing: 0.08em;
  transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
  position: relative; overflow: hidden;
}
.fw-spin-btn:not(:disabled):hover { transform: translateY(-2px); }
.fw-spin-btn:not(:disabled):active { transform: translateY(0); }
.fw-spin-btn::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
  transform: translateX(-100%); transition: transform 0.7s;
}
.fw-spin-btn:not(:disabled):hover::after { transform: translateX(100%); }
.fw-spin-btn:disabled { cursor: not-allowed; }

/* ── right column ── */
.fw-right {
  display: flex; flex-direction: column; gap: 12px;
  min-height: 0;
}

/* ── glass panel ── */
.fw-panel {
  background: linear-gradient(145deg, rgba(14,14,26,0.95) 0%, rgba(9,9,18,0.98) 100%);
  border: 1px solid #161630; border-radius: 16px;
  position: relative; overflow: hidden;
}
.fw-panel::before {
  content: ''; position: absolute; inset: 0; border-radius: 16px;
  background: linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 50%);
  pointer-events: none;
}
.fw-panel-head {
  padding: 11px 14px 9px;
  border-bottom: 1px solid #0e0e1c;
  font-family: 'Cinzel', serif; font-size: 14px;
  letter-spacing: 0.1em; text-transform: uppercase; color: #ffffff;
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}
.fw-panel-body { flex: 1; min-height: 0; overflow-y: auto; }
.fw-panel-body::-webkit-scrollbar { width: 3px; }
.fw-panel-body::-webkit-scrollbar-track { background: transparent; }
.fw-panel-body::-webkit-scrollbar-thumb { background: #1e1e30; border-radius: 2px; }

/* ── tabs ── */
.fw-tabs { display: flex; border-bottom: 1px solid #0e0e1c; flex-shrink: 0; }
.fw-tab {
  flex: 1; padding: 11px 8px; border: none; background: transparent; cursor: pointer;
  font-family: 'Cinzel', serif; font-size: 15px; letter-spacing: 0.06em;
  text-transform: uppercase; transition: color 0.15s;
  border-bottom: 2px solid transparent;
}
.fw-tab.active { color: #fbbf24; border-bottom-color: #fbbf24; }
.fw-tab:not(.active) { color: #f8fafc; }

/* ── loot item ── */
.fw-loot-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; transition: background 0.15s;
}
.fw-loot-item:hover { background: rgba(255,255,255,0.015); }

/* ── log item ── */
.fw-log-item {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; border-radius: 7px;
  margin: 2px 6px;
  transition: background 0.15s;
}
.fw-log-item:hover { background: rgba(255,255,255,0.015); }

/* ── rune divider ── */
.fw-rune {
  text-align: center; color: #f8fafc;
  letter-spacing: 8px; font-size: 14px; user-select: none;
  flex-shrink: 0;
}

/* ── win modal ── */
.fw-overlay {
  position: fixed; inset: 0; z-index: 200;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.9); backdrop-filter: blur(12px);
}
@keyframes modal-pop {
  from { opacity: 0; transform: scale(0.75) translateY(24px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
.fw-modal {
  width: 320px; border-radius: 20px; overflow: hidden;
  animation: modal-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

/* ── embers ── */
@keyframes ember {
  0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0.9; }
  100% { transform: translateY(-90px) translateX(var(--ex, 10px)) scale(0.1); opacity: 0; }
}
.fw-ember {
  position: absolute; border-radius: 50%; pointer-events: none;
  animation: ember var(--ed, 1.8s) ease-out forwards;
}

/* ── fade in rows ── */
@keyframes row-in { from { opacity: 0; transform: translateX(6px); } to { opacity: 1; transform: translateX(0); } }
.fw-row-in { animation: row-in 0.3s ease-out both; }

/* ── spin icon ── */
@keyframes spin-icon { to { transform: rotate(360deg); } }
.fw-spin-icon { animation: spin-icon 0.75s linear infinite; display: inline-block; }

/* ── spinning wheel glow ── */
@keyframes wheel-glow { 0%,100% { opacity: 0.3; } 50% { opacity: 0.85; } }
.fw-wheel-glow { animation: wheel-glow 0.55s ease-in-out infinite; }

/* ── pulse ring around wheel ── */
@keyframes pulse { 0%,100% { opacity: 0.4; transform: scale(0.97); } 50% { opacity: 0.18; transform: scale(1.03); } }
.fw-pulse { animation: pulse 2.8s ease-in-out infinite; }

@media (max-width: 1320px) {
  .fw-body { grid-template-columns: 1fr 390px; }
}

@media (max-width: 1024px) {
  .fw-root { overflow-y: auto; }
  .fw-body { grid-template-columns: 1fr; }
}
`;

/* ═══════════════════════════════════════════════════════════════
   WHEEL CANVAS  (auto-sized to container)
═══════════════════════════════════════════════════════════════ */
function WheelCanvas({ items, spinning, targetIndex, onSpinComplete, size }: {
  items: FortuneItem[]; spinning: boolean;
  targetIndex: number | null; onSpinComplete: () => void; size: number;
}) {
  const cvRef   = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const aRef    = useRef(0);
  const doneRef = useRef(false);

  const N   = items.length || 8;
  const SEG = (2 * Math.PI) / N;

  const draw = useCallback((a: number) => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const S = cv.width, cx = S / 2, cy = S / 2, R = cx - 14;
    ctx.clearRect(0, 0, S, S);

    /* outer rings */
    ctx.beginPath(); ctx.arc(cx, cy, R + 12, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251,191,36,0.04)'; ctx.lineWidth = 20; ctx.stroke();

    const rg = ctx.createLinearGradient(0, 0, S, S);
    rg.addColorStop(0, 'rgba(253,230,138,0.65)');
    rg.addColorStop(0.45, 'rgba(192,132,252,0.45)');
    rg.addColorStop(1, 'rgba(253,230,138,0.65)');
    ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2);
    ctx.strokeStyle = rg; ctx.lineWidth = 1.5; ctx.stroke();

    /* tick marks */
    for (let i = 0; i < N * 3; i++) {
      const ta = a + i * (Math.PI * 2 / (N * 3));
      const major = i % 3 === 0;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ta);
      ctx.beginPath(); ctx.moveTo(R, 0); ctx.lineTo(R + (major ? 8 : 4), 0);
      ctx.strokeStyle = major ? 'rgba(251,191,36,0.5)' : 'rgba(251,191,36,0.18)';
      ctx.lineWidth = major ? 1.5 : 0.8; ctx.stroke(); ctx.restore();
    }

    /* segments */
    const disp = items.length > 0 ? items : Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: '???', rarity: 'COMMON' as Rarity, quantity: 0 }));
    disp.forEach((item, i) => {
      const sa = a + i * SEG, ea = sa + SEG, mid = sa + SEG / 2;
      const r = RC[item.rarity as Rarity] || RC.COMMON;

      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, sa, ea); ctx.closePath();
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      sg.addColorStop(0, '#05050a'); sg.addColorStop(0.55, '#0c0c18');
      sg.addColorStop(0.84, r.hex + '12'); sg.addColorStop(1, r.hex + '2e');
      ctx.fillStyle = sg; ctx.fill();
      ctx.strokeStyle = r.hex + '3a'; ctx.lineWidth = 0.8; ctx.stroke();

      /* rarity arc */
      ctx.beginPath(); ctx.arc(cx, cy, R - 5, sa + 0.06, ea - 0.06);
      ctx.strokeStyle = r.hex + '55'; ctx.lineWidth = 3.5; ctx.stroke();

      /* dot */
      const dd = R - 17;
      ctx.beginPath(); ctx.arc(cx + dd * Math.cos(mid), cy + dd * Math.sin(mid), 5, 0, Math.PI * 2);
      ctx.fillStyle = r.hex; ctx.shadowColor = r.hex; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;

      /* label */
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(mid); ctx.textAlign = 'right';
      const fs = Math.max(11, Math.min(18, 210 / N));
      ctx.font = `600 ${fs}px 'Cinzel', serif`;
      ctx.fillStyle = '#ffffff'; ctx.shadowColor = r.hex; ctx.shadowBlur = 6;
      const txt = item.name.length > 14 ? item.name.slice(0, 13) + '…' : item.name;
      ctx.fillText(txt, R - 26, fs * 0.38); ctx.shadowBlur = 0; ctx.restore();

      /* separator */
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(sa), cy + R * Math.sin(sa));
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1; ctx.stroke();
    });

    /* center */
    ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fill();

    const cg = ctx.createRadialGradient(cx - 9, cy - 9, 0, cx, cy, 38);
    cg.addColorStop(0, '#fef3c7'); cg.addColorStop(0.3, '#fbbf24');
    cg.addColorStop(0.7, '#b45309'); cg.addColorStop(1, '#6b1c00');
    ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fillStyle = cg; ctx.shadowColor = 'rgba(251,191,36,0.9)'; ctx.shadowBlur = 26; ctx.fill(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(254,243,199,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(120,53,15,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();

    ctx.fillStyle = '#1c0a00'; ctx.font = `bold ${Math.max(11, S * 0.03)}px 'Cinzel', serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('УДАЧА', cx, cy);

    /* pointer */
    ctx.save(); ctx.translate(cx, 2);
    ctx.beginPath(); ctx.moveTo(-10, 14); ctx.lineTo(10, 14); ctx.lineTo(0, 44); ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-9, 8); ctx.lineTo(9, 8); ctx.lineTo(0, 40); ctx.closePath();
    const pg = ctx.createLinearGradient(0, 8, 0, 40);
    pg.addColorStop(0, '#fef3c7'); pg.addColorStop(0.6, '#fbbf24'); pg.addColorStop(1, '#b45309');
    ctx.fillStyle = pg; ctx.shadowColor = 'rgba(251,191,36,1)'; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(254,243,199,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 38, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#fff8dc'; ctx.fill();
    ctx.restore();
  }, [items, N, SEG]);

  useEffect(() => { draw(aRef.current); }, [draw, size]);

  useEffect(() => {
    if (!spinning || targetIndex === null || items.length === 0) return;
    doneRef.current = false;
    const tCenter = targetIndex * SEG + SEG / 2;
    const align = -Math.PI / 2 - tCenter;
    const cur = ((aRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const tgt = ((align % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const diff = (tgt - cur + 2 * Math.PI) % (2 * Math.PI);
    const rawFinalA = aRef.current + 6.5 * 2 * Math.PI + diff;

    const pointerAngle = -Math.PI / 2;
    const indexAtPointer = (angle: number) => {
      const rel = ((pointerAngle - angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      return Math.floor(rel / SEG) % N;
    };

    // Snap exactly to the requested segment center even if visual offsets drift.
    const predicted = indexAtPointer(rawFinalA);
    const correctedFinalA = rawFinalA + (predicted - targetIndex) * SEG;
    const total = correctedFinalA - aRef.current;
    const dur = 7600, t0 = performance.now(), a0 = aRef.current;
    // Slow cinematic start, very soft and long ease-out near the finish.
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);

    const tick = (now: number) => {
      const el = Math.min(now - t0, dur), t = el / dur;
      aRef.current = a0 + total * ease(t);
      draw(aRef.current);
      if (el < dur) { animRef.current = requestAnimationFrame(tick); }
      else { aRef.current = correctedFinalA; draw(aRef.current); if (!doneRef.current) { doneRef.current = true; onSpinComplete(); } }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current!);
  }, [spinning, targetIndex, items, draw, SEG, onSpinComplete]);

  return <canvas ref={cvRef} width={size} height={size} style={{ display: 'block' }} />;
}

/* ═══════════════════════════════════════════════════════════════
   EMBERS
═══════════════════════════════════════════════════════════════ */
function Embers({ color, active }: { color: string; active: boolean }) {
  if (!active) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
      {[...Array(10)].map((_, i) => (
        <div key={i} className="fw-ember" style={{
          width: `${3 + Math.random() * 4}px`, height: `${3 + Math.random() * 4}px`,
          background: color, boxShadow: `0 0 6px ${color}`,
          left: `${10 + Math.random() * 80}%`, bottom: `${Math.random() * 20}px`,
          '--ex': `${(Math.random() - .5) * 48}px`,
          '--ed': `${1 + Math.random() * 1.5}s`,
          animationDelay: `${Math.random() * 1.8}s`,
        } as React.CSSProperties} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WIN MODAL
═══════════════════════════════════════════════════════════════ */
function WinModal({ result, onClose }: { result: SpinResult; onClose: () => void }) {
  const rc = RC[result.wonRarity] || RC.COMMON;
  const [proof, setProof] = useState(false);
  return (
    <div className="fw-overlay" onClick={onClose}>
      <div className="fw-modal" onClick={e => e.stopPropagation()} style={{
        border: `1px solid ${rc.hex}50`,
        background: 'linear-gradient(160deg,#0b0b1a 0%,#0f0f1e 100%)',
        boxShadow: `0 0 80px ${rc.glow}, 0 0 160px ${rc.glow}40, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>
        <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${rc.hex},transparent)` }} />
        <Embers color={rc.hex} active />
        <div style={{ padding: '26px 24px 22px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 50, lineHeight: 1, marginBottom: 8, textShadow: `0 0 40px ${rc.hex}` }}>{rc.icon}</div>
          <div style={{
            display: 'inline-block', padding: '3px 14px', borderRadius: 20, marginBottom: 10,
            border: `1px solid ${rc.hex}40`, background: `${rc.hex}10`,
            fontFamily: 'Cinzel, serif', fontSize: 15, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#ffffff',
          }}>{rc.label}</div>
          <h2 style={{ fontFamily: 'Cinzel Decorative, serif', fontSize: 28, fontWeight: 700, color: '#ffffff', lineHeight: 1.25, marginBottom: 10 }}>
            {result.wonItem?.name ?? 'Предмет выдан!'}
          </h2>
          {result.wonItem?.imageUrl && (
            <div style={{
              margin: '0 auto 12px', width: 72, height: 72, borderRadius: 12,
              background: '#06060e', border: `1px solid ${rc.hex}30`,
              boxShadow: `0 0 20px ${rc.glow}`, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={result.wonItem.imageUrl} alt="" style={{ width: 58, height: 58, objectFit: 'contain' }} />
            </div>
          )}
          <p style={{ fontSize: 20, color: '#ffffff', marginBottom: 16, fontWeight: 700 }}>
            Остаток DKP: <span style={{ color: '#fbbf24', fontWeight: 800 }}>{result.remainingBalance}</span>
          </p>
          <button onClick={() => setProof(p => !p)} style={{
            display: 'block', width: '100%', marginBottom: 10, padding: '6px',
            background: 'transparent', border: '1px solid #161630', borderRadius: 8,
            color: '#ffffff', fontSize: 15, fontFamily: 'Manrope, sans-serif', cursor: 'pointer',
          }}>🔒 Provably fair {proof ? '▲' : '▼'}</button>
          {proof && (
            <div style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 8,
              background: '#04040c', border: '1px solid #0e0e20',
              fontFamily: 'monospace', fontSize: 13, color: '#f8fafc',
              wordBreak: 'break-all', marginBottom: 12, lineHeight: 1.7,
            }}>
              <div style={{ color: '#f8fafc', marginBottom: 2 }}>Seed:</div>{result.seed}
              <div style={{ color: '#f8fafc', margin: '4px 0 2px' }}>SHA-256:</div>{result.spinHash}
            </div>
          )}
          <button onClick={onClose} style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${rc.hex} 0%, ${rc.hex}cc 100%)`,
            color: ['EPIC', 'LEGENDARY', 'PLATINUM'].includes(result.wonRarity) ? '#0a0014' : '#0c0c0c',
            fontFamily: 'Cinzel, serif', fontSize: 22, fontWeight: 700, letterSpacing: '0.06em',
            boxShadow: `0 6px 24px ${rc.glow}`,
          }}>Забрать добычу ★</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHANCES TABLE
═══════════════════════════════════════════════════════════════ */
function ChancesTable({ chances, activeBet }: { chances: Chances; activeBet: number }) {
  return (
    <div style={{ padding: '14px 14px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', paddingBottom: 8, fontFamily: 'Cinzel, serif', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff', fontWeight: 700 }}>Редкость</th>
            {BETS.map(b => (
              <th key={b.val} style={{ textAlign: 'center', paddingBottom: 8, fontFamily: 'Cinzel, serif', fontSize: 13, fontWeight: 700, color: b.val === activeBet ? b.color : '#ffffff', transition: 'color 0.2s' }}>{b.val}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'] as Rarity[]).map(rarity => {
            const r = RC[rarity];
            return (
              <tr key={rarity} style={{ borderTop: '1px solid #0a0a18' }}>
                <td style={{ padding: '8px 0', color: r.hex, fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15 }}>{r.icon} {r.label}</td>
                {BETS.map(b => (
                  <td key={b.val} style={{
                    textAlign: 'center', padding: '8px 2px',
                    fontFamily: 'Cinzel, serif', fontSize: 15,
                    color: b.val === activeBet ? '#ffffff' : '#f8fafc',
                    fontWeight: b.val === activeBet ? 700 : 400,
                    background: b.val === activeBet ? `${b.color}06` : 'transparent',
                    transition: 'all 0.2s',
                  }}>{chances[b.val]?.[rarity]?.toFixed(1)}%</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 8,
        background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
        fontSize: 15, color: '#ffffff', fontStyle: 'normal', fontFamily: 'Manrope, sans-serif', lineHeight: 1.55,
      }}>
        Чем выше ставка — тем больше множитель для редкого лута
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export function FortuneWheelPage() {
  const { user }      = useAuthStore();
  const clanId        = user?.clanMembership?.clanId ?? '';
  const queryClient   = useQueryClient();
  const spinItemsRef  = useRef<FortuneItem[]>([]);
  const wheelWrapRef  = useRef<HTMLDivElement>(null);

  const [bet,    setBet]   = useState(10);
  const [spin,   setSpin]  = useState(false);
  const [tidx,   setTidx]  = useState<number | null>(null);
  const [win,    setWin]   = useState<SpinResult | null>(null);
  const [pend,   setPend]  = useState<SpinResult | null>(null);
  const [tab,    setTab]   = useState<'loot' | 'odds'>('loot');
  const [wSize,  setWSize] = useState(320);

  /* measure wheel container → derive canvas size */
  useEffect(() => {
    const el = wheelWrapRef.current; if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setWSize(Math.floor(Math.min(width, height) * 0.96));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { data: items = [] }  = useQuery<FortuneItem[]>({ queryKey: ['fortune-items', clanId],   queryFn: () => api.get('/fortune/items').then(r => r.data),   enabled: !!clanId });
  const { data: balD }        = useQuery<{ balance: number }>({ queryKey: ['fortune-bal', user?.id], queryFn: () => api.get('/fortune/balance').then(r => r.data), enabled: !!user, refetchInterval: 30_000 });
  const { data: logs = [] }   = useQuery<SpinLog[]>({ queryKey: ['fortune-logs', clanId],        queryFn: () => api.get('/fortune/logs?limit=40').then(r => r.data), refetchInterval: 8_000, enabled: !!clanId });
  const { data: chances }     = useQuery<Chances>({ queryKey: ['fortune-chances'],                queryFn: () => api.get('/fortune/chances').then(r => r.data) });

  const mut = useMutation({
    mutationFn: (b: number) => api.post('/fortune/spin', { bet: b }).then(r => r.data),
    onSuccess: (res: SpinResult) => {
      if (clanId && res.wonItem?.id) {
        queryClient.setQueryData<FortuneItem[]>(['fortune-items', clanId], (prev = []) =>
          prev
            .map((item) => item.id === res.wonItem!.id ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item)
            .filter((item) => item.quantity > 0),
        );
      }
      if (user?.id) {
        queryClient.setQueryData<{ balance: number }>(['fortune-bal', user.id], { balance: res.remainingBalance });
      }

      const base = spinItemsRef.current.length > 0 ? spinItemsRef.current : items;
      let idx = base.findIndex(it => it.id === res.wonItem?.id);
      if (idx < 0 && res.wonItem) idx = base.findIndex(it => it.name === res.wonItem?.name && it.rarity === res.wonItem?.rarity);
      if (idx < 0) idx = base.findIndex(it => it.rarity === res.wonRarity);
      setTidx(idx >= 0 ? idx : 0);
      setPend(res);
    },
    onError: (e: any) => { setSpin(false); toast.error(e?.response?.data?.message ?? 'Ошибка при прокрутке'); },
  });

  const handleSpin = () => {
    if (spin || !clanId) return;
    spinItemsRef.current = [...items];
    setSpin(true); setTidx(null); setPend(null);
    mut.mutate(bet);
  };

  const handleComplete = useCallback(() => {
    if (pend) {
      setWin(pend);
      if (clanId) {
        queryClient.invalidateQueries({ queryKey: ['fortune-items', clanId] });
        queryClient.invalidateQueries({ queryKey: ['fortune-logs', clanId] });
      }
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['fortune-bal', user.id] });
      }
    }
    setSpin(false);
  }, [pend, queryClient, clanId, user?.id]);

  const closeWin = () => { setWin(null); setPend(null); setTidx(null); };

  const balance    = balD?.balance ?? 0;
  const activeBet  = BETS.find(b => b.val === bet)!;
  const canSpin    = !spin && balance >= bet && items.length > 0;
  const wheelItems = spin && spinItemsRef.current.length > 0 ? spinItemsRef.current : items;

  return (
    <>
      <style>{CSS}</style>
      <div className="fw-root">
        {/* background */}
        <div className="fw-bg" />
        <div className="fw-vignette" />

        {/* ── HEADER ─────────────────────────────────── */}
        <header className="fw-header">
          <div>
            <div className="fw-title">🎡 Колесо Фортуны</div>
            <div style={{ color: '#ffffff', fontSize: 20, marginTop: 4, fontWeight: 700 }}>
              Испытай удачу — выиграй лут из хранилища клана
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="fw-balance-label">Ваш DKP</div>
            <div className="fw-balance-val">{balance}</div>
          </div>
        </header>

        {/* ── BODY ───────────────────────────────────── */}
        <div className="fw-body">

          {/* ── LEFT ── */}
          <div className="fw-left">

            {/* Wheel – expands to fill available space */}
            <div ref={wheelWrapRef} className="fw-wheel-wrap">
              {/* pulse rings */}
              <div className="fw-pulse" style={{
                position: 'absolute', width: wSize + 44, height: wSize + 44, borderRadius: '50%',
                border: `1px solid ${activeBet.color}16`, pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', width: wSize + 28, height: wSize + 28, borderRadius: '50%',
                border: `1px solid ${activeBet.color}0e`, pointerEvents: 'none',
              }} />
              {spin && (
                <div className="fw-wheel-glow" style={{
                  position: 'absolute', width: wSize + 36, height: wSize + 36, borderRadius: '50%',
                  border: `2px solid ${activeBet.color}45`,
                  boxShadow: `0 0 40px ${activeBet.color}20`, pointerEvents: 'none',
                }} />
              )}
              <WheelCanvas
                items={wheelItems} spinning={spin}
                targetIndex={tidx} onSpinComplete={handleComplete}
                size={wSize}
              />
              <Embers color={activeBet.color} active={spin} />
            </div>

            {/* rune divider */}
            <div className="fw-rune">✦ ◈ ✦ ◈ ✦ ◈ ✦ ◈ ✦</div>

            {/* Bets */}
            <div className="fw-bets">
              {BETS.map(b => {
                const active = bet === b.val;
                return (
                  <button key={b.val}
                    className={`fw-bet-btn${active ? ' active' : ''}`}
                    onClick={() => !spin && setBet(b.val)}
                    disabled={spin}
                    style={{
                      borderColor: active ? b.color + '55' : '#161626',
                      background: active ? `linear-gradient(170deg, ${b.dark} 0%, ${b.color}16 100%)` : '#0a0a14',
                      boxShadow: active ? `0 0 20px ${b.color}25, inset 0 1px 0 ${b.color}15` : 'none',
                    }}
                  >
                    <div className="fw-bet-roman" style={{ color: active ? b.color : '#ffffff', textShadow: active ? `0 0 12px ${b.color}` : 'none' }}>{b.roman}</div>
                    <div className="fw-bet-label" style={{ color: active ? b.color : '#ffffff' }}>{b.label}</div>
                    <div className="fw-bet-val" style={{ color: '#ffffff' }}>{b.val}</div>
                    <div className="fw-bet-dkp">DKP</div>
                    {balance < b.val && <div className="fw-bet-dot" />}
                  </button>
                );
              })}
            </div>

            {/* Spin button */}
            <button className="fw-spin-btn" onClick={handleSpin} disabled={!canSpin} style={{
              border: `1px solid ${canSpin ? activeBet.color + '40' : '#0e0e1c'}`,
              background: canSpin
                ? `linear-gradient(135deg, ${activeBet.dark} 0%, ${activeBet.color}e0 45%, ${activeBet.dark} 100%)`
                : '#08080f',
              color: canSpin ? '#0a0a0a' : '#ffffff',
              boxShadow: canSpin ? `0 0 32px ${activeBet.color}28, 0 6px 20px rgba(0,0,0,0.7)` : 'none',
            }}>
              {spin
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg className="fw-spin-icon" style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Вращение…
                  </span>
                : !canSpin && balance < bet ? '⚠ Недостаточно DKP'
                : items.length === 0 ? 'Нет предметов в колесе'
                : `✦ Крутить за ${bet} DKP`}
            </button>

          </div>

          {/* ── RIGHT ── */}
          <div className="fw-right">

            {/* Top panel: Loot / Odds tabs */}
            <div className="fw-panel" style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="fw-tabs">
                <button className={`fw-tab${tab === 'loot' ? ' active' : ''}`} onClick={() => setTab('loot')}>
                  ⚔ Лут ({items.length})
                </button>
                <button className={`fw-tab${tab === 'odds' ? ' active' : ''}`} onClick={() => setTab('odds')}>
                  ◈ Шансы
                </button>
              </div>

              <div className="fw-panel-body">
                {tab === 'loot' ? (
                  items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '28px 16px', color: '#ffffff', fontStyle: 'normal', fontSize: 18, fontWeight: 700 }}>
                      Нет предметов.<br />
                      <span style={{ fontSize: 16, color: '#ffffff' }}>Отметьте в хранилище как «Доступен в Фортуне»</span>
                    </div>
                  ) : (
                    items.map((item, i) => {
                      const r = RC[item.rarity as Rarity] || RC.COMMON;
                      return (
                        <div key={item.id} className="fw-loot-item fw-row-in"
                          style={{ borderLeft: `3px solid ${r.hex}50`, animationDelay: `${i * 0.03}s` }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                            background: `${r.hex}0d`, border: `1px solid ${r.hex}25`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                          }}>
                            {item.imageUrl
                              ? <img src={item.imageUrl} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
                              : <span style={{ fontSize: 16, color: r.hex }}>{r.icon}</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Manrope, sans-serif', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                            <div style={{ color: r.hex, fontSize: 15, fontWeight: 700 }}>{r.label}</div>
                          </div>
                          <div style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Cinzel, serif', flexShrink: 0 }}>×{item.quantity}</div>
                        </div>
                      );
                    })
                  )
                ) : (
                  chances ? <ChancesTable chances={chances} activeBet={bet} /> : null
                )}
              </div>
            </div>

            {/* Bottom panel: Logs */}
            <div className="fw-panel" style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="fw-panel-head">
                <span style={{ color: '#fbbf24' }}>⚡</span>
                Последние выигрыши
              </div>
              <div className="fw-panel-body" style={{ padding: '4px 0' }}>
                {logs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#ffffff', fontStyle: 'normal', fontSize: 18, fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>
                    Ещё никто не испытал удачу…
                  </div>
                ) : (
                  logs.map((log, i) => {
                    const rc = RC[log.wonRarity as Rarity] || RC.COMMON;
                    const ago = (() => {
                      const s = Math.floor((Date.now() - new Date(log.createdAt).getTime()) / 1000);
                      if (s < 60) return `${s}с`; if (s < 3600) return `${Math.floor(s / 60)}м`;
                      return `${Math.floor(s / 3600)}ч`;
                    })();
                    return (
                      <div key={log.id} className="fw-log-item fw-row-in"
                        style={{ borderLeft: `3px solid ${rc.hex}45`, animationDelay: `${i * 0.035}s` }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          border: `1px solid ${rc.hex}30`, overflow: 'hidden',
                          background: log.user.avatarUrl ? 'transparent' : `${rc.hex}15`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, color: rc.hex, fontFamily: 'Cinzel, serif', fontWeight: 700,
                        }}>
                          {log.user.avatarUrl
                            ? <img src={log.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : log.user.username[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ color: '#ffffff', fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.user.username}</span>
                            <span style={{ color: '#ffffff', fontSize: 12, flexShrink: 0 }}>·</span>
                            <span style={{ color: '#ffffff', fontSize: 14, flexShrink: 0, fontWeight: 700 }}>{log.bet} DKP</span>
                          </div>
                          <div style={{ fontSize: 15, color: rc.hex, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rc.icon} {log.wonItem?.name ?? rc.label}
                          </div>
                        </div>
                        <span style={{ color: '#ffffff', fontSize: 14, flexShrink: 0, fontWeight: 700 }}>{ago}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {win && <WinModal result={win} onClose={closeWin} />}
    </>
  );
}

export default FortuneWheelPage;
