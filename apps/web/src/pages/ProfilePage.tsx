import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useLocaleStore } from '@/stores/locale.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDkp, formatDate, getRoleLabel } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { Save, Shield, Coins, TrendingUp, KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

export function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const setLocale = useLocaleStore((state) => state.setLocale);
  const { t } = useI18n();

  const [form, setForm] = useState({
    nickname: '',
    displayName: '',
    bm: 0,
    level: 1,
    awakeningLevel: '' as '' | 1 | 2 | 3,
    locale: 'ru',
  });

  useEffect(() => {
    if (user?.profile) {
      setForm({
        nickname: user.profile.nickname || '',
        displayName: user.profile.displayName || '',
        bm: user.profile.bm,
        level: user.profile.level,
        awakeningLevel: (user.profile.awakeningLevel ?? '') as '' | 1 | 2 | 3,
        locale: user.profile.locale || 'ru',
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async () =>
      (await api.patch('/users/me/profile', {
        ...form,
        awakeningLevel: form.awakeningLevel === '' ? null : Number(form.awakeningLevel),
      })).data,
    onSuccess: async () => {
      setLocale(form.locale);
      await fetchMe();
      toast.success(t('profile.saved'));
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const { data: timeline } = useQuery({
    queryKey: ['timeline', user?.id],
    queryFn: async () => (await api.get('/users/me/timeline?limit=20')).data,
    enabled: !!user?.id,
  });

  const saveAwakeningMutation = useMutation({
    mutationFn: async (level: 1 | 2 | 3) => (await api.patch('/users/me/profile', { awakeningLevel: level })).data,
    onSuccess: async (_, level) => {
      setForm((prev) => ({ ...prev, awakeningLevel: level }));
      await fetchMe();
      toast.success('Пробуждение сохранено');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const clearAwakeningMutation = useMutation({
    mutationFn: async () => (await api.patch('/users/me/profile', { awakeningLevel: null })).data,
    onSuccess: async () => {
      setForm((prev) => ({ ...prev, awakeningLevel: '' }));
      await fetchMe();
      toast.success('Пробуждение удалено');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold">{t('profile.title')}</h1>

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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Coins className="h-4 w-4 text-gold-400" /> {t('sidebar.dkp')}
                </div>
                <span className="font-bold text-gold-400">{formatDkp(user?.dkpWallet?.balance || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-blue-400" /> {t('profile.power')}
                </div>
                <span className="font-bold">{user?.profile?.bm?.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4 text-green-400" /> {t('profile.level')}
                </div>
                <span className="font-bold">{user?.profile?.level}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('profile.edit')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('profile.nickname')}</label>
                  <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="DragonSlayer" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('profile.displayName')}</label>
                  <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="John" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('profile.power')}</label>
                  <Input type="number" value={form.bm} onChange={(e) => setForm({ ...form, bm: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('profile.level')}</label>
                  <Input type="number" value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })} min={1} max={100} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('profile.lang')}</label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
                    <option value="ru">{t('lang.ru')}</option>
                    <option value="en">{t('lang.en')}</option>
                    <option value="tr">{t('lang.tr')}</option>
                  </select>
                </div>
              </div>
              <div className="rounded-lg border border-border/40 p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Пробуждение персонажа</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.awakeningLevel === '' ? '' : String(form.awakeningLevel)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({
                          ...form,
                          awakeningLevel: (val === '' ? '' : Number(val)) as '' | 1 | 2 | 3,
                        });
                      }}
                    >
                      <option value="">Не выбрано</option>
                      <option value="1">1 уровень</option>
                      <option value="2">2 уровень</option>
                      <option value="3">3 уровень</option>
                    </select>
                  </div>
                  <Button
                    variant="gold"
                    disabled={form.awakeningLevel === '' || saveAwakeningMutation.isPending}
                    onClick={() => saveAwakeningMutation.mutate(form.awakeningLevel as 1 | 2 | 3)}
                  >
                    Сохранить пробуждение
                  </Button>
                  <Button
                    variant="outline"
                    disabled={clearAwakeningMutation.isPending}
                    onClick={() => clearAwakeningMutation.mutate()}
                  >
                    Удалить пробуждение
                  </Button>
                </div>
              </div>
              <Button variant="gold" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4" /> {t('profile.save')}
              </Button>
            </CardContent>
          </Card>

          <ChangePasswordCard />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('profile.timeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline?.length ? (
                <div className="space-y-3">
                  {timeline.map((item: any, i: number) => {
                    let label = '';
                    let detail = '';
                    let amountVal: number | null = null;
                    if (item.type === 'dkp_transaction') {
                      label = 'DKP';
                      detail = item.data?.description || '';
                      amountVal = item.data?.amount;
                    } else if (item.type === 'activity') {
                      label = t('profile.activity');
                      detail = item.data?.activity?.title || '';
                      amountVal = item.data?.dkpEarned;
                    } else if (item.type === 'bid') {
                      const itemName = item.data?.lot?.warehouseItem?.name || t('profile.item');
                      const won = item.data?.lot?.result?.winnerId === user?.id;
                      label = won ? t('profile.win') : t('profile.bid');
                      detail = itemName;
                      amountVal = item.data?.amount;
                    } else if (item.type === 'penalty') {
                      label = t('profile.penalty');
                      detail = item.data?.reason || '';
                      amountVal = item.data?.amount;
                    }
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-border/30 p-3 text-sm">
                        <div className={`h-2 w-2 rounded-full ${item.type === 'dkp_transaction' ? 'bg-gold-400' : item.type === 'activity' ? 'bg-green-400' : item.type === 'bid' ? 'bg-purple-400' : 'bg-red-400'}`} />
                        <div className="flex-1">
                          <span className="font-medium">{label}</span>
                          {detail && <span className="text-muted-foreground"> - {detail}</span>}
                          {amountVal != null && <span className="font-mono ml-2 text-gold-400">{formatDkp(amountVal)}</span>}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">{t('profile.empty')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const { t } = useI18n();

  const changeMutation = useMutation({
    mutationFn: async () => (await api.post('/auth/change-password', { oldPassword, newPassword })).data,
    onSuccess: () => {
      toast.success(t('profile.passwordSaved'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleSubmit = () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('profile.passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('profile.passwordMin'));
      return;
    }
    changeMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5" /> {t('profile.changePassword')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('profile.currentPassword')}</label>
          <div className="relative">
            <Input type={showOld ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••••" />
            <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShowOld(!showOld)}>
              {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('profile.newPassword')}</label>
            <div className="relative">
              <Input type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShowNew(!showNew)}>
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('profile.confirmPassword')}</label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        <Button variant="outline" onClick={handleSubmit} disabled={changeMutation.isPending || !oldPassword || !newPassword}>
          <KeyRound className="h-4 w-4" /> {changeMutation.isPending ? t('profile.saving') : t('profile.change')}
        </Button>
      </CardContent>
    </Card>
  );
}


