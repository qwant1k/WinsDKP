import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimeAgo } from '@/lib/utils';
import { MessageSquare, Heart, Send, Flag, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { motion } from 'framer-motion';

export function FeedPage() {
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState('');
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['feed', clanId, page],
    queryFn: async () => (await api.get(`/clans/${clanId}/feed`, { params: { page, limit: 20 } })).data,
    enabled: !!clanId,
  });

  const { data: postDetail } = useQuery({
    queryKey: ['feed-detail', expandedPost],
    queryFn: async () => (await api.get(`/clans/${clanId}/feed/${expandedPost}`)).data,
    enabled: !!expandedPost && !!clanId,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/feed`, { content: newPost })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      setNewPost('');
      toast.success('Пост опубликован');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const commentMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/feed/${expandedPost}/comments`, { content: commentText })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-detail', expandedPost] });
      setCommentText('');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const reactMutation = useMutation({
    mutationFn: async (postId: string) => (await api.post(`/clans/${clanId}/feed/${postId}/reactions`, { emoji: '👍' })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });

  const reportMutation = useMutation({
    mutationFn: async (postId: string) => (await api.post(`/clans/${clanId}/feed/${postId}/report`)).data,
    onSuccess: () => toast.success('Жалоба отправлена'),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Лента клана</h1>
        <p className="mt-1 text-muted-foreground">Общение и обсуждения участников</p>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-4">
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            placeholder="Что нового?"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <Button variant="gold" size="sm" disabled={!newPost.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
              <Send className="h-3 w-3" /> Опубликовать
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : data?.data?.length ? (
        <div className="space-y-4">
          {data.data.map((post: any, i: number) => (
            <motion.div key={post.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="hover:border-border transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                      {post.author?.profile?.nickname?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{post.author?.profile?.nickname}</span>
                        <span className="text-xs text-muted-foreground">{formatTimeAgo(post.createdAt)}</span>
                        {post.isReported && <AlertTriangle className="h-3 w-3 text-yellow-400" />}
                      </div>
                      <p className="mt-2 text-sm whitespace-pre-wrap">{post.content}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => reactMutation.mutate(post.id)}>
                          <Heart className="h-3 w-3" /> {post._count?.reactions || 0}
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}>
                          <MessageSquare className="h-3 w-3" /> {post._count?.comments || 0}
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 text-muted-foreground" onClick={() => reportMutation.mutate(post.id)}>
                          <Flag className="h-3 w-3" />
                        </Button>
                      </div>

                      {expandedPost === post.id && postDetail && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2 border-t border-border/50 pt-3">
                          {postDetail.comments?.map((c: any) => (
                            <div key={c.id} className="flex gap-2">
                              <div className="h-6 w-6 shrink-0 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                                {c.author?.profile?.nickname?.charAt(0)?.toUpperCase()}
                              </div>
                              <div>
                                <span className="font-medium text-xs">{c.author?.profile?.nickname}</span>
                                <p className="text-xs text-muted-foreground">{c.content}</p>
                              </div>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input placeholder="Ответить..." className="text-xs h-7" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim()) commentMutation.mutate(); }} />
                            <Button size="icon" className="h-7 w-7" onClick={() => commentMutation.mutate()} disabled={!commentText.trim()}>
                              <Send className="h-3 w-3" />
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {data.meta?.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
              <span className="text-sm text-muted-foreground py-2">{page} / {data.meta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Далее</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <MessageSquare className="h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">Лента пуста. Будьте первым!</p>
        </div>
      )}
    </div>
  );
}
