import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimeAgo } from '@/lib/utils';
import { MessageSquare, Send, ArrowLeft, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export function MessagesPage() {
  const { userId: threadUserId } = useParams<{ userId: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => (await api.get('/messages')).data,
    refetchInterval: 15000,
  });

  const { data: thread } = useQuery({
    queryKey: ['thread', threadUserId],
    queryFn: async () => (await api.get(`/messages/${threadUserId}?limit=100`)).data,
    enabled: !!threadUserId,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => (await api.post(`/messages/${threadUserId}`, { content: messageText })).data,
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['thread', threadUserId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.data]);

  if (threadUserId) {
    const otherUser = conversations?.find((c: any) => c.userId === threadUserId);
    return (
      <div className="flex flex-col h-[calc(100vh-7rem)]">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => navigate('/messages')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
              {otherUser?.nickname?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="font-semibold">{otherUser?.nickname || 'Загрузка...'}</h2>
              {otherUser?.displayName && <p className="text-xs text-muted-foreground">{otherUser.displayName}</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin py-4 space-y-3">
          {thread?.data?.map((msg: any) => {
            const isMine = msg.senderId === user?.id;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  isMine
                    ? 'bg-primary/20 text-foreground rounded-br-md'
                    : 'bg-secondary text-foreground rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-primary/60' : 'text-muted-foreground'}`}>
                    {formatTimeAgo(msg.createdAt)}
                  </p>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 pt-4 border-t border-border">
          <Input
            placeholder="Написать сообщение..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && messageText.trim()) sendMutation.mutate(); }}
            className="flex-1"
          />
          <Button variant="gold" disabled={!messageText.trim() || sendMutation.isPending} onClick={() => sendMutation.mutate()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Сообщения</h1>
        <p className="mt-1 text-muted-foreground">Личные сообщения между игроками</p>
      </div>

      {convsLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : conversations?.length ? (
        <div className="space-y-2">
          {conversations.map((conv: any) => (
            <motion.div key={conv.userId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <Card
                className={`cursor-pointer hover:border-primary/20 transition-all ${conv.unreadCount > 0 ? 'border-l-2 border-l-primary bg-primary/5' : ''}`}
                onClick={() => navigate(`/messages/${conv.userId}`)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                    {conv.nickname?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm ${conv.unreadCount > 0 ? 'font-bold' : 'font-medium'}`}>{conv.nickname}</p>
                      <span className="text-[10px] text-muted-foreground">{formatTimeAgo(conv.lastMessageAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {conv.unreadCount}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <MessageSquare className="h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">Нет сообщений</p>
          <p className="mt-1 text-xs text-muted-foreground">Перейдите в профиль игрока, чтобы начать переписку</p>
        </div>
      )}
    </div>
  );
}
