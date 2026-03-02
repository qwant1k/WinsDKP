import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { useClanStore } from '../../stores/clan.store';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────
interface FortuneItem {
  id: string;
  name: string;
  rarity: Rarity;
  imageUrl?: string;
  description?: string;
  quantity: number;
}

interface SpinLog {
  id: string;
  bet: number;
  wonRarity: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl?: string };
  wonItem?: { id: string; name: string; rarity: string; imageUrl?: string };
}

interface SpinResult {
  wonItem?: FortuneItem;
  wonRarity: Rarity;
  spinHash: string;
  seed: string;
  remainingBalance: number;
}

interface Chances {
  [bet: number]: { COMMON: number; UNCOMMON: number; RARE: number; EPIC: number; LEGENDARY: number };
}

type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

// ─── Constants ────────────────────────────────────────────────
const RARITY_CONFIG: Record<Rarity, { label: string; color: string; glow: string; emoji: string }> = {
  COMMON:    { label: 'Обычный',     color: '#9ca3af', glow: '#9ca3af40', emoji: '⚪' },
  UNCOMMON:  { label: 'Необычный',   color: '#22c55e', glow: '#22c55e40', emoji: '🟢' },
  RARE:      { label: 'Редкий',      color: '#3b82f6', glow: '#3b82f640', emoji: '🔵' },
  EPIC:      { label: 'Эпический',   color: '#a855f7', glow: '#a855f740', emoji: '🟣' },
  LEGENDARY: { label: 'Легендарный', color: '#f59e0b', glow: '#f59e0b60', emoji: '🟡' },
};

const BET_LABELS: Record<number, string> = {
  5: 'Бронза',
  10: 'Серебро',
  15: 'Золото',
  20: 'Платина',
};

const BET_COLORS: Record<number, string> = {
  5:  '#cd7f32',
  10: '#c0c0c0',
  15: '#ffd700',
  20: '#e5e4e2',
};

