import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDkp, getRoleLabel } from '@/lib/utils';
import { User, Save, Shield, Coins, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

export function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    nickname: '',
    displayName: '',
    bm: 0,
    level: 1,
    locale: 'ru',
  });

  useEffect(() => {
    if (user?.profile) {
      setForm({
        nickname: user.profile.nickname || '',
        displayName: user.profile.displayName || '',
        bm: user.profile.bm,
        level: user.profile.level,
        locale: user.profile.locale,
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async () => (await api.patch('/users/me/profile', form)).data,
    onSuccess: () => {
      fetchMe();
      toast.success('Профиль обновлён');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const { data: timeline } = useQuery({
    queryKey: ['timeline', user?.id],
    queryFn: async () => (await api.get('/users/me/timeline?limit=20')).data,
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Личный кабинет</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-3xl font-bold text-primary">
                {user?.profile?.nickname?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <h2 className="mt-4 text-xl font-bold">{user?.profile?.nickname}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {user?.clanMembership && (
                <Badge variant="gold" className="mt-2">
                  [{user.clanMembership.clan.tag}] {getRoleLabel(user.clanMembership.role)}
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Coins className="h-4 w-4 text-gold-400" /> Баланс DKP</div>
                <span className="font-bold text-gold-400">{formatDkp(user?.dkpWallet?.balance || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4 text-blue-400" /> Боевая мощь</div>
                <span className="font-bold">{user?.profile?.bm?.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Shield className="h-4 w-4 text-green-400" /> Уровень</div>
                <span className="font-bold">{user?.profile?.level}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Редактировать профиль</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Никнейм (игровой)</label>
                  <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="Игровое имя" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Отображаемое имя</label>
                  <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Реальное имя" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Боевая мощь</label>
                  <Input type="number" value={form.bm} onChange={(e) => setForm({ ...form, bm: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Уровень</label>
                  <Input type="number" value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })} min={1} max={100} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Язык</label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
                    <option value="ru">Русский</option>
                    <option value="kz">Қазақша</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
              <Button variant="gold" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4" /> Сохранить
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Хронология</CardTitle></CardHeader>
            <CardContent>
              {timeline?.length ? (
                <div className="space-y-3">
                  {timeline.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-border/30 p-3 text-sm">
                      <div className={`h-2 w-2 rounded-full ${item.type === 'dkp_transaction' ? 'bg-gold-400' : item.type === 'activity' ? 'bg-green-400' : item.type === 'bid' ? 'bg-purple-400' : 'bg-red-400'}`} />
                      <div className="flex-1">
                        <span className="font-medium capitalize">{item.type.replace('_', ' ')}</span>
                        {item.data?.description && <span className="text-muted-foreground"> — {item.data.description}</span>}
                        {item.data?.amount && <span className="font-mono ml-2 text-gold-400">{formatDkp(item.data.amount)}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString('ru-RU')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">Нет записей</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
