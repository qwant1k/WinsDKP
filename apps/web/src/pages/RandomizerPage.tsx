import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, getRarityBgClass, getRarityClass, getRarityLabel, getStatusLabel, getStatusColor } from '@/lib/utils';
import { Dices, Play, Trophy, Users, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

type ClanMember = {
  userId: string;
  role: 'CLAN_LEADER' | 'ELDER' | 'MEMBER' | 'NEWBIE';
  user?: { profile?: { nickname?: string } };
};

type CaseOpeningData = {
  entries: { userId: string; nickname: string }[];
  winnerId: string;
  itemName: string;
  rarity?: string;
  onFinish: () => void;
};

type RarityFilter = 'ALL' | 'MYTHIC' | 'LEGENDARY' | 'EPIC' | 'RARE' | 'UNCOMMON' | 'COMMON';

const roleLabel: Record<ClanMember['role'], string> = {
  CLAN_LEADER: 'Глава',
  ELDER: 'Старейшина',
  MEMBER: 'Участник',
  NEWBIE: 'Новичок',
};

const CARD_W = 140;
const CARD_GAP = 8;
const CARD_STEP = CARD_W + CARD_GAP;
const VISIBLE_CARDS = 60;

const RARITY_GLOW: Record<string, string> = {
  MYTHIC: 'rgba(255,0,80,0.6)',
  LEGENDARY: 'rgba(255,170,0,0.6)',
  EPIC: 'rgba(163,53,238,0.5)',
  RARE: 'rgba(0,112,221,0.5)',
  UNCOMMON: 'rgba(30,255,0,0.4)',
  COMMON: 'rgba(180,180,180,0.3)',
};

function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fire = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f8edeb', '#ff6b6b', '#a855f7'];
    const particles = Array.from({ length: 300 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height / 2,
      r: Math.random() * 5 + 2,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.7) * 12,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    }));

    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.vx *= 0.99;
        p.life -= 0.003;

        if (p.life <= 0) return;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      frame += 1;
      if (frame < 240) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    draw();
  }, []);

  return { canvasRef, fire };
}

function buildStrip(entries: { userId: string; nickname: string }[], winnerId: string): { userId: string; nickname: string }[] {
  const strip: { userId: string; nickname: string }[] = [];
  const winnerIdx = Math.floor(VISIBLE_CARDS * 0.78);
  for (let i = 0; i < VISIBLE_CARDS; i++) {
    if (i === winnerIdx) {
      strip.push(entries.find((e) => e.userId === winnerId) || entries[0]);
    } else {
      strip.push(entries[Math.floor(Math.random() * entries.length)]);
    }
  }
  return strip;
}