// ─── Wheel Canvas ─────────────────────────────────────────────
function WheelCanvas({
  items,
  spinning,
  targetIndex,
  onSpinComplete,
}: {
  items: FortuneItem[];
  spinning: boolean;
  targetIndex: number | null;
  onSpinComplete: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const targetAngleRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const segments = items.length || 8;
  const segmentAngle = (2 * Math.PI) / segments;

  const drawWheel = useCallback((currentAngle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 8;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Outer glow ring
    const gradient = ctx.createRadialGradient(cx, cy, r - 6, cx, cy, r + 4);
    gradient.addColorStop(0, 'rgba(251, 191, 36, 0.6)');
    gradient.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 8;
    ctx.stroke();

    if (items.length === 0) {
      // Placeholder wheel
      for (let i = 0; i < 8; i++) {
        const startAngle = currentAngle + i * segmentAngle;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, startAngle + segmentAngle);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? '#1e293b' : '#0f172a';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else {
      items.forEach((item, i) => {
        const startAngle = currentAngle + i * segmentAngle;
        const midAngle = startAngle + segmentAngle / 2;
        const rc = RARITY_CONFIG[item.rarity as Rarity] || RARITY_CONFIG.COMMON;

        // Segment
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, startAngle + segmentAngle);
        ctx.closePath();

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.6, '#1e293b');
        grad.addColorStop(1, rc.color + '60');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = rc.color + '80';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Item name text
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(midAngle);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#e2e8f0';
        ctx.font = `bold ${Math.max(9, Math.min(12, 160 / segments))}px 'Cinzel', serif`;
        ctx.shadowColor = rc.color;
        ctx.shadowBlur = 6;
        const text = item.name.length > 12 ? item.name.slice(0, 11) + '…' : item.name;
        ctx.fillText(text, r - 10, 4);
        ctx.restore();

        // Rarity dot near edge
        const dotX = cx + (r - 18) * Math.cos(midAngle);
        const dotY = cy + (r - 18) * Math.sin(midAngle);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fillStyle = rc.color;
        ctx.shadowColor = rc.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    // Center circle
    const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
    centerGrad.addColorStop(0, '#fbbf24');
    centerGrad.addColorStop(0.5, '#d97706');
    centerGrad.addColorStop(1, '#92400e');
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fillStyle = centerGrad;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#1a0a00';
    ctx.font = 'bold 11px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('УДАЧА', cx, cy);

    // Pointer (top)
    ctx.beginPath();
    ctx.moveTo(cx - 12, 6);
    ctx.lineTo(cx + 12, 6);
    ctx.lineTo(cx, 36);
    ctx.closePath();
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [items, segmentAngle, segments]);

  useEffect(() => {
    drawWheel(angleRef.current);
  }, [drawWheel, items]);

  useEffect(() => {
    if (!spinning || targetIndex === null || items.length === 0) return;

    doneRef.current = false;
    const segAngle = (2 * Math.PI) / items.length;

    // Target: pointer (top = -PI/2) points to targetIndex segment center
    const targetCenter = targetIndex * segAngle + segAngle / 2;
    const alignAngle = -Math.PI / 2 - targetCenter;

    // Spin at least 5 full rotations + land on target
    const currentNorm = ((angleRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const targetNorm = ((alignAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const diff = (targetNorm - currentNorm + 2 * Math.PI) % (2 * Math.PI);
    targetAngleRef.current = angleRef.current + 5 * 2 * Math.PI + diff;
    velocityRef.current = 0.35;

    const animate = () => {
      const target = targetAngleRef.current!;
      const remaining = target - angleRef.current;

      if (remaining <= 0) {
        angleRef.current = target;
        drawWheel(angleRef.current);
        if (!doneRef.current) {
          doneRef.current = true;
          onSpinComplete();
        }
        return;
      }

      // Ease-out: slow down as we approach target
      const progress = 1 - remaining / (5 * 2 * Math.PI + ((target - angleRef.current) % (2 * Math.PI)));
      const speed = Math.max(0.003, velocityRef.current * (1 - Math.pow(Math.max(0, 1 - remaining / (2 * Math.PI * 1.5)), 3)));
      angleRef.current += speed;
      velocityRef.current = speed;

      drawWheel(angleRef.current);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current!);
  }, [spinning, targetIndex, items, drawWheel, onSpinComplete]);

  return (
    <canvas
      ref={canvasRef}
      width={340}
      height={340}
      className="drop-shadow-2xl"
      style={{ filter: spinning ? 'drop-shadow(0 0 20px rgba(251,191,36,0.5))' : undefined }}
    />
  );
}

// ─── Win Modal ────────────────────────────────────────────────
function WinModal({ result, onClose }: { result: SpinResult; onClose: () => void }) {
  const rc = RARITY_CONFIG[result.wonRarity] || RARITY_CONFIG.COMMON;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-80 rounded-2xl border p-6 text-center"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderColor: rc.color,
          boxShadow: `0 0 40px ${rc.glow}, 0 0 80px ${rc.glow}`,
        }}
      >
        {/* Particles effect */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute h-1 w-1 rounded-full animate-ping"
              style={{
                background: rc.color,
                left: `${Math.random() * 90 + 5}%`,
                top: `${Math.random() * 90 + 5}%`,
                animationDelay: `${i * 0.15}s`,
                animationDuration: `${0.8 + Math.random() * 0.6}s`,
              }}
            />
          ))}
        </div>

        <div className="text-4xl mb-2">{rc.emoji}</div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: rc.color }}>
          {rc.label}
        </div>
        <h2 className="text-xl font-bold text-white mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
          {result.wonItem ? result.wonItem.name : 'Предмет выдан!'}
        </h2>
        {result.wonItem?.imageUrl && (
          <img
            src={result.wonItem.imageUrl}
            alt={result.wonItem.name}
            className="w-20 h-20 object-contain mx-auto mb-3 rounded-lg"
          />
        )}
        <p className="text-slate-400 text-sm mb-4">
          Остаток DKP: <span className="text-white font-semibold">{result.remainingBalance}</span>
        </p>
        <details className="text-left mb-4">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">🔒 Proof of fairness</summary>
          <div className="mt-2 space-y-1 font-mono text-xs text-slate-500 break-all">
            <div>Seed: {result.seed}</div>
            <div>Hash: {result.spinHash}</div>
          </div>
        </details>
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg font-semibold text-sm transition-all hover:opacity-90"
          style={{ background: rc.color, color: '#0f172a' }}
        >
          Забрать!
        </button>
      </div>
    </div>
  );
}

// ─── Spin Logs ────────────────────────────────────────────────
function SpinLogs({ clanId }: { clanId: string }) {
  const { data: logs = [] } = useQuery<SpinLog[]>({
    queryKey: ['fortune-logs', clanId],
    queryFn: () => api.get('/fortune/logs?limit=30').then((r) => r.data),
    refetchInterval: 10_000,
  });

  if (logs.length === 0) {
    return (
      <div className="text-center text-slate-500 text-sm py-8">
        Ещё никто не крутил колесо…
      </div>
    );
  }

  return (
    <ul className="space-y-2 max-h-96 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
      {logs.map((log) => {
        const rc = RARITY_CONFIG[(log.wonRarity as Rarity)] || RARITY_CONFIG.COMMON;
        return (
          <li
            key={log.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-slate-800/50"
            style={{ borderLeft: `3px solid ${rc.color}` }}
          >
            {log.user.avatarUrl ? (
              <img src={log.user.avatarUrl} alt="" className="w-7 h-7 rounded-full shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs shrink-0">
                {log.user.username[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-sm">
                <span className="font-medium text-white truncate">{log.user.username}</span>
                <span className="text-slate-500 shrink-0">•</span>
                <span className="text-slate-400 shrink-0">{log.bet} DKP</span>
              </div>
              <div className="text-xs" style={{ color: rc.color }}>
                {rc.emoji} {log.wonItem?.name ?? rc.label}
              </div>
            </div>
            <div className="text-xs text-slate-600 shrink-0">
              {new Date(log.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Chances Table ────────────────────────────────────────────
function ChancesTable({ chances, activeBet }: { chances: Chances; activeBet: number }) {
  const rarities: Rarity[] = ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-slate-500 pb-2 font-medium">Редкость</th>
            {[5, 10, 15, 20].map((bet) => (
              <th
                key={bet}
                className="text-center pb-2 font-medium transition-colors"
                style={{ color: bet === activeBet ? BET_COLORS[bet] : '#64748b' }}
              >
                {bet}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rarities.map((rarity) => {
            const rc = RARITY_CONFIG[rarity];
            return (
              <tr key={rarity}>
                <td className="py-1.5 pr-3">
                  <span style={{ color: rc.color }}>{rc.emoji} {rc.label}</span>
                </td>
                {[5, 10, 15, 20].map((bet) => (
                  <td
                    key={bet}
                    className="text-center py-1.5 tabular-nums transition-all"
                    style={{
                      color: bet === activeBet ? 'white' : '#94a3b8',
                      fontWeight: bet === activeBet ? 700 : 400,
                    }}
                  >
                    {chances[bet]?.[rarity]?.toFixed(1)}%
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function FortuneWheelPage() {
  const { user } = useAuthStore();
  const { activeClan } = useClanStore();
  const clanId = activeClan?.id ?? '';
  const queryClient = useQueryClient();

  const [selectedBet, setSelectedBet] = useState<number>(10);
  const [spinning, setSpinning] = useState(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [winResult, setWinResult] = useState<SpinResult | null>(null);
  const [pendingResult, setPendingResult] = useState<SpinResult | null>(null);

  // ── Queries ─────────────────────────────────────────────────
  const { data: items = [] } = useQuery<FortuneItem[]>({
    queryKey: ['fortune-items', clanId],
    queryFn: () => api.get('/fortune/items').then((r) => r.data),
    enabled: !!clanId,
  });

  const { data: balanceData } = useQuery<{ balance: number }>({
    queryKey: ['fortune-balance', user?.id],
    queryFn: () => api.get('/fortune/balance').then((r) => r.data),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const { data: chances } = useQuery<Chances>({
    queryKey: ['fortune-chances'],
    queryFn: () => api.get('/fortune/chances').then((r) => r.data),
  });

  // ── Spin mutation ────────────────────────────────────────────
  const spinMutation = useMutation({
    mutationFn: (bet: number) => api.post('/fortune/spin', { bet }).then((r) => r.data),
    onSuccess: (result: SpinResult) => {
      // Find the index of the won item in the wheel
      const idx = items.findIndex((it) => it.id === result.wonItem?.id);
      const resolvedIdx = idx >= 0 ? idx : Math.floor(Math.random() * items.length);
      setTargetIndex(resolvedIdx);
      setPendingResult(result);
    },
    onError: (err: any) => {
      setSpinning(false);
      toast.error(err?.response?.data?.message ?? 'Ошибка при прокрутке');
    },
  });

  const handleSpin = () => {
    if (spinning || !clanId) return;
    setSpinning(true);
    setTargetIndex(null);
    setPendingResult(null);
    spinMutation.mutate(selectedBet);
  };

  const handleSpinComplete = useCallback(() => {
    if (pendingResult) {
      setWinResult(pendingResult);
      queryClient.invalidateQueries({ queryKey: ['fortune-logs'] });
      queryClient.invalidateQueries({ queryKey: ['fortune-balance'] });
      queryClient.invalidateQueries({ queryKey: ['fortune-items'] });
    }
    setSpinning(false);
  }, [pendingResult, queryClient]);

  const handleCloseWin = () => {
    setWinResult(null);
    setPendingResult(null);
    setTargetIndex(null);
  };

  const balance = balanceData?.balance ?? 0;
  const canSpin = !spinning && balance >= selectedBet && items.length > 0;

  return (
    <>
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap');`}</style>

      <div
        className="min-h-screen text-white"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, #1e1040 0%, #0f0f1a 50%, #060610 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div className="border-b border-slate-800/60 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1
                className="text-2xl font-bold tracking-wide"
                style={{ fontFamily: 'Cinzel, serif', color: '#fbbf24' }}
              >
                🎡 Колесо Фортуны
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">Испытай удачу — выиграй лут из хранилища</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Ваш баланс</div>
              <div className="text-xl font-bold text-amber-400">{balance} DKP</div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
          {/* Left: Wheel + Controls */}
          <div className="space-y-6">
            {/* Wheel */}
            <div className="flex justify-center">
              <div className="relative">
                {/* Decorative glow ring */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, transparent 40%, rgba(251,191,36,0.05) 100%)',
                    transform: 'scale(1.15)',
                  }}
                />
                <WheelCanvas
                  items={items}
                  spinning={spinning}
                  targetIndex={targetIndex}
                  onSpinComplete={handleSpinComplete}
                />
              </div>
            </div>

            {/* Bet selector */}
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest text-center mb-3">Выберите ставку</div>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((bet) => (
                  <button
                    key={bet}
                    onClick={() => !spinning && setSelectedBet(bet)}
                    disabled={spinning}
                    className="relative rounded-xl py-3 px-2 text-center transition-all duration-200 border"
                    style={{
                      borderColor: selectedBet === bet ? BET_COLORS[bet] : '#1e293b',
                      background: selectedBet === bet
                        ? `linear-gradient(135deg, ${BET_COLORS[bet]}20, ${BET_COLORS[bet]}08)`
                        : '#0f172a',
                      boxShadow: selectedBet === bet ? `0 0 16px ${BET_COLORS[bet]}40` : 'none',
                    }}
                  >
                    <div
                      className="text-xs font-semibold mb-0.5"
                      style={{ color: selectedBet === bet ? BET_COLORS[bet] : '#64748b' }}
                    >
                      {BET_LABELS[bet]}
                    </div>
                    <div
                      className="text-lg font-bold"
                      style={{ color: selectedBet === bet ? 'white' : '#94a3b8' }}
                    >
                      {bet}
                    </div>
                    <div className="text-xs text-slate-600">DKP</div>
                    {balance < bet && (
                      <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Spin button */}
            <button
              onClick={handleSpin}
              disabled={!canSpin}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 relative overflow-hidden"
              style={{
                background: canSpin
                  ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)'
                  : '#1e293b',
                color: canSpin ? '#0f172a' : '#475569',
                boxShadow: canSpin ? '0 0 30px rgba(251,191,36,0.4), 0 4px 15px rgba(0,0,0,0.5)' : 'none',
                fontFamily: 'Cinzel, serif',
                letterSpacing: '0.1em',
              }}
            >
              {spinning ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  Крутим…
                </span>
              ) : !canSpin && balance < selectedBet ? (
                'Недостаточно DKP'
              ) : items.length === 0 ? (
                'Нет предметов'
              ) : (
                `🎡 Крутить за ${selectedBet} DKP`
              )}
            </button>

            {/* Chances table */}
            {chances && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">
                  Шансы выпадения
                </div>
                <ChancesTable chances={chances} activeBet={selectedBet} />
              </div>
            )}
          </div>

          {/* Right: Loot list + Logs */}
          <div className="space-y-6">
            {/* Available items */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">
                Лут в колесе ({items.length})
              </div>
              {items.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">
                  Нет предметов. Отметьте нужные в хранилище как «Доступен в Фортуне»
                </p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {items.map((item) => {
                    const rc = RARITY_CONFIG[item.rarity as Rarity] || RARITY_CONFIG.COMMON;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                        style={{ borderLeft: `2px solid ${rc.color}` }}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-8 h-8 rounded object-contain shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-sm shrink-0">
                            {rc.emoji}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{item.name}</div>
                          <div className="text-xs" style={{ color: rc.color }}>{rc.label}</div>
                        </div>
                        <div className="text-xs text-slate-600 shrink-0">×{item.quantity}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Win logs */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">
                Последние выигрыши
              </div>
              <SpinLogs clanId={clanId} />
            </div>
          </div>
        </div>
      </div>

      {/* Win modal */}
      {winResult && <WinModal result={winResult} onClose={handleCloseWin} />}
    </>
  );
}
