import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDkp, getRoleLabel } from '@/lib/utils';
import { BarChart3, Users, Coins, Swords, Trophy, Dices, AlertTriangle, ArrowLeft, Download } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

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

  const totals = report?.report?.reduce((acc: any, m: any) => ({
    dkpEarned: acc.dkpEarned + m.dkpEarned,
    dkpSpent: acc.dkpSpent + m.dkpSpent,
    penaltyTotal: acc.penaltyTotal + m.penaltyTotal,
    activitiesCount: acc.activitiesCount + m.activitiesCount,
    auctionWinsCount: acc.auctionWinsCount + m.auctionWinsCount,
    itemsReceived: acc.itemsReceived + m.itemsReceived,
  }), { dkpEarned: 0, dkpSpent: 0, penaltyTotal: 0, activitiesCount: 0, auctionWinsCount: 0, itemsReceived: 0 });

  const summaryCards = totals ? [
    { label: 'Участников', value: report?.membersCount, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'DKP заработано', value: formatDkp(totals.dkpEarned), icon: Coins, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'DKP потрачено', value: formatDkp(totals.dkpSpent), icon: Coins, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Штрафов', value: formatDkp(totals.penaltyTotal), icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Активностей', value: totals.activitiesCount, icon: Swords, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Предметов получено', value: totals.itemsReceived, icon: Dices, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/clan"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="font-display text-3xl font-bold">Отчёт клана</h1>
            <p className="mt-1 text-muted-foreground">Статистика участников за выбранный период</p>
          </div>
        </div>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">С:</span>
              <Input type="date" className="w-44 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">По:</span>
              <Input type="date" className="w-44 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
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
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {summaryCards.map((card) => (
              <Card key={card.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
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
                    <tr className="border-b border-border bg-secondary/30 text-left text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium">Игрок</th>
                      <th className="px-4 py-3 font-medium">Роль</th>
                      <th className="px-4 py-3 font-medium text-right">БМ</th>
                      <th className="px-4 py-3 font-medium text-right">Ур.</th>
                      <th className="px-4 py-3 font-medium text-right">Баланс DKP</th>
                      <th className="px-4 py-3 font-medium text-right">Заработано</th>
                      <th className="px-4 py-3 font-medium text-right">Потрачено</th>
                      <th className="px-4 py-3 font-medium text-center">Активности</th>
                      <th className="px-4 py-3 font-medium text-center">Штрафы</th>
                      <th className="px-4 py-3 font-medium text-center">Ставки</th>
                      <th className="px-4 py-3 font-medium text-center">Победы</th>
                      <th className="px-4 py-3 font-medium text-center">Предметов</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.report.map((m: any) => (
                      <tr key={m.userId} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-3">
                          <Link to={`/users/${m.userId}`} className="hover:text-primary transition-colors">
                            <p className="font-medium">{m.nickname}</p>
                            {m.displayName && <p className="text-[10px] text-muted-foreground">{m.displayName}</p>}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">{getRoleLabel(m.role)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{m.bm?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{m.level}</td>
                        <td className="px-4 py-3 text-right font-mono text-gold-400">{formatDkp(m.currentBalance)}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-400">{m.dkpEarned > 0 ? `+${formatDkp(m.dkpEarned)}` : '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-400">{m.dkpSpent > 0 ? `-${formatDkp(m.dkpSpent)}` : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-mono ${m.activitiesCount > 0 ? 'text-yellow-400' : 'text-muted-foreground'}`}>{m.activitiesCount}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.penaltiesCount > 0 ? (
                            <span className="text-orange-400 font-mono">{m.penaltiesCount} ({formatDkp(m.penaltyTotal)})</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{m.auctionBidsCount || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-mono ${m.auctionWinsCount > 0 ? 'text-purple-400' : 'text-muted-foreground'}`}>
                            {m.auctionWinsCount || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-mono ${m.itemsReceived > 0 ? 'text-cyan-400 font-bold' : 'text-muted-foreground'}`}>
                            {m.itemsReceived || '—'}
                          </span>
                        </td>
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
