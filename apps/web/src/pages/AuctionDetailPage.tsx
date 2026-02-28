import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useState, useEffect, useRef, useCallback, useMemo, CSSProperties,
} from 'react';
import { getSocket, joinAuctionRoom, leaveAuctionRoom } from '@/lib/socket';
import { AnimatePresence, motion } from 'framer-motion';
import { ChampionNickname } from '@/components/common/ChampionNickname';
import { getRarityBgClass, getRarityClass, getRarityLabel } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Bid {
  id: string;
  userId: string;
  amount: number | string;
  isAutoBid: boolean;
  user?: { profile?: { nickname?: string; isServerChampion?: boolean } };
}
interface LotResult {
  winnerId?: string;
  finalPrice?: number | string;
  status: string;
  winner?: { profile?: { nickname?: string; isServerChampion?: boolean } };
}
interface Lot {
  id: string;
  warehouseItemId: string | null;
  itemName?: string | null;
  itemRarity?: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SOLD' | 'UNSOLD';
  quantity: number;
  startPrice: number | string;
  currentPrice: number | string | null;
  minStep: number | string;
  endsAt: string | null;
  sortOrder: number;
  warehouseItem?: { id: string; name: string; rarity: string };
  bids: Bid[];
  result?: LotResult;
}
interface WinnerData {
  nickname: string;
  itemName: string;
  itemRarity: string;
  finalPrice: number;
}
interface WarehouseItem {
  id: string;
  name: string;
  rarity: string;
  quantity: number;
}

// ─── Rarity ───────────────────────────────────────────────────────────────────
const RC: Record<string, { color: string; glow: string; bg: string; label: string }> = {
  MYTHIC:    { color: '#D946EF', glow: 'rgba(217,70,239,0.35)',  bg: 'rgba(217,70,239,0.09)',  label: 'Мифический'  },
  LEGENDARY: { color: '#FFD700', glow: 'rgba(255,215,0,0.35)',   bg: 'rgba(255,215,0,0.09)',   label: 'Легендарный' },
  EPIC:      { color: '#F87171', glow: 'rgba(248,113,113,0.35)',  bg: 'rgba(248,113,113,0.09)',  label: 'Эпический'  },
  RARE:      { color: '#4F8FE8', glow: 'rgba(79,143,232,0.35)',  bg: 'rgba(79,143,232,0.09)',  label: 'Редкий'     },
  UNCOMMON:  { color: '#4FCE8A', glow: 'rgba(79,206,138,0.35)',  bg: 'rgba(79,206,138,0.09)',  label: 'Необычный'  },
  COMMON:    { color: '#9CA3AF', glow: 'rgba(156,163,175,0.2)',  bg: 'rgba(156,163,175,0.05)', label: 'Обычный'    },
};
const rc = (r?: string) => RC[r ?? ''] ?? RC.COMMON;
const fmtDkp = (n: number | string) => `${Number(n).toLocaleString()} DKP`;
const fmtTime = (ms: number) => {
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ─── Confetti ─────────────────────────────────────────────────────────────────
function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fire = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const COLORS = ['#FFD700','#FF6B6B','#4ECDC4','#A8E6CF','#FF8B94','#B4F8C8','#B44FE8','#4F8FE8','#FBE7C6'];
    const particles = Array.from({ length: 280 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height * 0.7,
      r: Math.random() * 9 + 3,
      d: Math.random() * 200,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      tiltAngle: 0,
      tiltAngleInc: Math.random() * 0.07 + 0.04,
      vy: Math.random() * 2.8 + 1.5,
      vx: (Math.random() - 0.5) * 3,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));
    let frame: number, tick = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick++;
      for (const p of particles) {
        p.tiltAngle += p.tiltAngleInc;
        p.y += (Math.cos(p.d + tick / 50) + p.vy) * 0.75;
        p.x += p.vx + Math.sin(tick / 40) * 0.4;
        const tilt = Math.sin(p.tiltAngle) * 14;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(tilt * 0.1);
        ctx.fillStyle = p.color;
        if (p.shape === 'circle') {
          ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        }
        ctx.restore();
        if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    setTimeout(() => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, canvas.width, canvas.height); }, 5500);
  }, []);
  return { canvasRef, fire };
}

