import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, getRarityBgClass, getRarityClass, getRarityLabel, getStatusLabel, getStatusColor } from '@/lib/utils';
import { Dices, Play, Trophy, Users, Sparkles, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

type ClanMember = {
  userId: string;
  role: 'CLAN_LEADER' | 'ELDER' | 'MEMBER' | 'NEWBIE';
  user?: { profile?: { nickname?: string } };
};

type WinnerOverlayData = {
  nickname: string;
  itemName: string;
  rarity?: string;
};

type RarityFilter = 'ALL' | 'MYTHIC' | 'LEGENDARY' | 'EPIC' | 'RARE' | 'UNCOMMON' | 'COMMON';

const roleLabel: Record<ClanMember['role'], string> = {
  CLAN_LEADER: 'Глава',
  ELDER: 'Старейшина',
  MEMBER: 'Участник',
  NEWBIE: 'Новичок',
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

    const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f8edeb'];
    const particles = Array.from({ length: 240 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height * 0.6,
      r: Math.random() * 5 + 2,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 2.5 + 1.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;

        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      frame += 1;
      if (frame < 280) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    draw();
  }, []);

  return { canvasRef, fire };
}

function WinnerOverlay({ data, onClose }: { data: WinnerOverlayData; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4800);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 36 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 24 }}
        className="mx-4 w-full max-w-2xl rounded-3xl border border-gold-500/40 bg-gradient-to-b from-zinc-900 to-zinc-950 p-8 text-center shadow-[0_0_80px_rgba(255,198,0,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-gold-400 text-6xl">🏆</div>
        <p className="mt-3 text-5xl font-black tracking-[0.2em] text-gold-300">WINNER</p>
        <p className="mt-4 text-4xl font-bold text-white">{data.nickname}</p>
        <p className="mt-3 text-lg text-zinc-300">Розыгрыш предмета:</p>
        <p className="text-2xl font-semibold text-gold-300">{data.itemName}</p>
        <p className="mt-4 text-xs uppercase tracking-[0.25em] text-zinc-500">нажмите, чтобы закрыть</p>
      </motion.div>
    </div>
  );
}

export function RandomizerPage() {
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;
  const canManage = user?.clanMembership?.role === 'CLAN_LEADER' || user?.clanMembership?.role === 'ELDER';
  const queryClient = useQueryClient();
  const { canvasRef, fire } = useConfetti();

  const [selectedItemId, setSelectedItemId] = useState('');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('ALL');
  const [drawQuantity, setDrawQuantity] = useState(1);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [participantsInitialized, setParticipantsInitialized] = useState(false);
  const [animatingSession, setAnimatingSession] = useState<string | null>(null);
  const [animationWinner, setAnimationWinner] = useState<string | null>(null);
  const [winnerOverlay, setWinnerOverlay] = useState<WinnerOverlayData | null>(null);

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
      setAnimatingSession(sessionId);
      setAnimationWinner(null);
      return (await api.post(`/clans/${clanId}/randomizer/${sessionId}/draw`)).data;
    },
    onSuccess: (data, sessionId) => {
      setTimeout(() => {
        const winnerId = data.result?.winnerId;
        setAnimationWinner(winnerId);

        const session = sessions?.find((s: any) => s.id === sessionId);
        const winnerNickname = session?.entries?.find((e: any) => e.userId === winnerId)?.user?.profile?.nickname || 'Победитель';
        const itemName = session?.warehouseItem?.name || 'Предмет';

        fire();
        setWinnerOverlay({
          nickname: winnerNickname,
          itemName,
          rarity: session?.warehouseItem?.rarity,
        });

        queryClient.invalidateQueries({ queryKey: ['randomizer'] });
        toast.success('Розыгрыш завершен');
        setTimeout(() => setAnimatingSession(null), 3000);
      }, 1300);
    },
    onError: (e) => {
      setAnimatingSession(null);
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
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[110]" />

      <AnimatePresence>
        {winnerOverlay && <WinnerOverlay data={winnerOverlay} onClose={() => setWinnerOverlay(null)} />}
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
            <Card key={session.id} className={`transition-all ${animatingSession === session.id ? 'border-primary/50 shadow-lg shadow-primary/10' : ''}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg ${animatingSession === session.id ? 'animate-spin-slow bg-primary/20' : 'bg-primary/10'}`}>
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
                      <Button variant="gold" size="sm" onClick={() => drawMutation.mutate(session.id)} disabled={drawMutation.isPending}>
                        <Play className="h-4 w-4" /> Запустить
                      </Button>
                    )}
                  </div>
                </div>

                {animatingSession === session.id && (
                  <motion.div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <AnimatePresence>
                      {session.entries?.map((entry: any, i: number) => (
                        <motion.div
                          key={entry.id}
                          className={`rounded-lg border p-2 text-center text-xs transition-all ${
                            animationWinner === entry.userId
                              ? 'border-gold-400 bg-gold-500/10 ring-2 ring-gold-400'
                              : animationWinner && animationWinner !== entry.userId
                              ? 'border-border/30 opacity-30'
                              : 'border-border/50'
                          }`}
                          animate={!animationWinner ? { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 0.3, delay: i * 0.05 } } : {}}
                        >
                          <p className="font-medium truncate">{entry.user?.profile?.nickname}</p>
                          <p className="text-muted-foreground">w: {Number(entry.weight).toFixed(3)}</p>
                          {animationWinner === entry.userId && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-1">
                              <Sparkles className="mx-auto h-4 w-4 text-gold-400" />
                            </motion.div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}

                {session.status === 'COMPLETED' && !animatingSession && session.entries && (
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
