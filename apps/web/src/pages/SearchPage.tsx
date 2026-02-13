import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, User, Newspaper, Rss, Swords, Trophy, Package, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRarityLabel, getRarityClass } from '@/lib/utils';

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  user: { label: 'Игрок', icon: User, color: 'text-blue-400 bg-blue-500/10' },
  news: { label: 'Новость', icon: Newspaper, color: 'text-orange-400 bg-orange-500/10' },
  feed: { label: 'Лента', icon: Rss, color: 'text-pink-400 bg-pink-500/10' },
  activity: { label: 'Активность', icon: Swords, color: 'text-yellow-400 bg-yellow-500/10' },
  auction: { label: 'Аукцион', icon: Trophy, color: 'text-purple-400 bg-purple-500/10' },
  warehouse: { label: 'Хранилище', icon: Package, color: 'text-green-400 bg-green-500/10' },
};

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [filterType, setFilterType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => (await api.get('/search', { params: { q: query, limit: 50 } })).data,
    enabled: query.length >= 2,
  });

  const results = data?.results || [];
  const filtered = filterType ? results.filter((r: any) => r.type === filterType) : results;

  const typeCounts = results.reduce((acc: Record<string, number>, r: any) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length >= 2) {
      setSearchParams({ q: value });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Поиск</h1>
        <p className="mt-1 text-muted-foreground">Поиск по всем разделам системы</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Введите запрос для поиска..."
          className="h-12 pl-12 text-base"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          autoFocus
        />
      </div>

      {query.length >= 2 && results.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-full px-3 py-1 text-xs transition-colors ${!filterType ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-accent'}`}
            onClick={() => setFilterType('')}
          >
            Все ({results.length})
          </button>
          {Object.entries(typeCounts).map(([type, count]) => {
            const cfg = typeConfig[type];
            return (
              <button
                key={type}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${filterType === type ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-accent'}`}
                onClick={() => setFilterType(filterType === type ? '' : type)}
              >
                {cfg?.label || type} ({count as number})
              </button>
            );
          })}
        </div>
      )}

      {isLoading && query.length >= 2 ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((item: any) => {
            const cfg = typeConfig[item.type] || { label: item.type, icon: Search, color: 'text-muted-foreground bg-secondary' };
            const Icon = cfg.icon;
            return (
              <Link key={`${item.type}-${item.id}`} to={item.url}>
                <Card className="hover:border-primary/20 transition-all cursor-pointer">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cfg.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        {item.meta?.rarity && (
                          <Badge variant="outline" className={`text-[10px] ${getRarityClass(item.meta.rarity)}`}>
                            {getRarityLabel(item.meta.rarity)}
                          </Badge>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{cfg.label}</Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : query.length >= 2 ? (
        <div className="flex flex-col items-center py-16">
          <SearchX className="h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">Ничего не найдено по запросу «{query}»</p>
          <p className="text-xs text-muted-foreground mt-1">Попробуйте изменить запрос</p>
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <Search className="h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">Начните вводить запрос (минимум 2 символа)</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {Object.entries(typeConfig).map(([type, cfg]) => {
              const Icon = cfg.icon;
              return (
                <div key={type} className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2">
                  <Icon className={`h-4 w-4 ${cfg.color.split(' ')[0]}`} />
                  <span className="text-xs text-muted-foreground">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
