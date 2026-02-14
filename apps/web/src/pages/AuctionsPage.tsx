import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, getStatusLabel, getStatusColor } from '@/lib/utils';
import { Trophy, Plus, Users, Package, ArrowRight } from 'lucide-react';
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

  const { data, isLoading } = useQuery({
    queryKey: ['auctions', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/auctions?limit=50`)).data,
    enabled: !!clanId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Аукционы</h1>
          <p className="mt-1 text-muted-foreground">Распределение лута через честные аукционы</p>
        </div>
        <div className="flex gap-2">
          <Link to="/rules/auction"><Button variant="outline" size="sm">Правила</Button></Link>
          {canManage && (
            <Button variant="gold" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="h-4 w-4" /> Создать
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
            <div className="flex gap-2">
              <Button variant="gold" onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending}>Создать</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
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
                <Card className="group cursor-pointer hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">{auction.title}</CardTitle>
                      <Badge variant="outline" className={getStatusColor(auction.status)}>{getStatusLabel(auction.status)}</Badge>
                    </div>
                    {auction.description && <p className="text-sm text-muted-foreground line-clamp-2">{auction.description}</p>}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Package className="h-3 w-3" />{auction._count?.lots || 0} лотов</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{auction._count?.participants || 0} участников</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {auction.startAt ? formatDateTime(auction.startAt) : 'Не начат'}
                      </div>
                    </div>
                    {auction.status === 'ACTIVE' && (
                      <div className="mt-3 flex items-center justify-end">
                        <Button variant="gold" size="sm" className="gap-1">
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