function CaseOpeningOverlay({ data, onClose }: { data: CaseOpeningData; onClose: () => void }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'spinning' | 'winner'>('spinning');
  const [showGlow, setShowGlow] = useState(false);
  const { canvasRef, fire } = useConfetti();

  const strip = useMemo(() => buildStrip(data.entries, data.winnerId), [data.entries, data.winnerId]);
  const winnerIdx = strip.findIndex((s) => s.userId === data.winnerId);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;

    const viewportW = window.innerWidth;
    const targetX = winnerIdx * CARD_STEP - viewportW / 2 + CARD_W / 2;
    const jitter = (Math.random() - 0.5) * (CARD_W * 0.3);
    const finalX = targetX + jitter;

    el.style.transition = 'none';
    el.style.transform = 'translateX(0px)';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'transform 5.5s cubic-bezier(0.15, 0.85, 0.25, 1)';
        el.style.transform = `translateX(-${finalX}px)`;
      });
    });

    const glowTimer = setTimeout(() => setShowGlow(true), 5200);
    const winnerTimer = setTimeout(() => {
      setPhase('winner');
      fire();
    }, 6000);
    const finishTimer = setTimeout(() => {
      data.onFinish();
      onClose();
    }, 10500);

    return () => {
      clearTimeout(glowTimer);
      clearTimeout(winnerTimer);
      clearTimeout(finishTimer);
    };
  }, []);

  const glow = RARITY_GLOW[data.rarity || ''] || RARITY_GLOW.COMMON;

  return (
    <div className="fixed inset-0 z-[120] bg-black/92 backdrop-blur-md flex flex-col items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[130]" />

      <AnimatePresence mode="wait">
        {phase === 'spinning' && (
          <motion.div
            key="strip"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full"
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-px -translate-y-1/2 z-20 w-[3px] rounded-full"
              style={{ height: 'calc(100% + 40px)', marginTop: '-20px', background: `linear-gradient(180deg, transparent 0%, ${glow} 30%, #ffd166 50%, ${glow} 70%, transparent 100%)`, boxShadow: `0 0 20px ${glow}, 0 0 40px ${glow}` }} />

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
              style={{ width: CARD_W + 20, height: CARD_W + 60, border: '2px solid rgba(255,209,102,0.5)', borderRadius: 16, boxShadow: showGlow ? `0 0 40px ${glow}, 0 0 80px ${glow}, inset 0 0 30px ${glow}` : 'none', transition: 'box-shadow 0.8s ease' }} />

            <div className="mx-auto overflow-hidden" style={{ maxWidth: '100vw' }}>
              <div ref={stripRef} className="flex will-change-transform" style={{ gap: CARD_GAP, paddingLeft: '50vw' }}>
                {strip.map((item, i) => {
                  const isWinner = i === winnerIdx;
                  return (
                    <div
                      key={`${item.userId}-${i}`}
                      className={`shrink-0 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                        isWinner && showGlow
                          ? 'border-gold-400 bg-gradient-to-b from-gold-500/20 to-gold-500/5'
                          : 'border-zinc-700/60 bg-zinc-800/80'
                      }`}
                      style={{ width: CARD_W, height: CARD_W, boxShadow: isWinner && showGlow ? `0 0 30px ${glow}` : 'none' }}
                    >
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold mb-2 ${
                        isWinner && showGlow ? 'bg-gold-500/30 text-gold-300' : 'bg-zinc-700/50 text-zinc-400'
                      }`}>
                        {item.nickname?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <p className={`text-xs font-medium text-center px-2 truncate w-full ${
                        isWinner && showGlow ? 'text-gold-300' : 'text-zinc-300'
                      }`}>
                        {item.nickname}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-zinc-500 animate-pulse">Прокрутка...</p>
            </div>
          </motion.div>
        )}

        {phase === 'winner' && (
          <motion.div
            key="winner"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="text-center z-[125] px-4"
            onClick={onClose}
          >
            <motion.div
              animate={{ rotate: [0, -3, 3, -2, 2, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 0.6 }}
              className="text-7xl sm:text-8xl mb-4"
            >
              🏆
            </motion.div>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl sm:text-5xl font-black tracking-[0.15em] text-gold-300 drop-shadow-[0_0_30px_rgba(255,209,102,0.5)]"
            >
              WINNER
            </motion.p>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-4 text-2xl sm:text-4xl font-bold text-white"
            >
              {data.entries.find((e) => e.userId === data.winnerId)?.nickname || 'Победитель'}
            </motion.p>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-4"
            >
              <p className="text-base sm:text-lg text-zinc-400">Выиграл предмет:</p>
              <p className="text-xl sm:text-2xl font-semibold text-gold-300 mt-1">{data.itemName}</p>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-8 text-xs uppercase tracking-[0.25em] text-zinc-600"
            >
              нажмите, чтобы закрыть
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RandomizerPage() {
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;
  const canManage = user?.clanMembership?.role === 'CLAN_LEADER' || user?.clanMembership?.role === 'ELDER';
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState('');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('ALL');
  const [drawQuantity, setDrawQuantity] = useState(1);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [participantsInitialized, setParticipantsInitialized] = useState(false);
  const [caseOpening, setCaseOpening] = useState<CaseOpeningData | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['randomizer', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/randomizer`)).data,
    enabled: !!clanId,
  });

  const { data: warehouse } = useQuery({
    queryKey: ['warehouse-items', clanId, 300],
    queryFn: async () => (await api.get(`/clans/${clanId}/warehouse?limit=300`)).data,
    enabled: !!clanId && canManage,
  });

  const { data: membersData } = useQuery({
    queryKey: ['clan-members', clanId],
    queryFn: async () => {
      const limit = 300;
      const firstPage = (await api.get(`/clans/${clanId}/members?page=1&limit=${limit}`)).data;
      const allMembers = [...(firstPage?.data ?? [])];
      const totalPages = Number(firstPage?.meta?.totalPages ?? 1);

      for (let page = 2; page <= totalPages; page += 1) {
        const nextPage = (await api.get(`/clans/${clanId}/members?page=${page}&limit=${limit}`)).data;
        allMembers.push(...(nextPage?.data ?? []));
      }

      return { ...firstPage, data: allMembers };
    },
    enabled: !!clanId && canManage,
  });

  const members: ClanMember[] = membersData?.data ?? [];

  useEffect(() => {
    if (!members.length) return;
    if (!participantsInitialized) {
      setSelectedParticipantIds(members.map((m) => m.userId));
      setParticipantsInitialized(true);
      return;
    }

    const validIds = new Set(members.map((m) => m.userId));
    setSelectedParticipantIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [members, participantsInitialized]);

  const selectedItem = useMemo(
    () => warehouse?.data?.find((item: any) => item.id === selectedItemId),
    [warehouse?.data, selectedItemId],
  );
  const availableItems = useMemo(
    () =>
      (warehouse?.data ?? [])
        .filter((item: any) => item.quantity > 0)
        .filter((item: any) => rarityFilter === 'ALL' || item.rarity === rarityFilter)
        .slice()
        .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || ''), 'ru', { sensitivity: 'base' })),
    [warehouse?.data, rarityFilter],
  );

  useEffect(() => {
    if (!selectedItemId) return;
    const existsInFilter = availableItems.some((item: any) => item.id === selectedItemId);
    if (!existsInFilter) {
      setSelectedItemId('');
      setDrawQuantity(1);
    }
  }, [availableItems, selectedItemId]);

  const allSelected = members.length > 0 && selectedParticipantIds.length === members.length;

  const createMutation = useMutation({
    mutationFn: async () => {
      const participantIds = allSelected ? undefined : selectedParticipantIds;
      return (
        await api.post(
          `/clans/${clanId}/randomizer`,
          { warehouseItemId: selectedItemId, quantity: drawQuantity, participantIds },
          { headers: { 'X-Idempotency-Key': `rand-${selectedItemId}-${Date.now()}` } },
        )
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['randomizer'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      setSelectedItemId('');
      setRarityFilter('ALL');
      setDrawQuantity(1);
      toast.success('Сессия рандомайзера создана');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const drawMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return (await api.post(`/clans/${clanId}/randomizer/${sessionId}/draw`)).data;
    },
    onSuccess: (data, sessionId) => {
      const winnerId = data.result?.winnerId;
      const session = sessions?.find((s: any) => s.id === sessionId);
      const entries = (session?.entries || []).map((e: any) => ({
        userId: e.userId,
        nickname: e.user?.profile?.nickname || '???',
      }));
      const itemName = session?.warehouseItem?.name || 'Предмет';
      const rarity = session?.warehouseItem?.rarity;

      setCaseOpening({
        entries,
        winnerId,
        itemName,
        rarity,
        onFinish: () => {
          queryClient.invalidateQueries({ queryKey: ['randomizer'] });
          queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
          toast.success('Розыгрыш завершён!');
        },
      });
    },
    onError: (e) => {
      toast.error(getErrorMessage(e));
    },
  });

  useEffect(() => {
    const socket = getSocket();
    socket.on('randomizer.finished', (data) => {
      queryClient.invalidateQueries({ queryKey: ['randomizer'] });
      toast.info(`Победитель: ${data.winnerNickname}`);
    });
    return () => {
      socket.off('randomizer.finished');
    };
  }, [queryClient]);

  const toggleParticipant = (userId: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {caseOpening && (
          <CaseOpeningOverlay data={caseOpening} onClose={() => setCaseOpening(null)} />
        )}
      </AnimatePresence>

      <div>
        <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold">Рандомайзер</h1>
        <p className="mt-1 text-sm text-muted-foreground hidden sm:block">Розыгрыш предметов по выбранному составу игроков</p>
      </div>

      {canManage && (
        <Card className="overflow-hidden border-primary/30 bg-[radial-gradient(80%_120%_at_20%_0%,rgba(255,197,80,0.18),transparent_70%),radial-gradient(80%_120%_at_90%_20%,rgba(79,143,232,0.14),transparent_75%)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <WandSparkles className="h-5 w-5 text-gold-400" /> Новый розыгрыш
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1.8fr_auto_auto]">
              <div className="space-y-2">
                <select
                  className="h-10 w-full rounded-md border border-input/60 bg-background/70 px-3 text-sm"
                  value={rarityFilter}
                  onChange={(e) => setRarityFilter(e.target.value as RarityFilter)}
                >
                  <option value="ALL">Все редкости</option>
                  <option value="COMMON">Обычный</option>
                  <option value="UNCOMMON">Необычный</option>
                  <option value="RARE">Редкий</option>
                  <option value="EPIC">Эпический</option>
                  <option value="LEGENDARY">Легендарный</option>
                  <option value="MYTHIC">Мифический</option>
                </select>

                <div className="max-h-56 overflow-y-auto rounded-md border border-input/60 bg-background/40 p-2">
                  {!availableItems.length ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">Нет предметов выбранной редкости</p>
                  ) : (
                    <div className="space-y-2">
                      {availableItems.map((item: any) => {
                        const selected = selectedItemId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setDrawQuantity(1);
                            }}
                            className={`w-full rounded-lg border p-3 text-left transition-all ${
                              selected
                                ? 'border-gold-400/55 bg-gold-500/10 shadow-[0_0_0_1px_rgba(255,210,70,0.2)]'
                                : `${getRarityBgClass(item.rarity)} hover:border-primary/40`
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`truncate text-sm font-semibold ${getRarityClass(item.rarity)}`}>{item.name}</span>
                              <Badge variant={item.rarity.toLowerCase() as any} className="text-[10px]">
                                {getRarityLabel(item.rarity)}
                              </Badge>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">Количество: x{item.quantity}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={selectedItem?.quantity || 1}
                value={drawQuantity}
                onChange={(e) => setDrawQuantity(Math.min(Math.max(1, Number(e.target.value) || 1), selectedItem?.quantity || 1))}
                className="h-10 w-full self-start rounded-md border border-input/60 bg-background/70 px-3 py-2 text-sm md:w-24"
              />

              <Button
                variant="gold"
                disabled={!selectedItemId || selectedParticipantIds.length === 0 || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="self-start"
              >
                <Dices className="h-4 w-4" /> Создать
              </Button>
            </div>

            <div className="rounded-xl border border-gold-500/25 bg-black/25 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">Участники розыгрыша</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Выбрано: {selectedParticipantIds.length}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setSelectedParticipantIds(members.map((m) => m.userId))}>
                    Все
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedParticipantIds([])}>
                    Сброс
                  </Button>
                </div>
              </div>

              {!members.length ? (
                <p className="text-sm text-muted-foreground">Нет участников клана</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {members.map((member) => {
                    const selected = selectedParticipantIds.includes(member.userId);
                    const nickname = member.user?.profile?.nickname || member.userId.slice(0, 8);
                    return (
                      <button
                        key={member.userId}
                        type="button"
                        onClick={() => toggleParticipant(member.userId)}
                        className={`rounded-xl border px-3 py-2 text-left transition-all ${
                          selected
                            ? 'border-gold-400/60 bg-gold-500/10 shadow-[0_0_0_1px_rgba(255,210,70,0.2)]'
                            : 'border-border/60 bg-background/50 hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{nickname}</span>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{roleLabel[member.role]}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : sessions?.length ? (
        <div className="space-y-4">
          {sessions.map((session: any) => (
            <Card key={session.id} className="transition-all">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Dices className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm sm:text-base truncate">
                          {`Розыгрыш предмета: ${session.warehouseItem?.name || 'Предмет'}`}
                        </h3>
                        {session.warehouseItem?.rarity && (
                          <Badge variant={session.warehouseItem.rarity.toLowerCase() as any} className="text-[10px]">
                            {getRarityLabel(session.warehouseItem.rarity)}
                          </Badge>
                        )}
                        <Badge variant="outline" className={getStatusColor(session.status)}>{getStatusLabel(session.status)}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.entries?.length || 0} уч.</span>
                        <span>{formatDateTime(session.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {session.result && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/5 px-3 py-2">
                          <Trophy className="h-4 w-4 text-gold-400" />
                          <div className="text-right">
                            <span className="text-sm font-bold text-gold-400 block">
                              {session.entries?.find((e: any) => e.userId === session.result.winnerId)?.user?.profile?.nickname || 'Победитель'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Розыгрыш предмета: {session.warehouseItem?.name || 'Предмет'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {canManage && session.status === 'PENDING' && (
                      <Button variant="gold" size="sm" onClick={() => drawMutation.mutate(session.id)} disabled={drawMutation.isPending || !!caseOpening}>
                        <Play className="h-4 w-4" /> Запустить
                      </Button>
                    )}
                  </div>
                </div>

                {session.status === 'COMPLETED' && session.entries && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {session.entries.map((entry: any) => (
                      <span
                        key={entry.id}
                        className={`rounded px-2 py-0.5 text-[10px] ${
                          entry.userId === session.result?.winnerId
                            ? 'bg-gold-500/10 text-gold-400 font-bold'
                            : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {entry.user?.profile?.nickname}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <Dices className="h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">Нет розыгрышей</p>
        </div>
      )}
    </div>
  );
}
