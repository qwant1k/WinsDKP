import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, Send, UserPlus, Shield, Clock, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export function JoinClanPage() {
  const { user, fetchMe } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [selectedClan, setSelectedClan] = useState<string | null>(null);

  const { data: clansData, isLoading } = useQuery({
    queryKey: ['clans-list', search],
    queryFn: async () => (await api.get('/clans', { params: { search: search || undefined, limit: 20 } })).data,
  });

  const { data: myRequests } = useQuery({
    queryKey: ['my-join-requests'],
    queryFn: async () => {
      try {
        return (await api.get('/clans/my-requests')).data;
      } catch {
        return [];
      }
    },
  });

  const joinMutation = useMutation({
    mutationFn: async ({ clanId, message }: { clanId: string; message?: string }) =>
      (await api.post(`/clans/${clanId}/join`, { message })).data,
    onSuccess: () => {
      toast.success('Заявка отправлена!');
      setSelectedClan(null);
      setJoinMessage('');
      queryClient.invalidateQueries({ queryKey: ['my-join-requests'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const clans = clansData?.data || clansData || [];
  const pendingClanIds = new Set(
    (Array.isArray(myRequests) ? myRequests : myRequests?.data || [])
      .filter((r: any) => r.status === 'PENDING')
      .map((r: any) => r.clanId),
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/20">
            <Shield className="h-8 w-8 text-black" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-gold">Добро пожаловать, {user?.profile?.nickname || 'Воин'}!</h1>
          <p className="mt-2 text-muted-foreground">Для начала работы вступите в клан. Выберите клан и отправьте заявку.</p>
        </div>

        <div className="flex gap-3">
          <Link to="/profile">
            <Button variant="outline" size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Редактировать профиль
            </Button>
          </Link>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Доступные кланы
            </CardTitle>
            <CardDescription>Выберите клан для вступления</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск клана..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : clans.length > 0 ? (
              <div className="space-y-3">
                {clans.map((clan: any) => {
                  const isPending = pendingClanIds.has(clan.id);
                  const isSelected = selectedClan === clan.id;
                  return (
                    <div key={clan.id}>
                      <Card
                        className={`cursor-pointer transition-all ${isSelected ? 'border-primary ring-1 ring-primary/30' : 'hover:border-primary/20'}`}
                        onClick={() => !isPending && setSelectedClan(isSelected ? null : clan.id)}
                      >
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                              <Shield className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{clan.name}</h3>
                                <Badge variant="outline" className="text-[10px]">[{clan.tag}]</Badge>
                              </div>
                              {clan.description && (
                                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{clan.description}</p>
                              )}
                              <p className="mt-1 text-xs text-muted-foreground">
                                <Users className="inline h-3 w-3 mr-1" />
                                {clan._count?.memberships ?? '?'} участников
                              </p>
                            </div>
                          </div>
                          {isPending ? (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" />
                              Заявка на рассмотрении
                            </Badge>
                          ) : (
                            <Button
                              variant={isSelected ? 'gold' : 'outline'}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClan(isSelected ? null : clan.id);
                              }}
                            >
                              <Send className="mr-1 h-3 w-3" />
                              Вступить
                            </Button>
                          )}
                        </CardContent>
                      </Card>

                      {isSelected && (
                        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                          <Input
                            placeholder="Сообщение для главы клана (необязательно)..."
                            value={joinMessage}
                            onChange={(e) => setJoinMessage(e.target.value)}
                          />
                          <Button
                            variant="gold"
                            className="w-full"
                            disabled={joinMutation.isPending}
                            onClick={() => joinMutation.mutate({ clanId: clan.id, message: joinMessage || undefined })}
                          >
                            {joinMutation.isPending ? 'Отправка...' : 'Отправить заявку'}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 opacity-30" />
                <p className="mt-3">Кланы не найдены</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
