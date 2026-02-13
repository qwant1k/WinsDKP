import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDkp, formatDateTime, getRarityClass, getRarityLabel, getStatusLabel, getStatusColor } from '@/lib/utils';
import { Trophy, Gavel, Clock, Send, MessageSquare, Users, Plus, Play, Package, Crown, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket, joinAuctionRoom, leaveAuctionRoom } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

export function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const clanId = user?.clanMembership?.clanId;
  const [bidAmount, setBidAmount] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const canManage = user?.clanMembership?.role === 'CLAN_LEADER' || user?.clanMembership?.role === 'ELDER';
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [showAddLot, setShowAddLot] = useState(false);
  const [addLotForm, setAddLotForm] = useState({ warehouseItemId: '', quantity: 1, startPrice: '', minStep: '' });

  const { data: auction, isLoading } = useQuery({
    queryKey: ['auction', id],
    queryFn: async () => (await api.get(`/clans/${clanId}/auctions/${id}`)).data,
    enabled: !!id && !!clanId,
    refetchInterval: 10000,
  });

  const { data: warehouse } = useQuery({
    queryKey: ['warehouse-items', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/warehouse?limit=100`)).data,
    enabled: !!clanId && canManage && showAddLot,
  });

  const isParticipant = auction?.participants?.some((p: any) => p.userId === user?.id);
  const activeLot = auction?.lots?.find((l: any) => l.status === 'ACTIVE');
  const completedLots = auction?.lots?.filter((l: any) => l.status === 'SOLD' || l.status === 'UNSOLD') || [];
  const isCompleted = auction?.status === 'COMPLETED';

  const updateTimeLeft = useCallback(() => {
    if (!activeLot?.endsAt) { setTimeLeft(''); return; }
    const diff = new Date(activeLot.endsAt).getTime() - Date.now();
    if (diff <= 0) { setTimeLeft('00:00'); return; }
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    setTimeLeft(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
  }, [activeLot?.endsAt]);

  useEffect(() => {
    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [updateTimeLeft]);

  useEffect(() => {
    if (!id) return;
    joinAuctionRoom(id);
    const socket = getSocket();

    const handleBidCreated = () => queryClient.invalidateQueries({ queryKey: ['auction', id] });
    const handleTimerExtended = () => {
      toast.info('Таймер продлён (Anti-Sniper)');
      queryClient.invalidateQueries({ queryKey: ['auction', id] });
    };
    const handleLotFinished = (data: any) => {
      toast.info(data.status === 'sold' ? 'Лот продан!' : 'Лот не продан');
      queryClient.invalidateQueries({ queryKey: ['auction', id] });
    };
    const handleChatMsg = () => queryClient.invalidateQueries({ queryKey: ['auction', id] });

    socket.on('auction.bid.created', handleBidCreated);
    socket.on('auction.timer.extended', handleTimerExtended);
    socket.on('auction.lot.finished', handleLotFinished);
    socket.on('auction.chat.message', handleChatMsg);

    return () => {
      leaveAuctionRoom(id);
      socket.off('auction.bid.created', handleBidCreated);
      socket.off('auction.timer.extended', handleTimerExtended);
      socket.off('auction.lot.finished', handleLotFinished);
      socket.off('auction.chat.message', handleChatMsg);
    };
  }, [id, queryClient]);

  const joinMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/auctions/${id}/join`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction', id] });
      toast.success('Вы присоединились к аукциону!');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const addLotMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/auctions/${id}/lots`, {
      warehouseItemId: addLotForm.warehouseItemId,
      quantity: addLotForm.quantity,
      startPrice: Number(addLotForm.startPrice),
      minStep: Number(addLotForm.minStep),
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction', id] });
      setShowAddLot(false);
      setAddLotForm({ warehouseItemId: '', quantity: 1, startPrice: '', minStep: '' });
      toast.success('Лот добавлен');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const startMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/auctions/${id}/start`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction', id] });
      toast.success('Аукцион запущен!');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const bidMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/auctions/lots/${activeLot.id}/bid`, {
      amount: Number(bidAmount),
    }, { headers: { 'X-Idempotency-Key': `bid-${activeLot.id}-${Date.now()}` } })).data,
    onSuccess: () => {
      setBidAmount('');
      queryClient.invalidateQueries({ queryKey: ['auction', id] });
      toast.success('Ставка принята!');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const chatMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/auctions/${id}/chat`, { message: chatMessage })).data,
    onSuccess: () => {
      setChatMessage('');
      queryClient.invalidateQueries({ queryKey: ['auction', id] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const finishMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/auctions/lots/${activeLot.id}/finish`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction', id] });
      toast.success('Лот завершён');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;
  if (!auction) return <p className="text-center text-muted-foreground py-16">Аукцион не найден</p>;

  if (!isParticipant && !canManage && auction.status !== 'DRAFT') {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
          <LogIn className="h-12 w-12 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">{auction.title}</h2>
          <p className="mt-2 text-muted-foreground">{auction.description}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Чтобы увидеть лоты и участвовать в розыгрыше, необходимо присоединиться к аукциону.
          </p>
        </div>
        <Button variant="gold" size="lg" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
          <Users className="h-5 w-5" /> Присоединиться к аукциону
        </Button>
      </div>
    );
  }

  const currentPrice = activeLot?.currentPrice ? Number(activeLot.currentPrice) : activeLot ? Number(activeLot.startPrice) : 0;
  const minBid = activeLot?.bids?.length ? currentPrice + Number(activeLot.minStep) : currentPrice;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{auction.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{auction.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isParticipant && auction.status !== 'DRAFT' && (
            <Button variant="gold" size="sm" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
              <Users className="h-4 w-4" /> Присоединиться
            </Button>
          )}
          {canManage && auction.status === 'DRAFT' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowAddLot(!showAddLot)}>
                <Plus className="h-4 w-4" /> Добавить лот
              </Button>
              <Button variant="gold" size="sm" onClick={() => startMutation.mutate()} disabled={startMutation.isPending || !auction.lots?.length}>
                <Play className="h-4 w-4" /> Запустить аукцион
              </Button>
            </>
          )}
          {canManage && auction.status === 'ACTIVE' && (
            <Button variant="outline" size="sm" onClick={() => setShowAddLot(!showAddLot)}>
              <Plus className="h-4 w-4" /> Добавить лот
            </Button>
          )}
          <Badge variant="outline" className={getStatusColor(auction.status)}>{getStatusLabel(auction.status)}</Badge>
        </div>
      </div>

      {showAddLot && canManage && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Добавить предмет из хранилища</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <select className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={addLotForm.warehouseItemId}
                onChange={(e) => setAddLotForm({ ...addLotForm, warehouseItemId: e.target.value, quantity: 1 })}>
                <option value="">Выберите предмет...</option>
                {warehouse?.data?.filter((i: any) => i.quantity > 0).map((item: any) => (
                  <option key={item.id} value={item.id}>{item.name} ({getRarityLabel(item.rarity)}) — x{item.quantity}</option>
                ))}
              </select>
              {addLotForm.warehouseItemId && (() => {
                const selectedItem = warehouse?.data?.find((i: any) => i.id === addLotForm.warehouseItemId);
                return selectedItem && selectedItem.quantity > 1 ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Кол-во:</span>
                    <input type="number" min={1} max={selectedItem.quantity} value={addLotForm.quantity}
                      onChange={(e) => setAddLotForm({ ...addLotForm, quantity: Math.min(Number(e.target.value), selectedItem.quantity) })}
                      className="w-16 rounded-md border border-input bg-background px-2 py-2 text-sm text-center" />
                  </div>
                ) : null;
              })()}
              <Input type="number" placeholder="Стартовая цена DKP" className="w-40" value={addLotForm.startPrice}
                onChange={(e) => setAddLotForm({ ...addLotForm, startPrice: e.target.value })} />
              <Input type="number" placeholder="Мин. шаг" className="w-32" value={addLotForm.minStep}
                onChange={(e) => setAddLotForm({ ...addLotForm, minStep: e.target.value })} />
              <Button variant="gold" disabled={!addLotForm.warehouseItemId || !addLotForm.startPrice || !addLotForm.minStep || addLotMutation.isPending}
                onClick={() => addLotMutation.mutate()}>
                Добавить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isCompleted && completedLots.length > 0 && (
        <Card className="border-green-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-gold-400" />
              Результаты аукциона
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedLots.map((lot: any) => {
                const result = lot.result;
                const winner = result?.winner;
                const isSold = lot.status === 'SOLD';
                return (
                  <div key={lot.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${isSold ? 'border-green-500/20 bg-green-500/5' : 'border-border/30'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`font-medium ${getRarityClass(lot.warehouseItem?.rarity)}`}>{lot.warehouseItem?.name}</span>
                      <span className="text-xs text-muted-foreground">x{lot.quantity}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {isSold && result ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-gold-400" />
                            <span className="text-sm font-bold text-gold-400">{winner?.profile?.nickname || result.winnerId?.slice(0, 8)}</span>
                          </div>
                          <span className="font-mono text-sm text-green-400">{formatDkp(result.finalPrice || lot.currentPrice)}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Не продан</span>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${getStatusColor(lot.status)}`}>{getStatusLabel(lot.status)}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {activeLot ? (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Gavel className="h-5 w-5 text-primary" />
                        {activeLot.warehouseItem?.name}
                      </CardTitle>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className={getRarityClass(activeLot.warehouseItem?.rarity)}>
                          {getRarityLabel(activeLot.warehouseItem?.rarity)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">x{activeLot.quantity}</span>
                      </div>
                    </div>
                    {timeLeft && (
                      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-mono text-2xl font-bold text-primary">{timeLeft}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="rounded-lg bg-background/50 p-3">
                      <p className="text-xs text-muted-foreground">Текущая цена</p>
                      <p className="text-2xl font-bold text-gold-400">{formatDkp(currentPrice)}</p>
                    </div>
                    <div className="rounded-lg bg-background/50 p-3">
                      <p className="text-xs text-muted-foreground">Мин. ставка</p>
                      <p className="text-2xl font-bold">{formatDkp(minBid)}</p>
                    </div>
                    <div className="rounded-lg bg-background/50 p-3">
                      <p className="text-xs text-muted-foreground">Ставок</p>
                      <p className="text-2xl font-bold">{activeLot.bids?.length || 0}</p>
                    </div>
                  </div>

                  {activeLot.bids?.length > 0 && (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-center">
                      <p className="text-sm text-green-400">Лидер: {activeLot.bids?.[0]?.user?.profile?.nickname || 'Загрузка...'}</p>
                    </div>
                  )}

                  {auction.status === 'ACTIVE' && isParticipant && (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder={`Мин. ${formatDkp(minBid)} DKP`}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        className="flex-1"
                        min={minBid}
                      />
                      <Button
                        variant="gold"
                        disabled={!bidAmount || Number(bidAmount) < minBid || bidMutation.isPending}
                        onClick={() => bidMutation.mutate()}
                      >
                        <Gavel className="h-4 w-4" />
                        Ставка
                      </Button>
                    </div>
                  )}

                  {canManage && (
                    <Button variant="destructive" size="sm" onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending}>
                      Завершить лот
                    </Button>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">История ставок</h4>
                    <div className="max-h-48 space-y-1 overflow-y-auto scrollbar-thin">
                      <AnimatePresence>
                        {activeLot.bids?.map((bid: any, i: number) => (
                          <motion.div
                            key={bid.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              {i === 0 && <Trophy className="h-3 w-3 text-gold-400" />}
                              <span className="font-medium">{bid.user?.profile?.nickname}</span>
                              {bid.isAutoBid && <Badge variant="outline" className="text-[10px]">авто</Badge>}
                            </div>
                            <span className="font-mono font-bold text-gold-400">{formatDkp(bid.amount)}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : !isCompleted ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Нет активных лотов</p>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle className="text-sm">Все лоты ({auction.lots?.length || 0})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auction.lots?.map((lot: any) => {
                  const lotResult = lot.result;
                  const isSold = lot.status === 'SOLD';
                  return (
                    <div key={lot.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${lot.status === 'ACTIVE' ? 'border-primary/30 bg-primary/5' : isSold ? 'border-green-500/20 bg-green-500/5' : 'border-border/30'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${getRarityClass(lot.warehouseItem?.rarity)}`}>{lot.warehouseItem?.name}</span>
                        <span className="text-xs text-muted-foreground">x{lot.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSold && lotResult && (
                          <span className="text-[10px] text-gold-400 font-medium">
                            <Crown className="h-3 w-3 inline mr-1" />
                            {lotResult.winner?.profile?.nickname}
                          </span>
                        )}
                        <span className="text-sm font-mono">{formatDkp(lot.currentPrice || lot.startPrice)}</span>
                        <Badge variant="outline" className={`text-[10px] ${getStatusColor(lot.status)}`}>{getStatusLabel(lot.status)}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="flex flex-col" style={{ height: '500px' }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" /> Чат аукциона
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin mb-3">
                {auction.chatMessages?.slice().reverse().map((msg: any) => (
                  <div key={msg.id} className="text-xs">
                    <span className="font-semibold text-primary">{msg.user?.profile?.nickname}:</span>{' '}
                    <span className="text-foreground">{msg.message}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {isParticipant && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Сообщение..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && chatMessage.trim()) chatMutation.mutate(); }}
                    className="text-xs h-8"
                  />
                  <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => chatMutation.mutate()} disabled={!chatMessage.trim()}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" /> Участники ({auction.participants?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                {auction.participants?.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs py-1">
                    <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                      {p.user?.profile?.nickname?.charAt(0)?.toUpperCase()}
                    </div>
                    <span>{p.user?.profile?.nickname}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
