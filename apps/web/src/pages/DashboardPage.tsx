import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { formatDkp, formatTimeAgo, getRoleLabel, getStatusLabel, getStatusColor } from '@/lib/utils';
import { Coins, Users, Swords, Trophy, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export function DashboardPage() {
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;

  const { data: wallet } = useQuery({
    queryKey: ['dkp', 'wallet'],
    queryFn: async () => (await api.get('/dkp/wallet')).data,
  });

  const { data: activities } = useQuery({
    queryKey: ['dashboard-activities', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/activities?limit=5`)).data,
    enabled: !!clanId,
  });

  const { data: auctions } = useQuery({
    queryKey: ['dashboard-auctions', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/auctions?limit=5`)).data,
    enabled: !!clanId,
  });

  const { data: news } = useQuery({
    queryKey: ['news', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/news?limit=3`)).data,
    enabled: !!clanId,
  });

  const available = wallet ? Number(wallet.balance) - Number(wallet.onHold) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold">
          Добро пожаловать, <span className="gradient-gold">{user?.profile?.nickname}</span>
        </h1>
        <p className="mt-1 text-muted-foreground">
          {user?.clanMembership?.clan?.name ? `${user.clanMembership.clan.name} · ${getRoleLabel(user.clanMembership.role)}` : 'Вы не состоите в клане'}
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Link to="/dkp">
            <Card className="border-gold-500/20 bg-gradient-to-br from-gold-500/5 to-transparent cursor-pointer hover:shadow-lg hover:shadow-gold-500/5 transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">DKP Баланс</CardTitle>
                <Coins className="h-5 w-5 text-gold-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gold-400">{wallet ? formatDkp(wallet.balance) : <Skeleton className="h-8 w-24" />}</div>
                <p className="mt-1 text-xs text-muted-foreground">Доступно: {formatDkp(available)}</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Link to="/profile">
            <Card className="cursor-pointer hover:shadow-lg hover:border-blue-500/20 transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Боевая мощь</CardTitle>
                <TrendingUp className="h-5 w-5 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{user?.profile?.bm?.toLocaleString() || '—'}</div>
                <p className="mt-1 text-xs text-muted-foreground">Уровень: {user?.profile?.level || '—'}</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Link to="/activities">
            <Card className="cursor-pointer hover:shadow-lg hover:border-green-500/20 transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Активности</CardTitle>
                <Swords className="h-5 w-5 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activities?.meta?.total ?? <Skeleton className="h-8 w-12" />}</div>
                <p className="mt-1 text-xs text-muted-foreground">Всего в клане</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Link to="/auctions">
            <Card className="cursor-pointer hover:shadow-lg hover:border-purple-500/20 transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Аукционы</CardTitle>
                <Trophy className="h-5 w-5 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{auctions?.meta?.total ?? <Skeleton className="h-8 w-12" />}</div>
                <p className="mt-1 text-xs text-muted-foreground">Всего проведено</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Последние активности</CardTitle>
            <Link to="/activities">
              <Button variant="ghost" size="sm">Все <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            {activities?.data?.length ? (
              <div className="space-y-3">
                {activities.data.map((a: any) => (
                  <Link key={a.id} to="/activities" className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:border-primary/30 transition-colors cursor-pointer">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.type} · {a._count?.participants || 0} участников</p>
                    </div>
                    <Badge variant="outline" className={getStatusColor(a.status)}>{getStatusLabel(a.status)}</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">Нет активностей</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Новости клана</CardTitle>
            <Link to="/news">
              <Button variant="ghost" size="sm">Все <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            {news?.data?.length ? (
              <div className="space-y-3">
                {news.data.map((n: any) => (
                  <Link key={n.id} to="/news" className="block rounded-lg border border-border/50 p-3 hover:border-primary/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      {n.isPinned && <Badge variant="gold" className="text-[10px]">Закреплено</Badge>}
                      <p className="font-medium">{n.title}</p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.content?.substring(0, 120)}...</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatTimeAgo(n.createdAt)} · {n.author?.profile?.nickname}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">Нет новостей</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
