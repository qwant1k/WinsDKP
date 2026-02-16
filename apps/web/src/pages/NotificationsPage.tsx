import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimeAgo } from '@/lib/utils';
import { Bell, BellOff, CheckCheck, Trophy, Coins, Swords, Users, Dices, Newspaper, ExternalLink, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const typeIcons: Record<string, React.ElementType> = {
  DKP_RECEIVED: Coins, DKP_PENALTY: Coins, AUCTION_OUTBID: Trophy,
  AUCTION_WON: Trophy, AUCTION_LOST: Trophy, AUCTION_STARTED: Trophy,
  RANDOMIZER_WON: Dices, RANDOMIZER_STARTED: Dices,
  ACTIVITY_CREATED: Swords, ACTIVITY_STARTED: Swords, ACTIVITY_COMPLETED: Swords,
  CLAN_JOIN_REQUEST: Users, CLAN_JOIN_APPROVED: Users, CLAN_JOIN_REJECTED: Users,
  CLAN_ROLE_CHANGED: Users, CLAN_KICKED: Users,
  NEWS_POSTED: Newspaper, COMMENT_REPLY: Newspaper, MESSAGE_RECEIVED: MessageSquare,
  SYSTEM: Bell,
};

function getNotificationLink(notif: any): string | null {
  const data = notif.data || {};
  switch (notif.type) {
    case 'AUCTION_OUTBID':
    case 'AUCTION_WON':
    case 'AUCTION_LOST':
    case 'AUCTION_STARTED':
      return data.auctionId ? `/auctions/${data.auctionId}` : '/auctions';
    case 'RANDOMIZER_WON':
    case 'RANDOMIZER_STARTED':
      return '/randomizer';
    case 'DKP_RECEIVED':
    case 'DKP_PENALTY':
      return '/dkp';
    case 'ACTIVITY_CREATED':
    case 'ACTIVITY_STARTED':
    case 'ACTIVITY_COMPLETED':
      return '/activities';
    case 'CLAN_JOIN_REQUEST':
    case 'CLAN_JOIN_APPROVED':
    case 'CLAN_JOIN_REJECTED':
    case 'CLAN_ROLE_CHANGED':
    case 'CLAN_KICKED':
      return '/clan';
    case 'NEWS_POSTED':
      return '/news';
    case 'COMMENT_REPLY':
      return data.newsPostId ? '/news' : data.feedPostId ? '/feed' : null;
    case 'MESSAGE_RECEIVED':
      return data.senderId ? `/messages/${data.senderId}` : '/messages';
    default:
      return null;
  }
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page],
    queryFn: async () => (await api.get('/notifications', { params: { page, limit: 30 } })).data,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/notifications/${id}/read`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => (await api.patch('/notifications/read-all')).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleNotificationClick = (notif: any) => {
    if (!notif.isRead) markReadMutation.mutate(notif.id);
    const link = getNotificationLink(notif);
    if (link) navigate(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold">Уведомления</h1>
          <p className="mt-1 text-muted-foreground">
            {data?.unreadCount ? `${data.unreadCount} непрочитанных` : 'Все прочитано'}
          </p>
        </div>
        {data?.unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
            <CheckCheck className="h-4 w-4" /> Прочитать все
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : data?.data?.length ? (
        <div className="space-y-2">
          {data.data.map((notif: any, i: number) => {
            const Icon = typeIcons[notif.type] || Bell;
            const link = getNotificationLink(notif);
            return (
              <motion.div key={notif.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                <Card
                  className={`cursor-pointer transition-all hover:border-primary/20 ${!notif.isRead ? 'border-l-2 border-l-primary bg-primary/5' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${!notif.isRead ? 'bg-primary/20' : 'bg-secondary'}`}>
                      <Icon className={`h-5 w-5 ${!notif.isRead ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.isRead ? 'font-semibold' : 'font-medium'}`}>{notif.title}</p>
                      {notif.body && <p className="text-xs text-muted-foreground mt-0.5 truncate">{notif.body}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(notif.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {data.meta?.totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
              <span className="text-sm text-muted-foreground py-2">{page} / {data.meta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Далее</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <BellOff className="h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">Нет уведомлений</p>
        </div>
      )}
    </div>
  );
}
