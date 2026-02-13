import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDkp, getRoleLabel } from '@/lib/utils';
import { Users, UserPlus, UserMinus, Shield, Crown, Star, Check, X, AlertTriangle, Eye, Send, BarChart3, ChevronDown, Calculator, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSocket } from '@/lib/socket';

export function ClanPage() {
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;
  const canManage = user?.clanMembership?.role === 'CLAN_LEADER' || user?.clanMembership?.role === 'ELDER';
  const isLeader = user?.clanMembership?.role === 'CLAN_LEADER';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Real-time: listen for new clan join requests
  useEffect(() => {
    const socket = getSocket();
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['join-requests'] });
    };
    socket.on('clan.join_request_created', handler);
    return () => { socket.off('clan.join_request_created', handler); };
  }, [queryClient]);

  const { data: clan, isLoading } = useQuery({
    queryKey: ['clan', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}`)).data,
    enabled: !!clanId,
  });

  const { data: members } = useQuery({
    queryKey: ['clan-members', clanId, searchTerm],
    queryFn: async () => (await api.get(`/clans/${clanId}/members`, { params: { search: searchTerm || undefined, limit: 50 } })).data,
    enabled: !!clanId,
  });

  const { data: joinRequests } = useQuery({
    queryKey: ['join-requests', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/join-requests`)).data,
    enabled: !!clanId && canManage,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ requestId, approved }: { requestId: string; approved: boolean }) => {
      return (await api.patch(`/clans/${clanId}/join-requests/${requestId}/review`, { approved })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['join-requests'] });
      queryClient.invalidateQueries({ queryKey: ['clan-members'] });
      toast.success('Заявка обработана');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const kickMutation = useMutation({
    mutationFn: async (userId: string) => {
      return (await api.delete(`/clans/${clanId}/members/${userId}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clan-members'] });
      toast.success('Участник исключён');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const [penaltyTarget, setPenaltyTarget] = useState<string | null>(null);
  const [penaltyForm, setPenaltyForm] = useState({ amount: '', reason: '' });
  const [joinMessage, setJoinMessage] = useState('');
  const [roleChangeTarget, setRoleChangeTarget] = useState<string | null>(null);
  const [powerRanges, setPowerRanges] = useState<Array<{ fromPower: number; toPower: number; coefficient: number }>>([]);
  const [levelRanges, setLevelRanges] = useState<Array<{ fromLevel: number; toLevel: number; coefficient: number }>>([]);

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) =>
      (await api.patch(`/clans/${clanId}/members/${userId}/role`, { role })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clan-members'] });
      setRoleChangeTarget(null);
      toast.success('Роль изменена');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const penaltyMutation = useMutation({
    mutationFn: async () => (await api.post(`/dkp/penalty`, {
      userId: penaltyTarget,
      amount: Number(penaltyForm.amount),
      reason: penaltyForm.reason,
      clanId,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clan-members'] });
      setPenaltyTarget(null);
      setPenaltyForm({ amount: '', reason: '' });
      toast.success('Штраф назначен');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const { data: coefficients } = useQuery({
    queryKey: ['coefficients', clanId],
    queryFn: async () => (await api.get(`/admin/coefficients/${clanId}`)).data,
    enabled: !!clanId && isLeader,
  });

  useEffect(() => {
    if (coefficients) {
      setPowerRanges(coefficients.powerRanges?.map((r: any) => ({ fromPower: r.fromPower, toPower: r.toPower, coefficient: Number(r.coefficient) })) || []);
      setLevelRanges(coefficients.levelRanges?.map((r: any) => ({ fromLevel: r.fromLevel, toLevel: r.toLevel, coefficient: Number(r.coefficient) })) || []);
    }
  }, [coefficients]);

  const savePowerMutation = useMutation({
    mutationFn: async () => (await api.patch(`/admin/coefficients/${clanId}/power`, { ranges: powerRanges })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coefficients'] }); toast.success('kBM коэффициенты сохранены'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveLevelMutation = useMutation({
    mutationFn: async () => (await api.patch(`/admin/coefficients/${clanId}/level`, { ranges: levelRanges })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coefficients'] }); toast.success('kLVL коэффициенты сохранены'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const { data: clansForJoin } = useQuery({
    queryKey: ['clans-list'],
    queryFn: async () => (await api.get('/clans?limit=50')).data,
    enabled: !clanId,
  });

  const joinClanMutation = useMutation({
    mutationFn: async (targetClanId: string) => (await api.post(`/clans/${targetClanId}/join`, { message: joinMessage || undefined })).data,
    onSuccess: () => {
      toast.success('Заявка отправлена!');
      setJoinMessage('');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (!clanId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Найти клан</h1>
          <p className="mt-1 text-muted-foreground">Выберите клан и подайте заявку на вступление</p>
        </div>
        {clansForJoin?.data?.length ? (
          <div className="space-y-4">
            {clansForJoin.data.map((c: any) => (
              <Card key={c.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="gold" className="text-xs">[{c.tag}]</Badge>
                      <h3 className="font-semibold text-lg">{c.name}</h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{c.description || 'Нет описания'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{c._count?.memberships || 0} участников</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Сообщение (опц.)"
                      className="w-48 text-xs"
                      value={joinMessage}
                      onChange={(e) => setJoinMessage(e.target.value)}
                    />
                    <Button variant="gold" size="sm" onClick={() => joinClanMutation.mutate(c.id)} disabled={joinClanMutation.isPending}>
                      <UserPlus className="h-4 w-4" /> Подать заявку
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-16">
            <Users className="h-16 w-16 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">Нет доступных кланов</p>
          </div>
        )}
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    if (role === 'CLAN_LEADER') return <Crown className="h-4 w-4 text-gold-400" />;
    if (role === 'ELDER') return <Star className="h-4 w-4 text-blue-400" />;
    if (role === 'MEMBER') return <Shield className="h-4 w-4 text-green-400" />;
    return <UserPlus className="h-4 w-4 text-gray-400" />;
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'CLAN_LEADER') return 'gold' as const;
    if (role === 'ELDER') return 'rare' as const;
    if (role === 'MEMBER') return 'uncommon' as const;
    return 'common' as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{clan?.name || <Skeleton className="h-9 w-48" />}</h1>
          <p className="mt-1 text-muted-foreground">{clan?.description || 'Загрузка...'}</p>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <Link to="/clan/report">
              <Button variant="outline" size="sm">
                <BarChart3 className="h-4 w-4" /> Отчёт
              </Button>
            </Link>
          )}
          <Badge variant="gold" className="text-base px-4 py-1">
            [{clan?.tag}]
          </Badge>
        </div>
      </div>

      {canManage && joinRequests?.data?.length > 0 && (
        <Card className="border-yellow-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5 text-yellow-400" />
              Заявки на вступление ({joinRequests.data.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {joinRequests.data.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <div>
                    <p className="font-medium">{req.user?.profile?.nickname}</p>
                    <p className="text-xs text-muted-foreground">{req.message || 'Без сообщения'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-400 border-green-500/30 hover:bg-green-500/10" onClick={() => reviewMutation.mutate({ requestId: req.id, approved: true })}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => reviewMutation.mutate({ requestId: req.id, approved: false })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Участники ({members?.meta?.total || clan?._count?.memberships || 0})
          </CardTitle>
          <input
            type="text"
            placeholder="Поиск участников..."
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (<Skeleton key={i} className="h-16" />))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Игрок</th>
                    <th className="pb-3 font-medium">Роль</th>
                    <th className="pb-3 font-medium text-right">БМ</th>
                    <th className="pb-3 font-medium text-right">Уровень</th>
                    <th className="pb-3 font-medium text-right">DKP</th>
                    {canManage && <th className="pb-3 font-medium text-right">Действия</th>}
                  </tr>
                </thead>
                <tbody>
                  {(members?.data || clan?.memberships)?.map((m: any) => {
                    const member = m.user || m;
                    const profile = member.profile;
                    const wallet = member.dkpWallet;
                    const role = m.role;
                    return (
                      <tr key={m.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                        <td className="py-3">
                          <Link to={`/users/${member.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                              {profile?.nickname?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-medium hover:text-primary transition-colors">{profile?.nickname}</p>
                              <p className="text-xs text-muted-foreground">{profile?.displayName}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="py-3">
                          <Badge variant={getRoleBadgeVariant(role)} className="gap-1">
                            {getRoleIcon(role)}
                            {getRoleLabel(role)}
                          </Badge>
                        </td>
                        <td className="py-3 text-right font-mono">{profile?.bm?.toLocaleString() || '—'}</td>
                        <td className="py-3 text-right font-mono">{profile?.level || '—'}</td>
                        <td className="py-3 text-right font-mono text-gold-400">{wallet ? formatDkp(wallet.balance) : '—'}</td>
                        {canManage && (
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {role !== 'CLAN_LEADER' && (
                                <>
                                  {isLeader && (
                                    <div className="relative">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                        onClick={() => setRoleChangeTarget(roleChangeTarget === member.id ? null : member.id)}
                                        title="Изменить роль"
                                      >
                                        <ChevronDown className="h-4 w-4" />
                                      </Button>
                                      {roleChangeTarget === member.id && (
                                        <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-border bg-popover p-1 shadow-lg">
                                          {['ELDER', 'MEMBER', 'NEWBIE'].filter(r => r !== role).map((r) => (
                                            <button
                                              key={r}
                                              className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                                              onClick={() => changeRoleMutation.mutate({ userId: member.id, role: r })}
                                            >
                                              {getRoleLabel(r)}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                                    onClick={() => setPenaltyTarget(penaltyTarget === member.id ? null : member.id)}
                                    title="Штраф DKP"
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    onClick={() => { if (confirm('Исключить участника?')) kickMutation.mutate(member.id); }}
                                    title="Исключить"
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                            {penaltyTarget === member.id && (
                              <div className="mt-2 flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2">
                                <Input
                                  type="number"
                                  placeholder="DKP"
                                  className="w-20 h-7 text-xs"
                                  value={penaltyForm.amount}
                                  onChange={(e) => setPenaltyForm({ ...penaltyForm, amount: e.target.value })}
                                />
                                <Input
                                  placeholder="Причина..."
                                  className="flex-1 h-7 text-xs"
                                  value={penaltyForm.reason}
                                  onChange={(e) => setPenaltyForm({ ...penaltyForm, reason: e.target.value })}
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  disabled={!penaltyForm.amount || !penaltyForm.reason || penaltyMutation.isPending}
                                  onClick={() => penaltyMutation.mutate()}
                                >
                                  Штраф
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {isLeader && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5" />
              DKP Формула: (kLVL × kBM) + BaseDKP
            </CardTitle>
            <p className="text-xs text-muted-foreground">Настройте коэффициенты грейдов для расчёта DKP наград после активностей</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">kBM — Коэффициент боевой мощи</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPowerRanges([...powerRanges, { fromPower: 0, toPower: 0, coefficient: 1 }])}>
                    <Plus className="h-3 w-3" /> Диапазон
                  </Button>
                  <Button variant="gold" size="sm" className="h-7 text-xs" onClick={() => savePowerMutation.mutate()} disabled={savePowerMutation.isPending}>
                    <Save className="h-3 w-3" /> Сохранить
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {powerRanges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-8">От</span>
                    <Input className="h-7 w-28 text-xs" type="number" value={r.fromPower} onChange={(e) => { const nr = [...powerRanges]; nr[i] = { ...nr[i], fromPower: Number(e.target.value) }; setPowerRanges(nr); }} />
                    <span className="text-muted-foreground w-8">До</span>
                    <Input className="h-7 w-28 text-xs" type="number" value={r.toPower} onChange={(e) => { const nr = [...powerRanges]; nr[i] = { ...nr[i], toPower: Number(e.target.value) }; setPowerRanges(nr); }} />
                    <span className="text-muted-foreground w-16">Коэфф.</span>
                    <Input className="h-7 w-20 text-xs" type="number" step="0.01" value={r.coefficient} onChange={(e) => { const nr = [...powerRanges]; nr[i] = { ...nr[i], coefficient: Number(e.target.value) }; setPowerRanges(nr); }} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setPowerRanges(powerRanges.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                {!powerRanges.length && <p className="text-xs text-muted-foreground">Нет диапазонов — kBM = 1 (по умолчанию)</p>}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">kLVL — Коэффициент уровня</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setLevelRanges([...levelRanges, { fromLevel: 0, toLevel: 0, coefficient: 1 }])}>
                    <Plus className="h-3 w-3" /> Диапазон
                  </Button>
                  <Button variant="gold" size="sm" className="h-7 text-xs" onClick={() => saveLevelMutation.mutate()} disabled={saveLevelMutation.isPending}>
                    <Save className="h-3 w-3" /> Сохранить
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {levelRanges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-8">От</span>
                    <Input className="h-7 w-28 text-xs" type="number" value={r.fromLevel} onChange={(e) => { const nr = [...levelRanges]; nr[i] = { ...nr[i], fromLevel: Number(e.target.value) }; setLevelRanges(nr); }} />
                    <span className="text-muted-foreground w-8">До</span>
                    <Input className="h-7 w-28 text-xs" type="number" value={r.toLevel} onChange={(e) => { const nr = [...levelRanges]; nr[i] = { ...nr[i], toLevel: Number(e.target.value) }; setLevelRanges(nr); }} />
                    <span className="text-muted-foreground w-16">Коэфф.</span>
                    <Input className="h-7 w-20 text-xs" type="number" step="0.01" value={r.coefficient} onChange={(e) => { const nr = [...levelRanges]; nr[i] = { ...nr[i], coefficient: Number(e.target.value) }; setLevelRanges(nr); }} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setLevelRanges(levelRanges.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                {!levelRanges.length && <p className="text-xs text-muted-foreground">Нет диапазонов — kLVL = 1 (по умолчанию)</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
