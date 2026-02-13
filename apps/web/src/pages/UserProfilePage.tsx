import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDkp, getRoleLabel, formatTimeAgo, formatDate } from '@/lib/utils';
import { User, Shield, Coins, TrendingUp, ArrowLeft, Mail, Swords, Trophy, Dices, Calendar, History, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { useState } from 'react';

const typeLabels: Record<string, string> = {
  dkp_transaction: 'DKP Транзакция',
  activity: 'Активность',
  bid: 'Ставка на аукционе',
  penalty: 'Штраф',
  randomizer_win: 'Победа в розыгрыше',
  auction_win: 'Победа на аукционе',
};

const typeColors: Record<string, string> = {
  dkp_transaction: 'bg-gold-400',
  activity: 'bg-green-400',
  bid: 'bg-purple-400',
  penalty: 'bg-red-400',
  randomizer_win: 'bg-cyan-400',
  auction_win: 'bg-purple-400',
};

const typeIcons: Record<string, React.ElementType> = {
  dkp_transaction: Coins,
  activity: Swords,
  bid: Trophy,
  penalty: AlertTriangle,
  randomizer_win: Dices,
  auction_win: Trophy,
};

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'timeline' | 'stats'>('timeline');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', id],
    queryFn: async () => (await api.get(`/users/${id}`)).data,
    enabled: !!id,
  });

  const { data: timeline } = useQuery({
    queryKey: ['user-timeline', id],
    queryFn: async () => (await api.get(`/users/${id}/timeline?limit=50`)).data,
    enabled: !!id,
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  if (!profile) return <p className="text-center text-muted-foreground py-16">Пользователь не найден</p>;

  const p = profile.profile;
  const clan = profile.clanMemberships?.[0];
  const wallet = profile.dkpWallet;

  const dkpTransactions = (timeline || []).filter((t: any) => t.type === 'dkp_transaction');
  const totalEarned = dkpTransactions.filter((t: any) => Number(t.data?.amount) > 0).reduce((s: number, t: any) => s + Number(t.data?.amount || 0), 0);
  const totalSpent = dkpTransactions.filter((t: any) => Number(t.data?.amount) < 0).reduce((s: number, t: any) => s + Math.abs(Number(t.data?.amount || 0)), 0);
  const activitiesCount = (timeline || []).filter((t: any) => t.type === 'activity').length;
  const bidsCount = (timeline || []).filter((t: any) => t.type === 'bid').length;
  const penaltiesCount = (timeline || []).filter((t: any) => t.type === 'penalty').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/clan"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="font-display text-3xl font-bold">Профиль игрока</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/5 text-4xl font-bold text-primary ring-4 ring-primary/10">
                {p?.nickname?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <h2 className="mt-4 text-2xl font-bold">{p?.nickname}</h2>
              {p?.displayName && p.displayName !== p.nickname && (
                <p className="text-sm text-muted-foreground">{p.displayName}</p>
              )}
              {clan && (
                <Badge variant="gold" className="mt-2 text-sm px-3 py-0.5">
                  [{clan.clan?.tag}] {getRoleLabel(clan.role)}
                </Badge>
              )}
              {currentUser?.id !== id && (
                <Link to={`/messages/${id}`} className="block mt-4">
                  <Button variant="gold" size="sm" className="w-full">
                    <Mail className="h-4 w-4" /> Написать сообщение
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Характеристики</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><TrendingUp className="h-4 w-4 text-blue-400" /> Боевая мощь</span>
                <span className="font-bold text-blue-400">{p?.bm?.toLocaleString() || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><Shield className="h-4 w-4 text-green-400" /> Уровень</span>
                <span className="font-bold text-green-400">{p?.level || '—'}</span>
              </div>
              <div className="border-t border-border/30 pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground"><Coins className="h-4 w-4 text-gold-400" /> Баланс DKP</span>
                  <span className="font-bold text-gold-400 text-lg">{formatDkp(wallet?.balance || 0)}</span>
                </div>
              </div>
              {profile.createdAt && (
                <div className="border-t border-border/30 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /> Регистрация</span>
                    <span className="text-xs">{formatDate(profile.createdAt)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Статистика</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-green-500/5 border border-green-500/10 p-3 text-center">
                  <p className="text-lg font-bold text-green-400">+{formatDkp(totalEarned)}</p>
                  <p className="text-[10px] text-muted-foreground">Заработано</p>
                </div>
                <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3 text-center">
                  <p className="text-lg font-bold text-red-400">-{formatDkp(totalSpent)}</p>
                  <p className="text-[10px] text-muted-foreground">Потрачено</p>
                </div>
                <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/10 p-3 text-center">
                  <p className="text-lg font-bold text-yellow-400">{activitiesCount}</p>
                  <p className="text-[10px] text-muted-foreground">Активностей</p>
                </div>
                <div className="rounded-lg bg-purple-500/5 border border-purple-500/10 p-3 text-center">
                  <p className="text-lg font-bold text-purple-400">{bidsCount}</p>
                  <p className="text-[10px] text-muted-foreground">Ставок</p>
                </div>
              </div>
              {penaltiesCount > 0 && (
                <div className="mt-3 rounded-lg bg-orange-500/5 border border-orange-500/10 p-3 text-center">
                  <p className="text-sm font-bold text-orange-400">{penaltiesCount} штрафов</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5" />
                  История
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {timeline?.length ? (
                <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2">
                  {timeline.map((item: any, i: number) => {
                    const Icon = typeIcons[item.type] || Coins;
                    const dotColor = typeColors[item.type] || 'bg-gray-400';
                    return (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-border/30 p-3 text-sm hover:bg-accent/10 transition-colors">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                            <span className="font-medium text-xs">{typeLabels[item.type] || item.type}</span>
                          </div>
                          {item.data?.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.data.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {item.data?.amount && (
                            <span className={`font-mono text-sm block ${Number(item.data.amount) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {Number(item.data.amount) > 0 ? '+' : ''}{formatDkp(item.data.amount)}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground block">{formatDate(item.date)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">Нет записей в истории</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
