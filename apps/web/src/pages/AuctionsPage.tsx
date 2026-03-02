import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, getStatusLabel, getStatusColor } from '@/lib/utils';
import { Trophy, Plus, Users, Package, ArrowRight, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useState } from 'react';

export function AuctionsPage() {
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;
  const canManage = user?.clanMembership?.role === 'CLAN_LEADER' || user?.clanMembership?.role === 'ELDER';
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', antiSniperEnabled: true });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/auctions`, form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctions', clanId], exact: true });
      setShowCreate(false);
      setForm({ title: '', description: '', antiSniperEnabled: true });
      toast.success('Аукцион создан');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (auctionId: string) => (await api.delete(`/clans/${clanId}/auctions/${auctionId}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctions', clanId], exact: true });
      toast.success('Завершенный аукцион удален');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['auctions', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/auctions?limit=50`)).data,
    enabled: !!clanId,
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold">Аукционы</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Распределение лута через честные аукционы</p>
        </div>
        <div className={`grid gap-2 ${canManage ? 'grid-cols-2' : 'grid-cols-1'} w-full sm:flex sm:w-auto sm:shrink-0`}>
          <Link to="/rules/auction" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full">Правила</Button>
          </Link>
          {canManage && (
            <Button variant="gold" size="sm" className="w-full sm:w-auto" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="h-4 w-4" /> <span>Создать</span>
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-lg">Новый аукцион</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Название</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Аукцион: Легендарный лут" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Описание</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Описание аукциона..." />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.antiSniperEnabled} onChange={(e) => setForm({ ...form, antiSniperEnabled: e.target.checked })} className="rounded" />
              Anti-Sniper защита
            </label>
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <Button className="w-full sm:w-auto" variant="gold" onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending}>Создать</Button>
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : data?.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.data.map((auction: any, i: number) => (
            <motion.div key={auction.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/auctions/${auction.id}`}>
                <Card className="group cursor-pointer transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <CardTitle className="text-base break-words transition-colors group-hover:text-primary sm:text-lg">{auction.title}</CardTitle>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <Badge variant="outline" className={getStatusColor(auction.status)}>{getStatusLabel(auction.status)}</Badge>
                        {canManage && auction.status === 'COMPLETED' && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 border-destructive/40 text-destructive hover:bg-destructive/10"
                            disabled={deleteMutation.isPending}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteMutation.mutate(auction.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {auction.description && <p className="line-clamp-2 text-sm text-muted-foreground">{auction.description}</p>}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Package className="h-3 w-3" />{auction._count?.lots || 0} лотов</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{auction._count?.participants || 0} участников</span>
                      </div>
                      <div className="text-xs text-muted-foreground sm:text-right">
                        {auction.startAt ? formatDateTime(auction.startAt) : 'Не начат'}
                      </div>
                    </div>
                    {auction.status === 'ACTIVE' && (
                      <div className="mt-3 flex items-center justify-stretch sm:justify-end">
                        <Button variant="gold" size="sm" className="w-full gap-1 sm:w-auto">
                          Перейти <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <Trophy className="h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">Нет аукционов</p>
        </div>
      )}
    </div>
  );
}
