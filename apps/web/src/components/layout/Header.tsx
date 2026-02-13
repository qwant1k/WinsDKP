import { Bell, Search, CheckCheck, Coins, Trophy, Swords, Users, Dices, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth.store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Link, useNavigate } from 'react-router-dom';
import { formatDkp, getRoleLabel, formatTimeAgo } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

const notifIcons: Record<string, React.ElementType> = {
  DKP_RECEIVED: Coins, DKP_PENALTY: Coins, AUCTION_OUTBID: Trophy,
  AUCTION_WON: Trophy, AUCTION_STARTED: Trophy, RANDOMIZER_WON: Dices,
  RANDOMIZER_STARTED: Dices, ACTIVITY_CREATED: Swords, ACTIVITY_STARTED: Swords,
  ACTIVITY_COMPLETED: Swords, CLAN_JOIN_REQUEST: Users, CLAN_JOIN_APPROVED: Users,
  NEWS_POSTED: Newspaper, MESSAGE_RECEIVED: Bell, SYSTEM: Bell,
};

function getNotifLink(n: any): string | null {
  const data = n.data || {};
  switch (n.type) {
    case 'AUCTION_OUTBID': case 'AUCTION_WON': case 'AUCTION_LOST': case 'AUCTION_STARTED':
      return data.auctionId ? `/auctions/${data.auctionId}` : '/auctions';
    case 'RANDOMIZER_WON': case 'RANDOMIZER_STARTED': return '/randomizer';
    case 'DKP_RECEIVED': case 'DKP_PENALTY': return data.activityId ? '/activities' : '/dkp';
    case 'ACTIVITY_CREATED': case 'ACTIVITY_STARTED': case 'ACTIVITY_COMPLETED': return '/activities';
    case 'CLAN_JOIN_REQUEST': case 'CLAN_JOIN_APPROVED': case 'CLAN_JOIN_REJECTED':
    case 'CLAN_ROLE_CHANGED': case 'CLAN_KICKED': return '/clan';
    case 'NEWS_POSTED': return '/news';
    case 'MESSAGE_RECEIVED': return data.senderId ? `/messages/${data.senderId}` : '/messages';
    default: return null;
  }
}

export function Header() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return data as { count: number };
    },
    refetchInterval: 30000,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'dropdown'],
    queryFn: async () => (await api.get('/notifications?limit=20')).data,
    enabled: showNotifs,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/notifications/${id}/read`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => (await api.patch('/notifications/read-all')).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = unreadData?.count ?? 0;
  const clanRole = user?.clanMembership?.role;
  const wallet = user?.dkpWallet;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            className="w-[280px] bg-background pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
                navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                setSearchQuery('');
              }
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {wallet && (
          <Link to="/dkp" className="hidden items-center gap-2 rounded-lg border border-gold-500/20 bg-gold-500/5 px-3 py-1.5 sm:flex">
            <span className="text-xs text-muted-foreground">DKP:</span>
            <span className="text-sm font-bold text-gold-400">{formatDkp(wallet.balance)}</span>
          </Link>
        )}

        {clanRole && (
          <Badge variant="outline" className="hidden sm:inline-flex">
            {user?.clanMembership?.clan?.tag} · {getRoleLabel(clanRole)}
          </Badge>
        )}

        <div className="relative" ref={notifRef}>
          <Button variant="ghost" size="icon" className="relative" onClick={() => setShowNotifs(!showNotifs)}>
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>

          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-[380px] rounded-2xl border border-border bg-card shadow-2xl shadow-black/40 z-50">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Уведомления</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllReadMutation.mutate()}>
                      <CheckCheck className="h-3 w-3 mr-1" /> Все
                    </Button>
                  )}
                  <Link to="/notifications" onClick={() => setShowNotifs(false)}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">Все →</Button>
                  </Link>
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                {notifData?.data?.length ? (
                  notifData.data.map((n: any) => {
                    const Icon = notifIcons[n.type] || Bell;
                    return (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-border/30 cursor-pointer hover:bg-accent/30 transition-colors ${!n.isRead ? 'bg-primary/5' : ''}`}
                        onClick={() => {
                          if (!n.isRead) markReadMutation.mutate(n.id);
                          const link = getNotifLink(n);
                          if (link) { navigate(link); setShowNotifs(false); }
                        }}
                      >
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${!n.isRead ? 'bg-primary/20' : 'bg-secondary'}`}>
                          <Icon className={`h-4 w-4 ${!n.isRead ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-tight ${!n.isRead ? 'font-semibold' : ''}`}>{n.title}</p>
                          {n.body && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{n.body}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">{formatTimeAgo(n.createdAt)}</p>
                        </div>
                        {!n.isRead && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">Нет уведомлений</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
