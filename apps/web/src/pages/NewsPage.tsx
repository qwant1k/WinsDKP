import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimeAgo } from '@/lib/utils';
import { Newspaper, Plus, Pin, MessageSquare, Heart, Send, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { motion } from 'framer-motion';

export function NewsPage() {
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;
  const canManage = user?.clanMembership?.role === 'CLAN_LEADER' || user?.clanMembership?.role === 'ELDER';
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', isPinned: false });
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', content: '', isPinned: false });
  const isAdmin = user?.globalRole === 'PORTAL_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['news', clanId],
    queryFn: async () => (await api.get(`/clans/${clanId}/news?limit=50`)).data,
    enabled: !!clanId,
  });

  const { data: postDetail } = useQuery({
    queryKey: ['news-detail', expandedPost],
    queryFn: async () => (await api.get(`/clans/${clanId}/news/${expandedPost}`)).data,
    enabled: !!expandedPost && !!clanId,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/news`, form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
      setShowCreate(false);
      setForm({ title: '', content: '', isPinned: false });
      toast.success('Новость опубликована');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const commentMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/news/${expandedPost}/comments`, { content: commentText })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-detail', expandedPost] });
      setCommentText('');
      toast.success('Комментарий добавлен');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const editMutation = useMutation({
    mutationFn: async () => (await api.patch(`/clans/${clanId}/news/${editingPost}`, editForm)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
      setEditingPost(null);
      toast.success('Новость обновлена');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const startEditPost = (post: any) => {
    setEditingPost(post.id);
    setEditForm({ title: post.title, content: post.content, isPinned: post.isPinned });
  };

  const reactMutation = useMutation({
    mutationFn: async (postId: string) => (await api.post(`/clans/${clanId}/news/${postId}/reactions`, { emoji: '👍' })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
      queryClient.invalidateQueries({ queryKey: ['news-detail'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Новости клана</h1>
          <p className="mt-1 text-muted-foreground">Важные объявления и события</p>
        </div>
        {canManage && (
          <Button variant="gold" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" /> Публикация
          </Button>
        )}
      </div>

      {showCreate && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-lg">Новая публикация</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Заголовок" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Содержание (поддерживается Markdown)..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} className="rounded" />
                Закрепить
              </label>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
              <Button variant="gold" disabled={!form.title || !form.content || createMutation.isPending} onClick={() => createMutation.mutate()}>Опубликовать</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : data?.data?.length ? (
        <div className="space-y-4">
          {data.data.map((post: any, i: number) => (
            <motion.div key={post.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:border-primary/20 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                      {post.author?.profile?.nickname?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {post.isPinned && <Pin className="h-3 w-3 text-gold-400" />}
                          <h3 className="font-semibold text-lg">{post.title}</h3>
                        </div>
                        {(post.authorId === user?.id || isAdmin) && editingPost !== post.id && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-primary" onClick={() => startEditPost(post)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {post.author?.profile?.nickname} · {formatTimeAgo(post.createdAt)}
                      </p>

                      {editingPost === post.id ? (
                        <div className="mt-3 space-y-3">
                          <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Заголовок" />
                          <textarea
                            className="w-full min-h-[100px] rounded-xl border border-input bg-background px-3 py-2 text-sm"
                            value={editForm.content}
                            onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                          />
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs">
                              <input type="checkbox" checked={editForm.isPinned} onChange={(e) => setEditForm({ ...editForm, isPinned: e.target.checked })} className="rounded" />
                              Закрепить
                            </label>
                            <div className="flex-1" />
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingPost(null)}><X className="h-3 w-3" /> Отмена</Button>
                            <Button size="sm" variant="gold" className="h-7 text-xs" onClick={() => editMutation.mutate()} disabled={editMutation.isPending}><Save className="h-3 w-3" /> Сохранить</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap line-clamp-4">{post.content}</div>
                      )}
                      <div className="mt-3 flex items-center gap-4">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => reactMutation.mutate(post.id)}>
                          <Heart className="h-3 w-3" /> {post._count?.reactions || 0}
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}>
                          <MessageSquare className="h-3 w-3" /> {post._count?.comments || 0}
                        </Button>
                      </div>

                      {expandedPost === post.id && postDetail && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 space-y-3 border-t border-border/50 pt-4">
                          {postDetail.comments?.map((comment: any) => (
                            <div key={comment.id} className="flex gap-2 text-sm">
                              <div className="h-6 w-6 shrink-0 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                                {comment.author?.profile?.nickname?.charAt(0)?.toUpperCase()}
                              </div>
                              <div>
                                <span className="font-medium text-xs">{comment.author?.profile?.nickname}</span>
                                <p className="text-xs text-muted-foreground">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Input placeholder="Комментарий..." className="text-xs h-8" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim()) commentMutation.mutate(); }} />
                            <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => commentMutation.mutate()} disabled={!commentText.trim()}>
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
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <Newspaper className="h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">Нет новостей</p>
        </div>
      )}
    </div>
  );
}
