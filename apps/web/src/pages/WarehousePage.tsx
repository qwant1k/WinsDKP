import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDkp, getRarityClass, getRarityBgClass, getRarityLabel } from '@/lib/utils';
import { Package, Plus, Search, Trash2, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { motion } from 'framer-motion';

export function WarehousePage() {
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;
  const canManage = user?.clanMembership?.role === 'CLAN_LEADER' || user?.clanMembership?.role === 'ELDER';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', quantity: '1', rarity: 'COMMON', dkpPrice: '', source: '', description: '' });
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', quantity: '', rarity: '', dkpPrice: '', source: '', description: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse', clanId, search],
    queryFn: async () => (await api.get(`/clans/${clanId}/warehouse`, { params: { search: search || undefined, limit: 100 } })).data,
    enabled: !!clanId,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post(`/clans/${clanId}/warehouse`, {
      ...form,
      quantity: Number(form.quantity),
      dkpPrice: form.dkpPrice ? Number(form.dkpPrice) : undefined,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse'] });
      setShowCreate(false);
      setForm({ name: '', quantity: '1', rarity: 'COMMON', dkpPrice: '', source: '', description: '' });
      toast.success('Предмет добавлен');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/clans/${clanId}/warehouse/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse'] });
      toast.success('Предмет удалён');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const editMutation = useMutation({
    mutationFn: async () => (await api.patch(`/clans/${clanId}/warehouse/${editingItem}`, {
      name: editForm.name,
      quantity: Number(editForm.quantity),
      rarity: editForm.rarity,
      dkpPrice: editForm.dkpPrice ? Number(editForm.dkpPrice) : undefined,
      source: editForm.source || undefined,
      description: editForm.description || undefined,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse'] });
      setEditingItem(null);
      toast.success('Предмет обновлён');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const startEdit = (item: any) => {
    setEditingItem(item.id);
    setEditForm({
      name: item.name,
      quantity: String(item.quantity),
      rarity: item.rarity,
      dkpPrice: item.dkpPrice ? String(item.dkpPrice) : '',
      source: item.source || '',
      description: item.description || '',
    });
  };

  const rarityOrder: Record<string, number> = { MYTHIC: 0, LEGENDARY: 1, EPIC: 2, RARE: 3, UNCOMMON: 4, COMMON: 5 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Хранилище клана</h1>
          <p className="mt-1 text-muted-foreground">Справочник предметов и инвентарь</p>
        </div>
        {canManage && (
          <Button variant="gold" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" /> Добавить
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Поиск предметов..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {showCreate && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-lg">Новый предмет</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Название</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Меч Разрушителя" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Редкость</label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })}>
                  <option value="COMMON">Обычный</option>
                  <option value="UNCOMMON">Необычный</option>
                  <option value="RARE">Редкий</option>
                  <option value="EPIC">Эпический</option>
                  <option value="LEGENDARY">Легендарный</option>
                  <option value="MYTHIC">Мифический</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Кол-во</label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} min="1" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Цена DKP</label>
                <Input type="number" value={form.dkpPrice} onChange={(e) => setForm({ ...form, dkpPrice: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Источник</label>
                <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Рейд: Логово" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Описание</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Описание..." />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="gold" onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>Добавить</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : data?.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.data
            .sort((a: any, b: any) => (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99))
            .map((item: any, i: number) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className={`border ${getRarityBgClass(item.rarity)} hover:shadow-lg transition-all`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className={`font-semibold ${getRarityClass(item.rarity)}`}>{item.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={item.rarity.toLowerCase() as any} className="text-[10px]">{getRarityLabel(item.rarity)}</Badge>
                        <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => startEdit(item)} title="Редактировать">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => { if (confirm('Удалить предмет?')) deleteMutation.mutate(item.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {item.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    {item.dkpPrice && <span className="font-mono text-gold-400">{formatDkp(item.dkpPrice)} DKP</span>}
                    {item.source && <span className="text-muted-foreground">{item.source}</span>}
                  </div>
                  {editingItem === item.id && (
                    <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                      <div className="grid gap-2 grid-cols-2">
                        <Input className="h-7 text-xs" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Название" />
                        <Input className="h-7 text-xs" type="number" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} placeholder="Кол-во" />
                        <select className="h-7 rounded-md border border-input bg-background px-2 text-xs" value={editForm.rarity} onChange={(e) => setEditForm({ ...editForm, rarity: e.target.value })}>
                          <option value="COMMON">Обычный</option><option value="UNCOMMON">Необычный</option><option value="RARE">Редкий</option><option value="EPIC">Эпик</option><option value="LEGENDARY">Легендарный</option><option value="MYTHIC">Мифический</option>
                        </select>
                        <Input className="h-7 text-xs" type="number" value={editForm.dkpPrice} onChange={(e) => setEditForm({ ...editForm, dkpPrice: e.target.value })} placeholder="DKP цена" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="gold" className="h-7 text-xs" onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
                          <Save className="h-3 w-3" /> Сохранить
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingItem(null)}>
                          <X className="h-3 w-3" /> Отмена
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <Package className="h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">Хранилище пусто</p>
        </div>
      )}
    </div>
  );
}
