import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatDkp, getRoleLabel } from '@/lib/utils';
import { BarChart3, Users, Coins, Swords, Trophy, Dices, AlertTriangle, ArrowLeft, Gift } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type WinRow = {
  id: string;
  source: 'AUCTION' | 'RANDOMIZER' | 'FORTUNE';
  wonAt: string;
  userId: string;
  nickname: string;
  displayName?: string | null;
  itemName: string;
  itemRarity?: string | null;
  quantity: number;
  details?: {
    auctionId?: string;
    auctionTitle?: string;
    lotId?: string;
    finalPrice?: number | null;
    sessionId?: string;
    bet?: number;
    rarity?: string;
  };
};

function sourceBadge(source: WinRow['source']) {
  if (source === 'AUCTION') return <Badge variant="outline" className="border-violet-400/40 text-violet-300">Аукцион</Badge>;
  if (source === 'RANDOMIZER') return <Badge variant="outline" className="border-cyan-400/40 text-cyan-300">Рандомайзер</Badge>;
  return <Badge variant="outline" className="border-amber-400/40 text-amber-300">Фортуна</Badge>;
}

function sourceDetails(win: WinRow) {
  if (win.source === 'AUCTION') {
    return win.details?.auctionTitle ? `Лот аукциона: ${win.details.auctionTitle}` : 'Выигрыш в аукционе';
  }
  if (win.source === 'RANDOMIZER') {
    return 'Выигрыш в рандомайзере';
  }
  return `Ставка: ${win.details?.bet ?? 0} DKP`;
}

