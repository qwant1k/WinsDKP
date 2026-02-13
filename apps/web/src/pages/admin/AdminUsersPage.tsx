import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDkp, formatDateTime, getRoleLabel } from '@/lib/utils';
import { Search, UserCog, Ban, CheckCircle, Plus, Trash2, Pencil, X, KeyRound, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', nickname: '', displayName: '', globalRole: 'USER', password: '' });
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search, page],
    queryFn: async () => (await api.get('/admin/users', { params: { search: search || undefined, page, limit: 20 } })).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post('/admin/users', createForm)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowCreateForm(false);
      setCreateForm({ email: '', nickname: '', displayName: '', globalRole: 'USER', password: '' });
      if (data.generatedPassword) {
        toast.success(`Пользователь создан. Пароль: ${data.generatedPassword}`, { duration: 10000 });
      } else {
        toast.success('Пользователь создан');
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; [key: string]: any }) =>
      (await api.patch(`/admin/users/${id}`, body)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditingUser(null);
      toast.success('Пользователь обновлён');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => (await api.delete(`/admin/users/${userId}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Пользователь удалён');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => (await api.post(`/admin/impersonate/${userId}`)).data,
    onSuccess: (data) => {
      toast.success(`Имперсонация: ${data.email}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => (await api.post(`/admin/users/${userId}/reset-password`)).data,
    onSuccess: () => {
      toast.success('Пароль сброшен. Пользователь установит новый при следующем входе.');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const [dkpUserId, setDkpUserId] = useState<string | null>(null);
  const [dkpAmount, setDkpAmount] = useState('');
  const [dkpDesc, setDkpDesc] = useState('');

  const dkpAdjustMutation = useMutation({
    mutationFn: async () => (await api.post('/dkp/admin/adjust', { userId: dkpUserId, amount: Number(dkpAmount), description: dkpDesc || 'Корректировка админом' })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setDkpUserId(null); setDkpAmount(''); setDkpDesc('');
      toast.success('DKP скорректировано');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const startEdit = (user: any) => {
    setEditingUser(user.id);
    setEditForm({
      globalRole: user.globalRole,
      isActive: user.isActive,
      email: user.email,
      displayName: user.profile?.displayName || '',
      bm: user.profile?.bm || 0,
      level: user.profile?.level || 1,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Управление пользователями</h1>
          <p className="mt-1 text-muted-foreground">{data?.meta?.total || 0} пользователей в системе</p>
        </div>
        <Button variant="gold" size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreateForm ? 'Отмена' : 'Добавить'}
        </Button>
      </div>

      {showCreateForm && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-lg">Новый пользователь</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Input placeholder="Email *" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              <Input placeholder="Ник *" value={createForm.nickname} onChange={(e) => setCreateForm({ ...createForm, nickname: e.target.value })} />
              <Input placeholder="Отображаемое имя" value={createForm.displayName} onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })} />
              <Input placeholder="Пароль (авто)" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
              <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={createForm.globalRole} onChange={(e) => setCreateForm({ ...createForm, globalRole: e.target.value })}>
                <option value="USER">Пользователь</option>
                <option value="PORTAL_ADMIN">Админ портала</option>
              </select>
              <Button variant="gold" disabled={!createForm.email || !createForm.nickname || createMutation.isPending} onClick={() => createMutation.mutate()}>
                Создать
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Поиск по email или нику..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-left text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Пользователь</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Роль</th>
                    <th className="px-4 py-3 font-medium">Клан</th>
                    <th className="px-4 py-3 font-medium text-right">DKP</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <th className="px-4 py-3 font-medium">Создан</th>
                    <th className="px-4 py-3 font-medium text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data?.map((user: any) => {
                    const membership = user.clanMemberships?.[0];
                    const isEditing = editingUser === user.id;
                    return (
                      <tr key={user.id} className={`border-b border-border/30 transition-colors ${isEditing ? 'bg-primary/5' : 'hover:bg-accent/20'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                              {user.profile?.nickname?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-medium">{user.profile?.nickname || '—'}</p>
                              {isEditing ? (
                                <Input className="h-6 text-xs w-32 mt-1" value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} placeholder="Имя" />
                              ) : (
                                <p className="text-xs text-muted-foreground">{user.profile?.displayName}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {isEditing ? (
                            <Input className="h-6 text-xs w-40" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                          ) : user.email}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select className="rounded border border-input bg-background px-2 py-1 text-xs" value={editForm.globalRole} onChange={(e) => setEditForm({ ...editForm, globalRole: e.target.value })}>
                              <option value="USER">Пользователь</option>
                              <option value="PORTAL_ADMIN">Админ</option>
                            </select>
                          ) : (
                            <Badge variant={user.globalRole === 'PORTAL_ADMIN' ? 'destructive' : 'secondary'} className="text-[10px]">
                              {getRoleLabel(user.globalRole)}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {membership ? (
                            <span className="text-xs">[{membership.clan?.tag}] {getRoleLabel(membership.role)}</span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gold-400">
                          {user.dkpWallet ? formatDkp(user.dkpWallet.balance) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {user.isActive ? (
                            <Badge variant="success" className="text-[10px]">Активен</Badge>
                          ) : (
                            <Badge variant="error" className="text-[10px]">Заблокирован</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(user.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <div className="flex gap-1 items-center mr-2">
                                <span className="text-[10px] text-muted-foreground">БМ:</span>
                                <Input type="number" className="h-6 text-xs w-16" value={editForm.bm} onChange={(e) => setEditForm({ ...editForm, bm: Number(e.target.value) })} />
                                <span className="text-[10px] text-muted-foreground">Ур:</span>
                                <Input type="number" className="h-6 text-xs w-14" value={editForm.level} onChange={(e) => setEditForm({ ...editForm, level: Number(e.target.value) })} />
                              </div>
                              <Button variant="gold" size="sm" className="h-7 text-xs" onClick={() => updateMutation.mutate({ id: user.id, ...editForm })} disabled={updateMutation.isPending}>
                                Сохранить
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingUser(null)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Редактировать" onClick={() => startEdit(user)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Сбросить пароль"
                                onClick={() => { if (confirm(`Сбросить пароль для ${user.email}? Пользователь установит новый при следующем входе.`)) resetPasswordMutation.mutate(user.id); }}>
                                <KeyRound className="h-3 w-3 text-amber-400" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="DKP"
                                onClick={() => { setDkpUserId(user.id); setDkpAmount(''); setDkpDesc(''); }}>
                                <Coins className="h-3 w-3 text-gold-400" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Имперсонация"
                                onClick={() => impersonateMutation.mutate(user.id)}>
                                <UserCog className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                title={user.isActive ? 'Заблокировать' : 'Разблокировать'}
                                onClick={() => updateMutation.mutate({ id: user.id, isActive: !user.isActive })}>
                                {user.isActive ? <Ban className="h-3 w-3 text-red-400" /> : <CheckCircle className="h-3 w-3 text-green-400" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Удалить"
                                onClick={() => { if (confirm('Удалить пользователя? Это действие нельзя отменить.')) deleteMutation.mutate(user.id); }}>
                                <Trash2 className="h-3 w-3 text-red-400" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {dkpUserId && (
        <Card className="border-gold-500/30">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Coins className="h-5 w-5 text-gold-400" /> Корректировка DKP</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Сумма (+/-)</label>
                <Input type="number" className="w-32" value={dkpAmount} onChange={(e) => setDkpAmount(e.target.value)} placeholder="100 или -50" />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium">Описание</label>
                <Input value={dkpDesc} onChange={(e) => setDkpDesc(e.target.value)} placeholder="Причина корректировки" />
              </div>
              <Button variant="gold" disabled={!dkpAmount || dkpAdjustMutation.isPending} onClick={() => dkpAdjustMutation.mutate()}>Применить</Button>
              <Button variant="ghost" onClick={() => setDkpUserId(null)}><X className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

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