// ─── Winner Overlay ───────────────────────────────────────────────────────────
function WinnerOverlay({ winner, onClose }: { winner: WinnerData; onClose: () => void }) {
  const [ph, setPh] = useState(0);
  const r = rc(winner.itemRarity);
  const ease = 'cubic-bezier(0.34,1.56,0.64,1)';

  useEffect(() => {
    const ts = [
      setTimeout(() => setPh(1), 60),
      setTimeout(() => setPh(2), 320),
      setTimeout(() => setPh(3), 750),
      setTimeout(onClose, 6200),
    ];
    return () => ts.forEach(clearTimeout);
  }, [onClose]);

  const s = (extra: CSSProperties = {}): CSSProperties => ({
    transition: 'all 0.4s ease',
    opacity: ph >= 3 ? 1 : 0,
    ...extra,
  });

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.93)',
      backdropFilter: 'blur(18px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: ph >= 1 ? 1 : 0,
      transition: 'opacity 0.3s',
      cursor: 'pointer',
    }}>
      {/* Glow orb */}
      <div style={{
        position: 'absolute', width: 700, height: 700, borderRadius: '50%',
        background: `radial-gradient(circle, ${r.color}1a 0%, transparent 65%)`,
        transform: ph >= 2 ? 'scale(1)' : 'scale(0)',
        transition: `transform 0.7s ${ease}`,
        pointerEvents: 'none',
      }} />

      <div onClick={e => e.stopPropagation()} style={{
        textAlign: 'center', position: 'relative', zIndex: 2,
        transform: ph >= 2 ? 'scale(1) translateY(0)' : 'scale(0.35) translateY(90px)',
        transition: `transform 0.6s ${ease}`,
      }}>
        {/* Trophy */}
        <div style={{
          fontSize: 120, lineHeight: 1, display: 'inline-block',
          filter: `drop-shadow(0 0 40px ${r.color}99)`,
          animation: ph >= 3 ? 'trophyBounce 0.6s ease' : 'none',
        }}>🏆</div>

        {/* WINNER */}
        <div style={{
          fontFamily: '"Georgia","Times New Roman",serif',
          fontSize: 'clamp(58px,10.5vw,92px)',
          fontWeight: 900, letterSpacing: '0.15em', lineHeight: 1, marginTop: 6,
          background: 'linear-gradient(180deg,#FFE566 0%,#FF9500 50%,#FF3D00 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          transform: ph >= 3 ? 'scaleX(1)' : 'scaleX(0.05)',
          opacity: ph >= 3 ? 1 : 0,
          transition: `transform 0.5s ${ease}, opacity 0.3s`,
        }}>WINNER</div>

        {/* Separator */}
        <div style={{
          height: 2, margin: '16px auto 0',
          background: `linear-gradient(90deg,transparent,${r.color},transparent)`,
          width: ph >= 3 ? 'min(440px,80vw)' : 0,
          transition: 'width 0.55s ease 0.2s',
        }} />

        {/* Nickname */}
        <div style={{
          fontSize: 'clamp(28px,5vw,48px)', fontWeight: 800,
          color: '#fff', fontFamily: '"Georgia",serif', marginTop: 16,
          textShadow: `0 0 60px ${r.color}88, 0 2px 20px rgba(0,0,0,0.9)`,
          ...s({ transform: ph >= 3 ? 'translateY(0)' : 'translateY(28px)', transition: 'all 0.45s ease 0.18s' }),
        }}>{winner.nickname}</div>

        {/* Item */}
        <div style={{
          fontSize: 'clamp(15px,2.6vw,22px)', color: r.color, fontWeight: 600, marginTop: 10,
          ...s({ transition: 'opacity 0.4s ease 0.28s' }),
        }}>получает <strong>{winner.itemName}</strong></div>

        {/* Price */}
        <div style={{
          fontFamily: 'monospace', fontSize: 'clamp(18px,3.2vw,30px)',
          fontWeight: 900, color: '#4FCE8A', marginTop: 8,
          textShadow: '0 0 24px rgba(79,206,138,0.55)',
          ...s({ transform: ph >= 3 ? 'scale(1)' : 'scale(0.5)', transition: `all 0.45s ${ease} 0.32s` }),
        }}>{fmtDkp(winner.finalPrice)}</div>

        {/* Rarity badge */}
        <div style={{
          display: 'inline-block', marginTop: 16, padding: '5px 18px', borderRadius: 99,
          background: r.bg, border: `1px solid ${r.color}55`,
          color: r.color, fontSize: 13, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase',
          ...s({ transition: 'opacity 0.4s ease 0.4s' }),
        }}>{r.label}</div>

        <div style={{
          marginTop: 22, fontSize: 12, color: '#555',
          animation: ph >= 3 ? 'blink 2s infinite' : 'none',
        }}>нажмите, чтобы закрыть</div>
      </div>
    </div>
  );
}