export function ClanReportPage() {
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['clan-report', clanId, dateFrom, dateTo],
    queryFn: async () => (await api.get(`/clans/${clanId}/report`, {
      params: { from: dateFrom || undefined, to: dateTo || undefined },
    })).data,
    enabled: !!clanId,
  });

  const totals = useMemo(
    () => report?.report?.reduce((acc: any, m: any) => ({
      dkpEarned: acc.dkpEarned + m.dkpEarned,
      dkpSpent: acc.dkpSpent + m.dkpSpent,
      penaltyTotal: acc.penaltyTotal + m.penaltyTotal,
      activitiesCount: acc.activitiesCount + m.activitiesCount,
      auctionWinsCount: acc.auctionWinsCount + m.auctionWinsCount,
      randomizerWinsCount: acc.randomizerWinsCount + (m.randomizerWinsCount || 0),
      fortuneWinsCount: acc.fortuneWinsCount + (m.fortuneWinsCount || 0),
      itemsReceived: acc.itemsReceived + m.itemsReceived,
    }), {
      dkpEarned: 0,
      dkpSpent: 0,
      penaltyTotal: 0,
      activitiesCount: 0,
      auctionWinsCount: 0,
      randomizerWinsCount: 0,
      fortuneWinsCount: 0,
      itemsReceived: 0,
    }),
    [report],
  );

  const wins: WinRow[] = report?.wins || [];

  const summaryCards = totals ? [
    { label: 'Участников', value: report?.membersCount, icon: Users, color: 'text-blue-300', bg: 'from-blue-500/20 to-blue-500/5' },
    { label: 'DKP заработано', value: formatDkp(totals.dkpEarned), icon: Coins, color: 'text-emerald-300', bg: 'from-emerald-500/20 to-emerald-500/5' },
    { label: 'DKP потрачено', value: formatDkp(totals.dkpSpent), icon: Coins, color: 'text-rose-300', bg: 'from-rose-500/20 to-rose-500/5' },
    { label: 'Штрафов', value: formatDkp(totals.penaltyTotal), icon: AlertTriangle, color: 'text-orange-300', bg: 'from-orange-500/20 to-orange-500/5' },
    { label: 'Активностей', value: totals.activitiesCount, icon: Swords, color: 'text-yellow-300', bg: 'from-yellow-500/20 to-yellow-500/5' },
    { label: 'Выигрышей', value: report?.winsSummary?.total ?? wins.length, icon: Gift, color: 'text-fuchsia-300', bg: 'from-fuchsia-500/20 to-fuchsia-500/5' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/clan"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl md:text-3xl">Отчет клана</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">Победы и статистика участников за выбранный период</p>
        </div>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">С:</span>
              <Input type="date" className="w-36 text-sm sm:w-44" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">По:</span>
              <Input type="date" className="w-36 text-sm sm:w-44" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button variant="gold" size="sm" onClick={() => refetch()}>
              <BarChart3 className="h-4 w-4" /> Сформировать
            </Button>
            {(dateFrom || dateTo) && (
              <Button variant="outline" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                Сбросить
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {summaryCards.map((card) => (
              <Card key={card.label} className="overflow-hidden border-border/60 bg-gradient-to-br">
                <CardContent className={`bg-gradient-to-br p-4 ${card.bg}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/20">
                      <card.icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                    <div>
                      <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                      <p className="text-[10px] text-muted-foreground">{card.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                Детализация по участникам
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Игрок</th>
                      <th className="px-4 py-3 font-medium">Роль</th>
                      <th className="px-4 py-3 font-medium text-right">Баланс DKP</th>
                      <th className="px-4 py-3 font-medium text-right">Заработано</th>
                      <th className="px-4 py-3 font-medium text-right">Потрачено</th>
                      <th className="px-4 py-3 font-medium text-center">Победы Аук.</th>
                      <th className="px-4 py-3 font-medium text-center">Победы Ранд.</th>
                      <th className="px-4 py-3 font-medium text-center">Победы Форт.</th>
                      <th className="px-4 py-3 font-medium text-center">Всего предметов</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.report.map((m: any) => (
                      <tr key={m.userId} className="border-b border-border/30 transition-colors hover:bg-accent/20">
                        <td className="px-4 py-3">
                          <Link to={`/users/${m.userId}`} className="hover:text-primary transition-colors">
                            <p className="font-medium">{m.nickname}</p>
                            {m.displayName && <p className="text-[10px] text-muted-foreground">{m.displayName}</p>}
                          </Link>
                        </td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{getRoleLabel(m.role)}</Badge></td>
                        <td className="px-4 py-3 text-right font-mono text-gold-400">{formatDkp(m.currentBalance)}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">{m.dkpEarned > 0 ? `+${formatDkp(m.dkpEarned)}` : '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-rose-400">{m.dkpSpent > 0 ? `-${formatDkp(m.dkpSpent)}` : '—'}</td>
                        <td className="px-4 py-3 text-center font-mono text-violet-300">{m.auctionWinsCount || '—'}</td>
                        <td className="px-4 py-3 text-center font-mono text-cyan-300">{m.randomizerWinsCount || '—'}</td>
                        <td className="px-4 py-3 text-center font-mono text-amber-300">{m.fortuneWinsCount || '—'}</td>
                        <td className="px-4 py-3 text-center font-mono text-fuchsia-300">{m.itemsReceived || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-primary/20">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5" />
                Кто что выиграл
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[62vh] overflow-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Дата</th>
                      <th className="px-4 py-3 font-medium">Источник</th>
                      <th className="px-4 py-3 font-medium">Игрок</th>
                      <th className="px-4 py-3 font-medium">Предмет</th>
                      <th className="px-4 py-3 font-medium text-center">Кол-во</th>
                      <th className="px-4 py-3 font-medium">Детали</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wins.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                          За выбранный период выигрышей нет
                        </td>
                      </tr>
                    )}
                    {wins.map((win) => (
                      <tr key={`${win.source}-${win.id}`} className="border-b border-border/30 transition-colors hover:bg-accent/20">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(win.wonAt)}</td>
                        <td className="px-4 py-3">{sourceBadge(win.source)}</td>
                        <td className="px-4 py-3">
                          <Link to={`/users/${win.userId}`} className="font-medium hover:text-primary transition-colors">
                            {win.nickname}
                          </Link>
                          {win.displayName && <div className="text-[10px] text-muted-foreground">{win.displayName}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{win.itemName}</div>
                          {win.itemRarity && <div className="text-[10px] text-muted-foreground">{win.itemRarity}</div>}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{win.quantity}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{sourceDetails(win)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
