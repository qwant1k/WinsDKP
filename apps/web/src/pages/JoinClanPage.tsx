import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { useNavigate } from 'react-router-dom';

type ClanListItem = {
  id: string;
  name: string;
  tag: string;
  description?: string | null;
};

export function JoinClanPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [joinMessage, setJoinMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['clans-list-for-join'],
    queryFn: async () => (await api.get('/clans', { params: { limit: 1 } })).data,
  });

  const clan: ClanListItem | null = useMemo(() => {
    const list = data?.data || data || [];
    return Array.isArray(list) && list.length > 0 ? list[0] : null;
  }, [data]);

  const joinMutation = useMutation({
    mutationFn: async (payload: { clanId: string; message?: string }) =>
      (await api.post(`/clans/${payload.clanId}/join`, { message: payload.message })).data,
    onSuccess: () => {
      toast.success('Заявка на вступление отправлена');
      queryClient.invalidateQueries({ queryKey: ['my-join-requests'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-14 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!clan) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Клан не найден</CardTitle>
            <CardDescription>Обратитесь к администратору, чтобы создать клан для вступления.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <Card className="w-full max-w-2xl border-primary/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Вступление в клан</CardTitle>
          <CardDescription>Для доступа к системе отправьте заявку на вступление</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground">Клан</p>
            <p className="mt-1 text-2xl font-bold">
              {clan.name} <span className="text-base text-muted-foreground">[{clan.tag}]</span>
            </p>
            {clan.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{clan.description}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="join-message" className="text-sm font-medium">
              Сообщение для вступления
            </label>
            <textarea
              id="join-message"
              className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Напишите короткое сообщение лидеру клана..."
              value={joinMessage}
              onChange={(e) => setJoinMessage(e.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="gold"
            className="h-14 w-full animate-pulse text-lg font-semibold"
            disabled={joinMutation.isPending}
            onClick={() => joinMutation.mutate({ clanId: clan.id, message: joinMessage || undefined })}
          >
            {joinMutation.isPending ? 'Отправка...' : 'Вступить'}
          </Button>
        </CardContent>
      </Card>

      <div className="fixed bottom-4 right-4 flex flex-col gap-2">
        <Button type="button" variant="outline" onClick={() => navigate('/profile')}>
          Личный профиль
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          Выйти
        </Button>
      </div>
    </div>
  );
}
