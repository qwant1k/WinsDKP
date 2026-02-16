import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, getStatusLabel, getStatusColor } from '@/lib/utils';
import { Swords, Plus, Play, Square, CheckCircle, Users, Clock, ChevronDown, ChevronUp, Pencil, XCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/lib/socket';

export function ActivitiesPage() {
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;
  const canManage = user?.clanMembership?.role === 'CLAN_LEADER' || user?.clanMembership?.role === 'ELDER';
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'RAID', baseDkp: '100', description: '' });
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [editingDkp, setEditingDkp] = useState<string | null>(null);
  const [editDkpValue, setEditDkpValue] = useState('');

  const { data: activityDetail } = useQuery({
    queryKey: ['activity-detail', expandedActivity],
    queryFn: async () => (await api.get(`/clans/${clanId}/activities/${expandedActivity}`)).data,
    enabled: !!expandedActivity && !!clanId,
  });

  // Real-time: listen for new participants joining activities in this clan
  useEffect(() => {
    const socket = getSocket();
    const handler = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['activities', clanId], exact: true });
      queryClient.invalidateQueries({ queryKey: ['activity-detail', data.activityId], exact: true });
    };
    socket.on('activity.participant_joined', handler);
    return () => { socket.off('activity.participant_joined', handler); };
  }, [queryClient, clanId]);

  const canJoin = ['CLAN_LEADER', 'ELDER', 'MEMBER', 'NEWBIE'].includes(user?.clanMembership?.role || '');

  const { data, isLoading } = useQuery({
    queryKey: ['activities', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/activities?limit=50`)).data,
    enabled: !!clanId,
  });

  const refetchActivities = async () => {
    await queryClient.refetchQueries({ queryKey: ['activities', clanId], exact: true });
  };

  const createMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/activities`, { ...form, baseDkp: Number(form.baseDkp) })).data,
    onSuccess: async () => { await refetchActivities(); setShowCreate(false); toast.success('Активность создана'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => (await api.patch(`/clans/${clanId}/activities/${id}/status`, { status })).data,
    onSuccess: async () => {
      await refetchActivities();
      toast.success('Статус обновлён');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const joinMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/clans/${clanId}/activities/${id}/join`)).data,
    onSuccess: async () => { await refetchActivities(); toast.success('Вы присоединились'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/clans/${clanId}/activities/${id}/complete`)).data,
    onSuccess: async () => {
      await refetchActivities();
      toast.success('Активность завершена, DKP начислены');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/clans/${clanId}/activities/${id}/status`, { status: 'CANCELLED' })).data,
    onSuccess: async () => {
      await refetchActivities();
      toast.success('Активность отменена');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateDkpMutation = useMutation({
    mutationFn: async ({ id, baseDkp }: { id: string; baseDkp: number }) => (await api.patch(`/clans/${clanId}/activities/${id}`, { baseDkp })).data,
    onSuccess: async () => {
      await refetchActivities();
      await queryClient.refetchQueries({ queryKey: ['activity-detail', expandedActivity], exact: true });
      setEditingDkp(null);
      toast.success('BaseDKP обновлен');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold">Активности клана</h1>
          <p className="mt-1 text-sm text-muted-foreground hidden sm:block">Рейды, экспедиции и другие активности</p>
        </div>
        {canManage && (
          <Button variant="gold" size="sm" className="shrink-0" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Создать</span>
          </Button>
        )}
      </div>

      {showCreate && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-lg">Новая активность</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Название</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Рейд: Логово Дракона" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Тип</label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="RAID">Рейд</option>
                  <option value="EXPEDITION">Экспедиция</option>
                  <option value="DUNGEON">Данж</option>
                  <option value="PVP">PvP</option>
                  <option value="GUILD_WAR">Гильд-вар</option>
                  <option value="WORLD_BOSS">Мировой босс</option>
                  <option value="OTHER">Другое</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Базовый DKP</label>
                <Input type="number" value={form.baseDkp} onChange={(e) => setForm({ ...form, baseDkp: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Описание</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Описание активности..." />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="gold" onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending}>Создать</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : data?.data?.length ? (
        <div className="space-y-4">
          {(Array.isArray(data.data) ? [...new Map(data.data.map((a: any) => [a.id, a])).values()] : []).map((activity: any) => (
            <Card key={activity.id} className="hover:border-primary/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)}>
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Swords className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{activity.title}</h3>
                        <Badge variant="outline" className={getStatusColor(activity.status)}>{getStatusLabel(activity.status)}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{activity._count?.participants || 0}</span>
                        <span>DKP: {activity.baseDkp}</span>
                        <span>{activity.type}</span>
                        {activity.startAt && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(activity.startAt)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pl-13 sm:pl-0">
                    {canJoin && (activity.status === 'OPEN' || activity.status === 'IN_PROGRESS') && (
                      <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm" onClick={() => joinMutation.mutate(activity.id)}>Участвовать</Button>
                    )}
                    {canManage && activity.status === 'DRAFT' && (
                      <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm" onClick={() => statusMutation.mutate({ id: activity.id, status: 'OPEN' })}>
                        <Play className="h-3 w-3" /> Открыть
                      </Button>
                    )}
                    {canManage && activity.status === 'OPEN' && (
                      <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm" onClick={() => statusMutation.mutate({ id: activity.id, status: 'IN_PROGRESS' })}>
                        <Play className="h-3 w-3" /> Начать
                      </Button>
                    )}
                    {canManage && activity.status === 'IN_PROGRESS' && (
                      <Button variant="gold" size="sm" className="h-8 text-xs sm:text-sm" onClick={() => completeMutation.mutate(activity.id)}>
                        <CheckCircle className="h-3 w-3" /> Завершить
                      </Button>
                    )}
                    {canManage && activity.status !== 'COMPLETED' && activity.status !== 'CANCELLED' && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs sm:text-sm text-red-400 hover:text-red-300" onClick={() => { if (confirm('Отменить активность?')) cancelMutation.mutate(activity.id); }}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)}>
                      {expandedActivity === activity.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedActivity === activity.id && activityDetail && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 border-t border-border/50 pt-4">
                      {activityDetail.description && <p className="text-sm text-muted-foreground mb-3">{activityDetail.description}</p>}
                      <h4 className="text-sm font-medium mb-2">Участники ({activityDetail.participants?.length || 0})</h4>
                      <div className="flex flex-wrap gap-2">
                        {activityDetail.participants?.length ? activityDetail.participants.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-1.5 text-xs">
                            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                              {p.user?.profile?.nickname?.charAt(0)?.toUpperCase()}
                            </div>
                            <span>{p.user?.profile?.nickname}</span>
                          </div>
                        )) : <span className="text-xs text-muted-foreground">Нет участников</span>}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">Формула: (kLVL × kBM) + {activityDetail.baseDkp} BaseDKP</p>
                        {canManage && activity.status !== 'COMPLETED' && activity.status !== 'CANCELLED' && (
                          editingDkp === activity.id ? (
                            <div className="flex items-center gap-1">
                              <Input type="number" className="h-6 w-20 text-xs" value={editDkpValue} onChange={(e) => setEditDkpValue(e.target.value)} />
                              <Button variant="gold" size="sm" className="h-6 px-2 text-xs" onClick={() => updateDkpMutation.mutate({ id: activity.id, baseDkp: Number(editDkpValue) })} disabled={updateDkpMutation.isPending}>
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setEditingDkp(null)}>✕</Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setEditingDkp(activity.id); setEditDkpValue(String(activityDetail.baseDkp)); }}>
                              <Pencil className="h-3 w-3" /> Изменить
                            </Button>
                          )
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <Swords className="h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">Нет активностей</p>
        </div>
      )}
    </div>
  );
}
