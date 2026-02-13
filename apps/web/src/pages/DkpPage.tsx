import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDkp, formatDateTime } from '@/lib/utils';
import { Coins, TrendingUp, TrendingDown, Lock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const txTypeLabels: Record<string, string> = {
  ACTIVITY_REWARD: 'Награда за активность',
  AUCTION_WIN: 'Победа на аукционе',
  AUCTION_REFUND: 'Возврат с аукциона',
  PENALTY: 'Штраф',
  ADMIN_ADJUST: 'Корректировка админа',
  HOLD_PLACE: 'Удержание',
  HOLD_RELEASE: 'Возврат удержания',
  HOLD_FINALIZE: 'Списание удержания',
  MANUAL_CREDIT: 'Начисление',
  MANUAL_DEBIT: 'Списание',
};

export function DkpPage() {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['dkp', 'wallet'],
    queryFn: async () => (await api.get('/dkp/wallet')).data,
  });

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ['dkp', 'transactions', page],
    queryFn: async () => (await api.get('/dkp/transactions', { params: { page, limit: 20 } })).data,
  });

  const available = wallet ? Number(wallet.balance) - Number(wallet.onHold) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">DKP Кошелёк</h1>
          <p className="mt-1 text-muted-foreground">Управление вашими очками Dragon Kill Points</p>
        </div>
        <Link to="/rules/dkp">
          <Button variant="outline" size="sm">Правила DKP</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-gold-500/20 bg-gradient-to-br from-gold-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Баланс</CardTitle>
            <Coins className="h-5 w-5 text-gold-400" />
          </CardHeader>
          <CardContent>
            {walletLoading ? <Skeleton className="h-9 w-32" /> : (
              <div className="text-3xl font-bold text-gold-400">{formatDkp(wallet?.balance || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Доступно</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-400" />
          </CardHeader>
          <CardContent>
            {walletLoading ? <Skeleton className="h-9 w-32" /> : (
              <div className="text-3xl font-bold text-green-400">{formatDkp(available)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">В удержании</CardTitle>
            <Lock className="h-5 w-5 text-orange-400" />
          </CardHeader>
          <CardContent>
            {walletLoading ? <Skeleton className="h-9 w-32" /> : (
              <div className="text-3xl font-bold text-orange-400">{formatDkp(wallet?.onHold || 0)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">История транзакций</CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : transactions?.data?.length ? (
            <div className="space-y-2">
              {transactions.data.map((tx: any) => {
                const isPositive = Number(tx.amount) > 0;
                return (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg border border-border/30 px-4 py-3 hover:bg-accent/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        {isPositive ? <ArrowUpRight className="h-4 w-4 text-green-400" /> : <ArrowDownRight className="h-4 w-4 text-red-400" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{txTypeLabels[tx.type] || tx.type}</p>
                        <p className="text-xs text-muted-foreground">{tx.description || '—'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{formatDkp(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(tx.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Нет транзакций</p>
          )}

          {transactions?.meta && transactions.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
              <span className="text-sm text-muted-foreground">{page} из {transactions.meta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= transactions.meta.totalPages} onClick={() => setPage(p => p + 1)}>Вперёд</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