// ─── Add All Modal ────────────────────────────────────────────────────────────
function AddAllModal({
  itemCount, isPending, onClose, onConfirm,
}: { itemCount: number; isPending: boolean; onClose: () => void; onConfirm: (sp: number, ms: number, lotDurationMinutes: number | null) => void }) {
  const [sp, setSp] = useState('100');
  const [ms, setMs] = useState('10');
  const [lotDurationMinutes, setLotDurationMinutes] = useState('');
  const inp: CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 11, padding: '12px 16px', color: '#fff', fontSize: 18, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 24 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#12161f', border: '1px solid rgba(255,215,0,0.22)', borderRadius: 20, padding: 34, width: 430, boxShadow: '0 0 80px rgba(255,215,0,0.07),0 30px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
        <div style={{ fontSize: 23, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif', marginBottom: 8 }}>Добавить весь склад</div>
        <div style={{ fontSize: 14, color: '#777', marginBottom: 26, lineHeight: 1.6 }}>
          <strong style={{ color: '#FFD700' }}>{itemCount}</strong> предметов из хранилища будут добавлены как лоты с единой стартовой ценой и шагом ставки.
        </div>
        {[{ label: 'Стартовая цена (DKP)', val: sp, set: setSp }, { label: 'Минимальный шаг (DKP)', val: ms, set: setMs }].map(f => (
          <div key={f.label} style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 7 }}>{f.label}</label>
            <input type="number" value={f.val} onChange={e => f.set(e.target.value)} style={inp} />
          </div>
        ))}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 7 }}>Время лота (мин, опционально)</label>
          <input type="number" value={lotDurationMinutes} onChange={e => setLotDurationMinutes(e.target.value)} style={inp} placeholder="Пусто — логика суток/продлений" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, padding: 13, color: '#888', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Отмена</button>
          <button onClick={() => onConfirm(+sp, +ms, lotDurationMinutes ? Number(lotDurationMinutes) : null)} disabled={isPending || !sp || !ms}
            style={{ flex: 2, background: isPending ? 'rgba(255,215,0,0.4)' : 'linear-gradient(135deg,#FFD700,#FF8C00)', border: 'none', borderRadius: 11, padding: 13, color: '#000', fontWeight: 800, cursor: isPending ? 'wait' : 'pointer', fontSize: 14 }}>
            {isPending ? 'Добавление...' : `✨ Добавить ${itemCount} предметов`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Add One Modal ────────────────────────────────────────────────────────────
function AddOneModal({
  items, isPending, onClose, onConfirm,
}: { items: WarehouseItem[]; isPending: boolean; onClose: () => void; onConfirm: (id: string, qty: number, sp: number, ms: number, lotDurationMinutes: number | null) => void }) {
  const [itemId, setItemId] = useState('');
  const [rarityFilter, setRarityFilter] = useState<'ALL' | 'MYTHIC' | 'LEGENDARY' | 'EPIC' | 'RARE' | 'UNCOMMON' | 'COMMON'>('ALL');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('100');
  const [step, setStep] = useState('10');
  const [lotDurationMinutes, setLotDurationMinutes] = useState('');
  const sel = items.find(i => i.id === itemId);
  const sortedItems = useMemo(
    () =>
      items
        .filter((i) => i.quantity > 0)
        .filter((i) => rarityFilter === 'ALL' || i.rarity === rarityFilter)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })),
    [items, rarityFilter],
  );
  useEffect(() => {
    if (!itemId) return;
    if (!sortedItems.some((i) => i.id === itemId)) {
      setItemId('');
      setQty(1);
    }
  }, [itemId, sortedItems]);
  const inp: CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 11, padding: '12px 16px', color: '#fff', fontSize: 16, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' };
  const canSubmit = !!itemId && !!price && !!step && !isPending;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 24 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#12161f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 34, width: 450, boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>➕</div>
        <div style={{ fontSize: 23, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif', marginBottom: 22 }}>Добавить лот</div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 7 }}>Предмет со склада</label>
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value as typeof rarityFilter)}
            style={{ ...inp, fontSize: 14, marginBottom: 8 }}
          >
            <option value="ALL">Все редкости</option>
            <option value="COMMON">Обычный</option>
            <option value="UNCOMMON">Необычный</option>
            <option value="RARE">Редкий</option>
            <option value="EPIC">Эпический</option>
            <option value="LEGENDARY">Легендарный</option>
            <option value="MYTHIC">Мифический</option>
          </select>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 11, padding: 8, background: 'rgba(255,255,255,0.03)' }}>
            {!sortedItems.length ? (
              <div style={{ fontSize: 13, color: '#777', padding: '12px 8px' }}>Нет предметов выбранной редкости</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sortedItems.map(i => {
                  const selected = i.id === itemId;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => { setItemId(i.id); setQty(1); }}
                      className={`${getRarityBgClass(i.rarity)} ${selected ? 'border-gold-400/50 bg-gold-500/10' : ''}`}
                      style={{
                        borderRadius: 10,
                        borderWidth: 1,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: '#ddd',
                        boxShadow: selected ? '0 0 0 1px rgba(255,210,70,0.2)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span className={getRarityClass(i.rarity)} style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {i.name}
                        </span>
                        <span style={{ fontSize: 10, color: RC[i.rarity]?.color ?? '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                          {getRarityLabel(i.rarity)}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>Количество: x{i.quantity}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {sel && sel.quantity > 1 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 7 }}>Количество (макс. {sel.quantity})</label>
            <input type="number" min={1} max={sel.quantity} value={qty}
              onChange={e => setQty(Math.min(+e.target.value, sel.quantity))}
              style={{ ...inp, width: 110, textAlign: 'center' }} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 26 }}>
          {[{ label: 'Старт (DKP)', val: price, set: setPrice }, { label: 'Шаг (DKP)', val: step, set: setStep }].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 7 }}>{f.label}</label>
              <input type="number" value={f.val} onChange={e => f.set(e.target.value)} style={inp} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 7 }}>Время лота (мин, опционально)</label>
          <input type="number" value={lotDurationMinutes} onChange={e => setLotDurationMinutes(e.target.value)} style={inp} placeholder="Пусто — логика суток/продлений" />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, padding: 13, color: '#888', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Отмена</button>
          <button onClick={() => canSubmit && onConfirm(itemId, qty, +price, +step, lotDurationMinutes ? Number(lotDurationMinutes) : null)} disabled={!canSubmit}
            style={{ flex: 2, background: canSubmit ? 'linear-gradient(135deg,#4F8FE8,#6C63FF)' : 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 11, padding: 13, color: canSubmit ? '#fff' : '#555', fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed', fontSize: 14 }}>
            {isPending ? 'Добавление...' : 'Добавить лот'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Lot Card ─────────────────────────────────────────────────────────────────
function LotCard({
  lot, auctionId, clanId, userId, isParticipant, canManage, isDraft,
}: {
  lot: Lot; auctionId: string; clanId: string; userId?: string;
  isParticipant: boolean; canManage: boolean; isDraft: boolean;
}) {
  const queryClient = useQueryClient();
  const r = rc(lot.warehouseItem?.rarity || lot.itemRarity || undefined);
  const [bidAmt, setBidAmt] = useState('');
  const [showBids, setShowBids] = useState(false);
  const [tl, setTl] = useState(lot.endsAt ? new Date(lot.endsAt).getTime() - Date.now() : 0);
  const [hov, setHov] = useState(false);

  useEffect(() => {
    if (!lot.endsAt) return;
    const iv = setInterval(() => setTl(new Date(lot.endsAt!).getTime() - Date.now()), 1000);
    return () => clearInterval(iv);
  }, [lot.endsAt]);

  const currentPrice = Number(lot.currentPrice ?? lot.startPrice);
  const minBid = lot.bids.length > 0 ? currentPrice + Number(lot.minStep) : Number(lot.startPrice);
  const urgent = tl > 0 && tl < 120000;
  const leader = lot.bids[0];
  const isLeader = leader?.userId === userId;
  const isSold = lot.status === 'SOLD';
  const isUnsold = lot.status === 'UNSOLD';
  const isFinished = isSold || isUnsold;
  const isPending = lot.status === 'PENDING';
  const isActive = lot.status === 'ACTIVE';

  const bidMutation = useMutation({
    mutationFn: async () => (await api.post(
      `/clans/${clanId}/auctions/lots/${lot.id}/bid`,
      { amount: Number(bidAmt) },
      { headers: { 'X-Idempotency-Key': `bid-${lot.id}-${Date.now()}` } },
    )).data,
    onSuccess: () => { setBidAmt(''); queryClient.invalidateQueries({ queryKey: ['auction', auctionId] }); toast.success('Ставка принята!'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const finishMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/auctions/lots/${lot.id}/finish`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auction', auctionId] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => (await api.delete(`/clans/${clanId}/auctions/lots/${lot.id}`)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['auction', auctionId] }); toast.success('Лот удалён'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const canBid = !bidAmt || Number(bidAmt) < minBid || bidMutation.isPending;

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.22 }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: 'linear-gradient(140deg,#0f1119 0%,#13182c 100%)',
        border: `1px solid ${isFinished ? (isSold ? '#4FCE8A33' : '#55555533') : r.color + '35'}`,
        borderRadius: 16, overflow: 'hidden', position: 'relative',
        boxShadow: hov && !isFinished ? `0 12px 48px ${r.glow}, inset 0 1px 0 rgba(255,255,255,0.05)` : `0 3px 22px ${r.glow}50`,
        transition: 'box-shadow 0.25s, transform 0.2s',
        transform: hov && !isFinished ? 'translateY(-4px)' : 'none',
        opacity: isUnsold ? 0.65 : 1,
      }}>

      {/* Rarity stripe */}
      <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${isFinished ? (isSold ? '#4FCE8A' : '#555') : r.color},transparent)` }} />

      {/* Finished badge */}
      {isFinished && (
        <div style={{ position: 'absolute', top: 11, right: 11, zIndex: 2, background: isSold ? 'rgba(79,206,138,0.14)' : 'rgba(100,100,100,0.14)', border: `1px solid ${isSold ? '#4FCE8A44' : '#55555544'}`, borderRadius: 8, padding: '3px 10px', fontSize: 11, color: isSold ? '#4FCE8A' : '#777', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          {isSold ? '✓ Продан' : '✗ Не продан'}
        </div>
      )}

      {/* Delete — only pending in draft */}
      {canManage && isDraft && isPending && (
        <button onClick={() => { if (window.confirm('Удалить лот?')) deleteMutation.mutate(); }}
          style={{ position: 'absolute', top: 11, right: 11, zIndex: 3, background: 'rgba(255,50,50,0.13)', border: '1px solid rgba(255,50,50,0.28)', borderRadius: 7, padding: '3px 10px', fontSize: 11, color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>✕</button>
      )}

      {/* Header */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: isFinished ? '#aaa' : '#f0f0f0', fontFamily: 'Georgia,serif', lineHeight: 1.25, paddingRight: (canManage && (isDraft && isPending || isFinished)) ? 0 : 0 }}>
            {lot.warehouseItem?.name || lot.itemName || 'Предмет'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: r.bg, color: isFinished ? '#777' : r.color, border: `1px solid ${r.color}44`, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>{r.label}</span>
            <span style={{ fontSize: 11, color: '#555' }}>x{lot.quantity}</span>
          </div>
        </div>

        {/* Timer */}
        {isActive && lot.endsAt && (
          <div style={{ flexShrink: 0, textAlign: 'center', background: urgent ? 'rgba(255,70,70,0.13)' : 'rgba(255,255,255,0.05)', border: `1px solid ${urgent ? 'rgba(255,70,70,0.35)' : 'rgba(255,255,255,0.09)'}`, borderRadius: 11, padding: '8px 12px' }}>
            <div style={{ fontSize: 9, color: urgent ? '#ff8080' : '#666', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>Осталось</div>
            <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 900, color: urgent ? '#ff4444' : '#fff', animation: urgent ? 'auc-urgPulse 1s infinite' : 'none' }}>{fmtTime(tl)}</div>
          </div>
        )}
        {isPending && (
          <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '7px 12px', fontSize: 11, color: '#888' }}>⏳ Ожидает</div>
        )}
      </div>

      {/* Prices */}
      {!isPending && (
        <div style={{ display: 'grid', gridTemplateColumns: isSold && lot.result?.winner ? '1fr 1fr' : '1fr 1fr', gap: 8, padding: '0 16px 10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '9px 12px' }}>
            <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 1.5 }}>{isSold ? 'Финальная цена' : 'Текущая цена'}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: isSold ? '#4FCE8A' : '#FFD700', fontFamily: 'monospace' }}>{fmtDkp(currentPrice)}</div>
          </div>
          {isSold && lot.result?.winner ? (
            <div style={{ background: 'rgba(79,206,138,0.06)', borderRadius: 9, padding: '9px 12px', border: '1px solid rgba(79,206,138,0.2)' }}>
              <div style={{ fontSize: 9, color: '#4FCE8A99', textTransform: 'uppercase', letterSpacing: 1.5 }}>Победитель</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#4FCE8A', fontFamily: 'Georgia,serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <ChampionNickname nickname={lot.result.winner.profile?.nickname} isChampion={lot.result.winner.profile?.isServerChampion} />
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '9px 12px' }}>
              <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 1.5 }}>Мин. ставка</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#e0e0e0', fontFamily: 'monospace' }}>{fmtDkp(minBid)}</div>
            </div>
          )}
        </div>
      )}

      {/* Leader bar */}
      {isActive && leader && (
        <div style={{ margin: '0 16px 10px', padding: '7px 13px', background: isLeader ? 'rgba(255,215,0,0.08)' : 'rgba(79,206,138,0.07)', border: `1px solid ${isLeader ? 'rgba(255,215,0,0.25)' : 'rgba(79,206,138,0.22)'}`, borderRadius: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: isLeader ? '#FFD700' : '#4FCE8A', fontWeight: 700 }}>
            {isLeader ? '👑 Вы лидируете!' : (
              <>
                👑 <ChampionNickname nickname={leader.user?.profile?.nickname || '...'} isChampion={leader.user?.profile?.isServerChampion} />
              </>
            )}
          </span>
          <span style={{ fontSize: 12, color: '#555' }}>{lot.bids.length} ставок</span>
        </div>
      )}

      {/* Bid input */}
      {isActive && isParticipant && (
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
          <input type="number" value={bidAmt} onChange={e => setBidAmt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !canBid) bidMutation.mutate(); }}
            placeholder={`Мин. ${fmtDkp(minBid)}`}
            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 13px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'monospace' }} />
          <button onClick={() => bidMutation.mutate()} disabled={canBid}
            style={{ background: canBid ? `${r.color}33` : `linear-gradient(135deg,${r.color}ee,${r.color}99)`, border: 'none', borderRadius: 9, padding: '10px 16px', color: '#000', fontWeight: 800, fontSize: 13, cursor: canBid ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: canBid ? 0.6 : 1, transition: 'all 0.15s' }}>
            ⚡ Ставка
          </button>
        </div>
      )}

      {/* Finish */}
      {canManage && isActive && (
        <div style={{ padding: '0 16px 12px' }}>
          <button onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending}
            style={{ width: '100%', background: 'rgba(255,70,70,0.09)', border: '1px solid rgba(255,70,70,0.22)', borderRadius: 9, padding: 8, color: '#ff7070', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            Завершить лот
          </button>
        </div>
      )}

      {/* Bid history */}
      {lot.bids.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => setShowBids(v => !v)} style={{ width: '100%', background: 'none', border: 'none', padding: '8px 16px', color: '#555', fontSize: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
            <span>{showBids ? '▲' : '▼'} История ставок</span>
            <span style={{ color: '#444' }}>{lot.bids.length}</span>
          </button>
          <AnimatePresence>
            {showBids && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ maxHeight: 130, overflowY: 'auto', padding: '0 16px 10px' }}>
                  {lot.bids.map((bid, i) => (
                    <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: i === 0 ? '#FFD700' : '#666' }}>
                        {i === 0 ? '👑 ' : ''}
                        <ChampionNickname nickname={bid.user?.profile?.nickname} isChampion={bid.user?.profile?.isServerChampion} />
                      </span>
                      <span style={{ fontFamily: 'monospace', color: i === 0 ? '#FFD700' : '#444' }}>{fmtDkp(bid.amount)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const clanId = user?.clanMembership?.clanId ?? '';
  const userId = user?.id;
  const canManage = user?.clanMembership?.role === 'CLAN_LEADER' || user?.clanMembership?.role === 'ELDER';

  const [winner, setWinner] = useState<WinnerData | null>(null);
  const [showAddAll, setShowAddAll] = useState(false);
  const [showAddOne, setShowAddOne] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'lots' | 'chat' | 'members'>('chat');
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { canvasRef, fire } = useConfetti();

  // ─── Queries ─────────────────────────────────────────────────────────────
  const { data: auction, isLoading } = useQuery({
    queryKey: ['auction', id],
    queryFn: async () => (await api.get(`/clans/${clanId}/auctions/${id}`)).data,
    enabled: !!id && !!clanId,
    refetchInterval: 15000,
  });

  const { data: warehouseData } = useQuery({
    queryKey: ['warehouse-items', clanId, 300],
    queryFn: async () => (await api.get(`/clans/${clanId}/warehouse?limit=300`)).data,
    enabled: !!clanId && canManage && (showAddOne || showAddAll),
  });
  const warehouseItems: WarehouseItem[] = warehouseData?.data ?? [];

  const allLots: Lot[] = auction?.lots ?? [];
  const usedWarehouseItemIds = useMemo(
    () => new Set(allLots.map((lot: Lot) => lot.warehouseItemId).filter((id): id is string => !!id)),
    [allLots],
  );
  const availableWarehouseItems = useMemo(
    () => warehouseItems.filter((item) => !usedWarehouseItemIds.has(item.id)),
    [warehouseItems, usedWarehouseItemIds],
  );
  const activeLots = allLots.filter((l: Lot) => l.status === 'ACTIVE');
  const pendingLots = allLots.filter((l: Lot) => l.status === 'PENDING');
  const finishedLots = allLots.filter((l: Lot) => l.status === 'SOLD' || l.status === 'UNSOLD');
  const myLots = useMemo(() => {
    if (!userId) return [];

    const statusOrder: Record<Lot['status'], number> = {
      ACTIVE: 0,
      PENDING: 1,
      SOLD: 2,
      UNSOLD: 3,
    };

    return allLots
      .filter((lot: Lot) => lot.bids?.some((bid: Bid) => bid.userId === userId))
      .map((lot: Lot) => lot)
      .sort((a, b) => {
        const byStatus = statusOrder[a.status] - statusOrder[b.status];
        if (byStatus !== 0) return byStatus;
        return a.sortOrder - b.sortOrder;
      });
  }, [allLots, userId]);
  const myLotIds = useMemo(() => new Set(myLots.map((lot: Lot) => lot.id)), [myLots]);
  const pendingLotsMain = useMemo(
    () => pendingLots.filter((lot: Lot) => !myLotIds.has(lot.id)),
    [pendingLots, myLotIds],
  );
  const activeLotsMain = useMemo(
    () => activeLots.filter((lot: Lot) => !myLotIds.has(lot.id)),
    [activeLots, myLotIds],
  );
  const finishedLotsMain = useMemo(
    () => finishedLots.filter((lot: Lot) => !myLotIds.has(lot.id)),
    [finishedLots, myLotIds],
  );
  const isParticipant = auction?.participants?.some((p: any) => p.userId === userId);
  const isDraft = auction?.status === 'DRAFT';
  const isActive = auction?.status === 'ACTIVE';
  const isCompleted = auction?.status === 'COMPLETED';
  const totalBids = allLots.reduce((a: number, l: Lot) => a + (l.bids?.length ?? 0), 0);
  const topBid = Math.max(0, ...allLots.flatMap((l: Lot) => l.bids?.map((b: Bid) => Number(b.amount)) ?? []));

  // ─── Socket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    joinAuctionRoom(id);
    const socket = getSocket();
    const refresh = (delay = 300) => setTimeout(() => queryClient.invalidateQueries({ queryKey: ['auction', id] }), delay);

    socket.on('auction.bid.created', () => refresh());
    socket.on('auction.timer.extended', () => { toast.info('⏱ Таймер продлён (Anti-Sniper)'); refresh(); });
    socket.on('auction.lot.finished', () => refresh());
    socket.on('auction.updated', () => refresh());
    socket.on('auction.lot.added', () => refresh());
    socket.on('auction.lots.bulk_added', (data: any) => { toast.success(`Добавлено ${data.count} лотов`); refresh(); });
    socket.on('auction.lot.deleted', () => refresh());
    socket.on('auction.deleted', (data: any) => {
      if (data?.auctionId === id) {
        toast.info('Аукцион удален');
        navigate('/auctions');
      }
    });
    socket.on('auction.chat.message', () => refresh());
    socket.on('auction.bid.outbid', (data: any) => toast.warning(`Вас перебили! Новая ставка: ${fmtDkp(data.newAmount)}`));

    socket.on('auction.lot.sold', (data: any) => {
      setWinner({
        nickname: data.winnerNickname || data.winnerId?.slice(0, 8) || '???',
        itemName: data.itemName || 'Предмет',
        itemRarity: data.itemRarity || 'COMMON',
        finalPrice: data.finalPrice,
      });
      fire();
      refresh(200);
    });

    return () => {
      leaveAuctionRoom(id);
      ['auction.bid.created','auction.timer.extended','auction.lot.finished','auction.updated',
        'auction.lot.added','auction.lots.bulk_added','auction.lot.deleted','auction.chat.message',
        'auction.bid.outbid','auction.lot.sold','auction.deleted'].forEach(e => socket.off(e));
    };
  }, [id, queryClient, fire, navigate]);

  // Scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [auction?.chatMessages?.length]);

  // ─── Mutations ────────────────────────────────────────────────────────────
  const joinMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/auctions/${id}/join`)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['auction', id] }); toast.success('Вы вошли в аукцион!'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const startMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/auctions/${id}/start`)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['auction', id] }); toast.success('Аукцион запущен! Все лоты активны'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const addOneMutation = useMutation({
    mutationFn: async ({ itemId, qty, sp, ms, lotDurationMinutes }: { itemId: string; qty: number; sp: number; ms: number; lotDurationMinutes: number | null }) =>
      (await api.post(`/clans/${clanId}/auctions/${id}/lots`, { warehouseItemId: itemId, quantity: qty, startPrice: sp, minStep: ms, lotDurationMinutes })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['auction', id] }); setShowAddOne(false); toast.success('Лот добавлен'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const addAllMutation = useMutation({
    mutationFn: async ({ sp, ms, lotDurationMinutes }: { sp: number; ms: number; lotDurationMinutes: number | null }) =>
      (await api.post(`/clans/${clanId}/auctions/${id}/lots/bulk`, { defaultStartPrice: sp, defaultMinStep: ms, defaultLotDurationMinutes: lotDurationMinutes })).data,
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['auction', id] }); setShowAddAll(false); toast.success(`Добавлено ${data.added} предметов`); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const chatMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/auctions/${id}/chat`, { message: chatInput })).data,
    onSuccess: () => { setChatInput(''); queryClient.invalidateQueries({ queryKey: ['auction', id] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteAuctionMutation = useMutation({
    mutationFn: async () => (await api.delete(`/clans/${clanId}/auctions/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctions', clanId] });
      toast.success('Завершенный аукцион удален');
      navigate('/auctions');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#080b12', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton className="h-14 w-80" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      </div>
    );
  }
  if (!auction) return (
    <div style={{ minHeight: '100vh', background: '#080b12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#666', fontSize: 16 }}>Аукцион не найден</p>
    </div>
  );

  const STATUS_LABEL: Record<string, string> = { DRAFT: 'Черновик', ACTIVE: 'LIVE', COMPLETED: 'Завершён', CANCELLED: 'Отменён' };
  const STATUS_COLOR: Record<string, string> = { DRAFT: '#888', ACTIVE: '#4FCE8A', COMPLETED: '#FFD700', CANCELLED: '#ff6b6b' };
  const sc = STATUS_COLOR[auction.status] ?? '#888';

  return (
    <div style={{ height: '100vh', background: '#080b12', color: '#e0e0e0', fontFamily: '"Trebuchet MS","Segoe UI",sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Confetti canvas */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998 }} />

      {/* Modals */}
      <AnimatePresence>
        {winner && <WinnerOverlay winner={winner} onClose={() => setWinner(null)} />}
        {showAddAll && canManage && (
          <AddAllModal
            itemCount={warehouseItems.filter(i => i.quantity > 0).length}
            isPending={addAllMutation.isPending}
            onClose={() => setShowAddAll(false)}
            onConfirm={(sp, ms, lotDurationMinutes) => addAllMutation.mutate({ sp, ms, lotDurationMinutes })}
          />
        )}
        {showAddOne && canManage && (
          <AddOneModal
            items={availableWarehouseItems}
            isPending={addOneMutation.isPending}
            onClose={() => setShowAddOne(false)}
            onConfirm={(itemId, qty, sp, ms, lotDurationMinutes) => addOneMutation.mutate({ itemId, qty, sp, ms, lotDurationMinutes })}
          />
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(180deg,#0c1020,rgba(8,11,18,0.97))', borderBottom: '1px solid rgba(255,215,0,0.09)', padding: '11px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>⚔️</span>
          <div>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 800, color: '#fff' }}>{auction.title}</div>
            {auction.description && <div style={{ fontSize: 12, color: '#555', marginTop: 1 }}>{auction.description}</div>}
          </div>
          <div style={{ background: `${sc}18`, border: `1px solid ${sc}44`, borderRadius: 20, padding: '3px 12px', fontSize: 12, color: sc, fontWeight: 700, flexShrink: 0 }}>
            {isActive && <span style={{ marginRight: 5 }}>●</span>}{STATUS_LABEL[auction.status] ?? auction.status}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!isParticipant && isActive && (
            <button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}
              style={{ background: 'linear-gradient(135deg,#FFD700,#FF8C00)', border: 'none', borderRadius: 9, padding: '9px 18px', color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              👥 Присоединиться
            </button>
          )}
          {canManage && isDraft && (
            <>
              <button onClick={() => { setShowAddAll(false); setShowAddOne(true); }}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 9, padding: '9px 16px', color: '#ccc', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                ➕ Добавить лот
              </button>
              <button onClick={() => { setShowAddOne(false); setShowAddAll(true); }}
                style={{ background: 'rgba(255,215,0,0.09)', border: '1px solid rgba(255,215,0,0.22)', borderRadius: 9, padding: '9px 16px', color: '#FFD700', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                📦 Весь склад
              </button>
              <button onClick={() => startMutation.mutate()} disabled={startMutation.isPending || allLots.length === 0}
                style={{ background: 'linear-gradient(135deg,#4FCE8A,#2da868)', border: 'none', borderRadius: 9, padding: '9px 18px', color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: allLots.length === 0 ? 0.5 : 1 }}>
                ▶ Запустить аукцион
              </button>
            </>
          )}
          {canManage && isCompleted && (
            <button
              onClick={() => deleteAuctionMutation.mutate()}
              disabled={deleteAuctionMutation.isPending}
              style={{ background: 'rgba(255,107,107,0.14)', border: '1px solid rgba(255,107,107,0.36)', borderRadius: 9, padding: '9px 16px', color: '#ff8a8a', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              🗑 Удалить аукцион
            </button>
          )}
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)', flexShrink: 0 }}>
        {[
          { icon: '👥', val: auction.participants?.length ?? 0, label: 'Участников' },
          { icon: '🔥', val: `${activeLots.length}/${allLots.length}`, label: 'Активных лотов' },
          { icon: '⚡', val: totalBids, label: 'Ставок' },
          { icon: '👑', val: topBid > 0 ? fmtDkp(topBid) : '—', label: 'Топ ставка' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '10px 14px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none', textAlign: 'center' }}>
            <div style={{ fontSize: 18 }}>{s.icon}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: 'monospace', lineHeight: 1.2 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 480px', minHeight: 0 }}>

        {/* Lots area */}
        <div style={{ overflowY: 'auto', padding: 18 }}>
          {myLots.length > 0 && (
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 14, border: '1px solid rgba(255,215,0,0.18)', background: 'linear-gradient(180deg,rgba(255,215,0,0.05),rgba(255,215,0,0.015))' }}>
              <div style={{ fontSize: 11, color: '#FFD700', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 12 }}>
                Мои лоты в приоритете ({myLots.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(278px,1fr))', gap: 14 }}>
                <AnimatePresence>
                  {myLots.map((lot: Lot) => (
                    <LotCard key={`my-${lot.id}`} lot={lot} auctionId={id!} clanId={clanId} userId={userId} isParticipant={!!isParticipant} canManage={canManage} isDraft={isDraft} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Empty draft */}
          {isDraft && allLots.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340, gap: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 64 }}>📦</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif' }}>Добавьте лоты для аукциона</div>
              <div style={{ fontSize: 14, color: '#666' }}>Добавьте предметы по одному или выгрузите весь склад</div>
              {canManage && (
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button onClick={() => setShowAddOne(true)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '10px 20px', color: '#ccc', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>➕ Один лот</button>
                  <button onClick={() => setShowAddAll(true)} style={{ background: 'rgba(255,215,0,0.09)', border: '1px solid rgba(255,215,0,0.22)', borderRadius: 10, padding: '10px 20px', color: '#FFD700', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>📦 Весь склад</button>
                </div>
              )}
            </div>
          )}

          {/* Pending lots */}
          {pendingLotsMain.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 12 }}>
                Ожидают старта ({pendingLotsMain.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(278px,1fr))', gap: 14 }}>
                <AnimatePresence>
                  {pendingLotsMain.map((lot: Lot) => (
                    <LotCard key={lot.id} lot={lot} auctionId={id!} clanId={clanId} userId={userId} isParticipant={!!isParticipant} canManage={canManage} isDraft={isDraft} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Active lots */}
          {activeLotsMain.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#4FCE8A', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4FCE8A', display: 'inline-block', animation: 'auc-livePulse 1.5s infinite' }} />
                Активные лоты ({activeLotsMain.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(278px,1fr))', gap: 14 }}>
                <AnimatePresence>
                  {activeLotsMain.map((lot: Lot) => (
                    <LotCard key={lot.id} lot={lot} auctionId={id!} clanId={clanId} userId={userId} isParticipant={!!isParticipant} canManage={canManage} isDraft={isDraft} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Finished lots */}
          {finishedLotsMain.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 12 }}>Завершённые ({finishedLotsMain.length})</div>
              {finishedLotsMain.map((lot: Lot) => {
                const r = rc(lot.warehouseItem?.rarity || lot.itemRarity || undefined);
                return (
                  <div key={lot.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(79,206,138,0.04)', border: '1px solid rgba(79,206,138,0.14)', borderRadius: 12, marginBottom: 8, gap: 12 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#aaa', fontFamily: 'Georgia,serif' }}>{lot.warehouseItem?.name || lot.itemName || 'Предмет'}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, color: r.color }}>{r.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {lot.result?.winner && (
                        <span style={{ fontSize: 13, color: '#4FCE8A' }}>
                          👑 <ChampionNickname nickname={lot.result.winner.profile?.nickname} isChampion={lot.result.winner.profile?.isServerChampion} />
                        </span>
                      )}
                      <span style={{ fontFamily: 'monospace', fontSize: 14, color: lot.status === 'SOLD' ? '#4FCE8A' : '#555' }}>
                        {lot.status === 'SOLD' ? fmtDkp(lot.result?.finalPrice ?? lot.currentPrice ?? 0) : 'Не продан'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed banner */}
          {isCompleted && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              style={{ margin: '20px 0', padding: '22px 26px', background: 'linear-gradient(135deg,rgba(255,215,0,0.06),rgba(255,140,0,0.04))', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 44 }}>🏆</div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 800, color: '#FFD700', marginTop: 8 }}>Аукцион завершён</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                Продано {finishedLots.filter((l: Lot) => l.status === 'SOLD').length} из {allLots.length} лотов
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: '#090c15', minHeight: 0 }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {(['lots', 'chat', 'members'] as const).map(t => (
              <button key={t} onClick={() => setSidebarTab(t)} style={{ flex: 1, padding: '14px 0', background: 'none', border: 'none', fontSize: 12, color: sidebarTab === t ? '#FFD700' : '#555', fontWeight: sidebarTab === t ? 700 : 400, borderBottom: `2px solid ${sidebarTab === t ? '#FFD700' : 'transparent'}`, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1.5, transition: 'all 0.2s' }}>
                {t === 'lots' ? '🗂 Лоты' : t === 'chat' ? '💬 Чат' : '👥 Состав'}
              </button>
            ))}
          </div>

          {/* Tab: Lots */}
          {sidebarTab === 'lots' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allLots.map((lot: Lot) => {
                const r = rc(lot.warehouseItem?.rarity || lot.itemRarity || undefined);
                const price = Number(lot.currentPrice ?? lot.startPrice);
                const done = lot.status === 'SOLD' || lot.status === 'UNSOLD';
                return (
                  <div key={lot.id} style={{ padding: '12px 15px', background: done ? 'rgba(79,206,138,0.04)' : 'rgba(255,255,255,0.025)', borderRadius: 11, borderLeft: `3px solid ${lot.status === 'SOLD' ? '#4FCE8A' : lot.status === 'ACTIVE' ? r.color : '#333'}` }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lot.warehouseItem?.name || lot.itemName || 'Предмет'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: r.color }}>{r.label} · x{lot.quantity}</span>
                      <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: done ? '#4FCE8A' : '#FFD700' }}>{fmtDkp(price)}</span>
                    </div>
                    {lot.status === 'SOLD' && lot.result?.winner && (
                      <div style={{ fontSize: 12, color: '#4FCE8A', marginTop: 4 }}>
                        👑 <ChampionNickname nickname={lot.result.winner.profile?.nickname} isChampion={lot.result.winner.profile?.isServerChampion} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab: Chat */}
          {sidebarTab === 'chat' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(auction.chatMessages ?? []).map((msg: any) => (
                  <div key={msg.id}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: msg.userId === userId ? '#FFD700' : '#4F8FE8' }}>
                        <ChampionNickname nickname={msg.user?.profile?.nickname} isChampion={msg.user?.profile?.isServerChampion} />
                      </span>
                      <span style={{ fontSize: 10, color: '#444' }}>{new Date(msg.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ fontSize: 14, color: '#d0d0d0', lineHeight: 1.5, marginTop: 2 }}>{msg.message}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {isParticipant && (
                <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', gap: 8 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim()) chatMutation.mutate(); }}
                    placeholder="Написать в чат..."
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '11px 14px', color: '#fff', fontSize: 14, outline: 'none' }} />
                  <button onClick={() => chatMutation.mutate()} disabled={!chatInput.trim() || chatMutation.isPending}
                    style={{ background: '#FFD700', border: 'none', borderRadius: 9, padding: '11px 16px', cursor: 'pointer', fontWeight: 800, fontSize: 14, color: '#000', opacity: chatInput.trim() ? 1 : 0.5 }}>▶</button>
                </div>
              )}
            </>
          )}

          {/* Tab: Members */}
          {sidebarTab === 'members' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              {(auction.participants ?? []).map((p: any, i: number) => {
                const nick = p.user?.profile?.nickname ?? '...';
                const myBids = allLots.reduce((a: number, l: Lot) => a + l.bids.filter((b: Bid) => b.userId === p.userId).length, 0);
                const isMe = p.userId === userId;
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', background: isMe ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.025)', borderRadius: 10, marginBottom: 6, border: isMe ? '1px solid rgba(255,215,0,0.15)' : '1px solid transparent' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: `hsl(${i * 53},50%,34%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{nick[0]?.toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: isMe ? '#FFD700' : '#ccc' }}>
                        <ChampionNickname nickname={nick} isChampion={p.user?.profile?.isServerChampion} />
                        {isMe ? ' (Вы)' : ''}
                      </div>
                      <div style={{ fontSize: 12, color: '#555', marginTop: 1 }}>{myBids} ставок</div>
                    </div>
                    {myBids > 0 && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4FCE8A', flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes auc-livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.45;transform:scale(1.5)}}
        @keyframes auc-urgPulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes trophyBounce{0%{transform:scale(1) rotate(0)}30%{transform:scale(1.2) rotate(-8deg)}60%{transform:scale(1.15) rotate(8deg)}100%{transform:scale(1) rotate(0)}}
        input::placeholder{color:#3a3a3a}
        input:focus{border-color:rgba(255,215,0,0.4)!important}
        select option{background:#1a1f2e;color:#fff}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
      `}</style>
    </div>
  );
}




