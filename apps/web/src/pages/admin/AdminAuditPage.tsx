import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';
import { ScrollText, Search, Filter, User, Shield, Coins, Trophy, Dices, Package, Newspaper, Rss, Swords, Mail, Settings, LogIn } from 'lucide-react';
import { useState } from 'react';

const categoryIcons: Record<string, React.ElementType> = {
  admin: Settings, clan: Shield, dkp: Coins, auction: Trophy, randomizer: Dices,
  warehouse: Package, auth: LogIn, news: Newspaper, feed: Rss, activity: Swords, message: Mail,
};

const categoryColors: Record<string, string> = {
  admin: 'text-red-400 bg-red-500/10', clan: 'text-blue-400 bg-blue-500/10',
  dkp: 'text-gold-400 bg-gold-500/10', auction: 'text-purple-400 bg-purple-500/10',
  randomizer: 'text-cyan-400 bg-cyan-500/10', warehouse: 'text-green-400 bg-green-500/10',
  auth: 'text-emerald-400 bg-emerald-500/10', news: 'text-orange-400 bg-orange-500/10',
  feed: 'text-pink-400 bg-pink-500/10', activity: 'text-yellow-400 bg-yellow-500/10',
  message: 'text-indigo-400 bg-indigo-500/10',
};

const actionBadgeColors: Record<string, string> = {
  created: 'border-green-500/30 text-green-400 bg-green-500/5',
  updated: 'border-blue-500/30 text-blue-400 bg-blue-500/5',
  deleted: 'border-red-500/30 text-red-400 bg-red-500/5',
  approved: 'border-green-500/30 text-green-400 bg-green-500/5',
  rejected: 'border-red-500/30 text-red-400 bg-red-500/5',
  credit: 'border-green-500/30 text-green-400 bg-green-500/5',
  debit: 'border-red-500/30 text-red-400 bg-red-500/5',
  penalty: 'border-orange-500/30 text-orange-400 bg-orange-500/5',
  login: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5',
  completed: 'border-green-500/30 text-green-400 bg-green-500/5',
  started: 'border-blue-500/30 text-blue-400 bg-blue-500/5',
  kicked: 'border-red-500/30 text-red-400 bg-red-500/5',
  impersonate: 'border-purple-500/30 text-purple-400 bg-purple-500/5',
};

const getActionBadgeColor = (action: string) => {
  for (const [key, color] of Object.entries(actionBadgeColors)) {
    if (action.includes(key)) return color;
  }
  return 'border-border text-muted-foreground';
};

export function AdminAuditPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [viewMode, setViewMode] = useState<'friendly' | 'raw'>('friendly');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', viewMode, search, category, dateFrom, dateTo, page],
    queryFn: async () => {
      if (viewMode === 'friendly') {
        return (await api.get('/audit/events', { params: {
          search: search || undefined,
          category: category || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
          page,
          limit: 30,
        }})).data;
      }
      return (await api.get('/audit', { params: {
        search: search || undefined,
        entityType: category || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page,
        limit: 30,
      }})).data;
    },
  });

  const categories = [
    { value: '', label: 'Все категории' },
    { value: 'admin', label: 'Администрирование' },
    { value: 'clan', label: 'Клан' },
    { value: 'dkp', label: 'DKP Экономика' },
    { value: 'auction', label: 'Аукционы' },
    { value: 'randomizer', label: 'Рандомайзер' },
    { value: 'warehouse', label: 'Хранилище' },
    { value: 'auth', label: 'Авторизация' },
    { value: 'news', label: 'Новости' },
    { value: 'feed', label: 'Лента' },
    { value: 'activity', label: 'Активности' },
    { value: 'message', label: 'Сообщения' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Журнал событий</h1>
          <p className="mt-1 text-muted-foreground">Полная история всех действий в системе</p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === 'friendly' ? 'gold' : 'outline'} size="sm" onClick={() => { setViewMode('friendly'); setPage(1); }}>
            Читаемый вид
          </Button>
          <Button variant={viewMode === 'raw' ? 'gold' : 'outline'} size="sm" onClick={() => { setViewMode('raw'); setPage(1); }}>
            Технический
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Поиск..." className="pl-9" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[180px]"
          value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <Input type="date" className="w-40 text-xs" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} placeholder="От" />
        <Input type="date" className="w-40 text-xs" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} placeholder="До" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(10)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : data?.data?.length ? (
            viewMode === 'friendly' ? (
              <div className="divide-y divide-border/30">
                {data.data.map((log: any) => {
                  const cat = log.category || 'system';
                  const Icon = categoryIcons[cat] || ScrollText;
                  const colorClass = categoryColors[cat] || 'text-muted-foreground bg-secondary';
                  return (
                    <div key={log.id} className="flex items-start gap-4 px-4 py-3 hover:bg-accent/10 transition-colors">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{log.description}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {log.entityName && (
                            <Badge variant="outline" className="text-[10px]">{log.entityName}</Badge>
                          )}
                          <Badge variant="outline" className={`text-[10px] ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.createdAt)}</p>
                        <p className="text-[10px] text-muted-foreground">{log.actorName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-left text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium">Время</th>
                      <th className="px-4 py-3 font-medium">Категория</th>
                      <th className="px-4 py-3 font-medium">Актор</th>
                      <th className="px-4 py-3 font-medium">Действие</th>
                      <th className="px-4 py-3 font-medium">Сущность</th>
                      <th className="px-4 py-3 font-medium">IP</th>
                      <th className="px-4 py-3 font-medium">Детали</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((log: any) => (
                      <tr key={log.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] ${categoryColors[log.category] || ''}`}>
                            {log.categoryLabel || log.category || '—'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium">{log.actor?.profile?.nickname || log.actorId?.slice(0, 8) || 'System'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <span className={`text-xs font-mono ${getActionBadgeColor(log.action)}`}>{log.action}</span>
                            {log.actionLabel && <p className="text-[10px] text-muted-foreground mt-0.5">{log.actionLabel}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">{log.entityTypeLabel || log.entityType}</Badge>
                          {log.entityId && <span className="ml-1 text-[10px] text-muted-foreground font-mono">{log.entityId.slice(0, 8)}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{log.ip || '—'}</td>
                        <td className="px-4 py-3">
                          {(log.before || log.after) && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Показать</summary>
                              <div className="mt-1 max-w-xs overflow-auto rounded bg-background p-2 text-[10px] font-mono">
                                {log.before && <div><span className="text-red-400">до:</span> {JSON.stringify(log.before).slice(0, 200)}</div>}
                                {log.after && <div><span className="text-green-400">после:</span> {JSON.stringify(log.after).slice(0, 200)}</div>}
                              </div>
                            </details>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center py-16">
              <ScrollText className="h-16 w-16 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">Нет записей аудита</p>
            </div>
          )}
        </CardContent>
      </Card>

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
          <span className="text-sm text-muted-foreground">{page} из {data.meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Вперёд</Button>
        </div>
      )}
    </div>
  );
}
