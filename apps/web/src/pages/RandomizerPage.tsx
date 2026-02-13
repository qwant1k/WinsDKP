import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, getRarityClass, getRarityLabel, getStatusLabel, getStatusColor } from '@/lib/utils';
import { Dices, Play, Trophy, Users, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { getSocket, joinRandomizerRoom } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

export function RandomizerPage() {
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;
  const canManage = user?.clanMembership?.role === 'CLAN_LEADER' || user?.clanMembership?.role === 'ELDER';
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState('');
  const [drawQuantity, setDrawQuantity] = useState(1);
  const [animatingSession, setAnimatingSession] = useState<string | null>(null);
  const [animationWinner, setAnimationWinner] = useState<string | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['randomizer', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/randomizer`)).data,
    enabled: !!clanId,
  });

  const { data: warehouse } = useQuery({
    queryKey: ['warehouse-items', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/warehouse?limit=100`)).data,
    enabled: !!clanId && canManage,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/randomizer`, { warehouseItemId: selectedItemId, quantity: drawQuantity }, {
      headers: { 'X-Idempotency-Key': `rand-${selectedItemId}-${Date.now()}` },
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['randomizer'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      setSelectedItemId('');
      setDrawQuantity(1);
      toast.success('Сессия рандомайзера создана');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const drawMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      setAnimatingSession(sessionId);
      setAnimationWinner(null);
      const result = (await api.post(`/clans/${clanId}/randomizer/${sessionId}/draw`)).data;
      return result;
    },
    onSuccess: (data) => {
      setTimeout(() => {
        const winnerNickname = data.result?.entries?.find((e: any) => e.userId === data.result?.winnerId);
        setAnimationWinner(data.result?.winnerId);
        queryClient.invalidateQueries({ queryKey: ['randomizer'] });
        toast.success('Розыгрыш завершён!');
        setTimeout(() => setAnimatingSession(null), 3000);
      }, 2000);
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
    return () => { socket.off('randomizer.finished'); };
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Рандомайзер</h1>
          <p className="mt-1 text-muted-foreground">Справедливый розыгрыш лута с приоритетом для слабых</p>
        </div>
      </div>

      {canManage && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-lg">Новый розыгрыш</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <select
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedItemId}
                onChange={(e) => { setSelectedItemId(e.target.value); setDrawQuantity(1); }}
              >
                <option value="">Выберите предмет из хранилища...</option>
                {warehouse?.data?.filter((i: any) => i.quantity > 0).map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({getRarityLabel(item.rarity)}) — x{item.quantity}
                  </option>
                ))}
              </select>
              {selectedItemId && (() => {
                const selectedItem = warehouse?.data?.find((i: any) => i.id === selectedItemId);
                return selectedItem && selectedItem.quantity > 1 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Кол-во:</span>
                    <input
                      type="number"
                      min={1}
                      max={selectedItem.quantity}
                      value={drawQuantity}
                      onChange={(e) => setDrawQuantity(Math.min(Number(e.target.value), selectedItem.quantity))}
                      className="w-16 rounded-md border border-input bg-background px-2 py-2 text-sm text-center"
                    />
                    <span className="text-xs text-muted-foreground">/ {selectedItem.quantity}</span>
                  </div>
                ) : null;
              })()}
              <Button variant="gold" disabled={!selectedItemId || createMutation.isPending} onClick={() => createMutation.mutate()}>
                <Dices className="h-4 w-4" /> Создать
              </Button>
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${animatingSession === session.id ? 'animate-spin-slow bg-primary/20' : 'bg-primary/10'}`}>
                      <Dices className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {session.warehouseItem?.name || `Розыгрыш #${session.id.slice(0, 8)}`}
                        </h3>
                        {session.warehouseItem?.rarity && (
                          <Badge variant={session.warehouseItem.rarity.toLowerCase() as any} className="text-[10px]">
                            {getRarityLabel(session.warehouseItem.rarity)}
                          </Badge>
                        )}
                        <Badge variant="outline" className={getStatusColor(session.status)}>{getStatusLabel(session.status)}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.entries?.length || 0} участников</span>
                        <span>{formatDateTime(session.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {session.result && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/5 px-3 py-2">
                          <Trophy className="h-4 w-4 text-gold-400" />
                          <div className="text-right">
                            <span className="text-sm font-bold text-gold-400 block">
                              {session.entries?.find((e: any) => e.userId === session.result.winnerId)?.user?.profile?.nickname || 'Победитель'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Получил: {session.warehouseItem?.name || 'Неизвестный предмет'}
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
                  <motion.div
                    className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
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
                          animate={!animationWinner ? {
                            scale: [1, 1.05, 1],
                            transition: { repeat: Infinity, duration: 0.3, delay: i * 0.05 },
                          } : {}}
                        >
                          <p className="font-medium">{entry.user?.profile?.nickname}</p>
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
                      <span key={entry.id} className={`rounded px-2 py-0.5 text-[10px] ${
                        entry.userId === session.result?.winnerId
                          ? 'bg-gold-500/10 text-gold-400 font-bold'
                          : 'bg-secondary text-muted-foreground'
                      }`}>
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
