import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Save, Plus, Trash2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const clanId = user?.clanMembership?.clanId;
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [powerRanges, setPowerRanges] = useState<Array<{ fromPower: number; toPower: number; coefficient: number }>>([]);
  const [levelRanges, setLevelRanges] = useState<Array<{ fromLevel: number; toLevel: number; coefficient: number }>>([]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => (await api.get('/admin/settings')).data,
  });

  useEffect(() => {
    if (settings) {
      const values: Record<string, string> = {};
      for (const s of settings) {
        values[s.key] = JSON.stringify(s.value);
      }
      setEditValues(values);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) =>
      (await api.patch(`/admin/settings/${key}`, { value })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('Настройка обновлена');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleSave = (key: string) => {
    const raw = editValues[key];
    if (raw === undefined) return;
    try {
      const value = JSON.parse(raw);
      updateMutation.mutate({ key, value });
    } catch {
      toast.error('Невалидный JSON');
    }
  };

  const groupedSettings: Record<string, any[]> = {};
  if (settings) {
    for (const s of settings) {
      const group = s.group || 'general';
      if (!groupedSettings[group]) groupedSettings[group] = [];
      groupedSettings[group].push(s);
    }
  }

  const { data: coefficients } = useQuery({
    queryKey: ['admin', 'coefficients', clanId],
    queryFn: async () => (await api.get(`/admin/coefficients/${clanId}`)).data,
    enabled: !!clanId,
  });

  useEffect(() => {
    if (coefficients) {
      setPowerRanges(coefficients.powerRanges?.map((r: any) => ({ fromPower: r.fromPower, toPower: r.toPower, coefficient: Number(r.coefficient) })) || []);
      setLevelRanges(coefficients.levelRanges?.map((r: any) => ({ fromLevel: r.fromLevel, toLevel: r.toLevel, coefficient: Number(r.coefficient) })) || []);
    }
  }, [coefficients]);

  const savePowerMutation = useMutation({
    mutationFn: async () => (await api.patch(`/admin/coefficients/${clanId}/power`, { ranges: powerRanges })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'coefficients'] }); toast.success('kBM коэффициенты сохранены'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveLevelMutation = useMutation({
    mutationFn: async () => (await api.patch(`/admin/coefficients/${clanId}/level`, { ranges: levelRanges })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'coefficients'] }); toast.success('kLVL коэффициенты сохранены'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const groupLabels: Record<string, string> = {
    general: 'Общие',
    auction: 'Аукцион',
    randomizer: 'Рандомайзер',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Системные настройки</h1>
        <p className="mt-1 text-muted-foreground">Конфигурация параметров системы</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : (
        Object.entries(groupedSettings).map(([group, items]) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5" />
                {groupLabels[group] || group}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((setting: any) => (
                  <div key={setting.key} className="flex items-center gap-4">
                    <div className="min-w-[280px]">
                      <p className="text-sm font-medium font-mono">{setting.key}</p>
                      <p className="text-xs text-muted-foreground">Текущее: {JSON.stringify(setting.value)}</p>
                    </div>
                    <Input
                      className="flex-1 font-mono text-sm"
                      value={editValues[setting.key] || ''}
                      onChange={(e) => setEditValues({ ...editValues, [setting.key]: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSave(setting.key)}
                      disabled={updateMutation.isPending}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
      {clanId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5" />
              DKP Формула: (kLVL × kBM) + BaseDKP
            </CardTitle>
            <p className="text-xs text-muted-foreground">Настройте коэффициенты для расчёта DKP наград</p>
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
                    <Input className="h-7 w-24 text-xs" type="number" value={r.fromPower} onChange={(e) => { const nr = [...powerRanges]; nr[i].fromPower = Number(e.target.value); setPowerRanges(nr); }} />
                    <span className="text-muted-foreground w-8">До</span>
                    <Input className="h-7 w-24 text-xs" type="number" value={r.toPower} onChange={(e) => { const nr = [...powerRanges]; nr[i].toPower = Number(e.target.value); setPowerRanges(nr); }} />
                    <span className="text-muted-foreground w-16">Коэфф.</span>
                    <Input className="h-7 w-20 text-xs" type="number" step="0.01" value={r.coefficient} onChange={(e) => { const nr = [...powerRanges]; nr[i].coefficient = Number(e.target.value); setPowerRanges(nr); }} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setPowerRanges(powerRanges.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                {!powerRanges.length && <p className="text-xs text-muted-foreground">Нет диапазонов — kBM = 0</p>}
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
                    <Input className="h-7 w-24 text-xs" type="number" value={r.fromLevel} onChange={(e) => { const nr = [...levelRanges]; nr[i].fromLevel = Number(e.target.value); setLevelRanges(nr); }} />
                    <span className="text-muted-foreground w-8">До</span>
                    <Input className="h-7 w-24 text-xs" type="number" value={r.toLevel} onChange={(e) => { const nr = [...levelRanges]; nr[i].toLevel = Number(e.target.value); setLevelRanges(nr); }} />
                    <span className="text-muted-foreground w-16">Коэфф.</span>
                    <Input className="h-7 w-20 text-xs" type="number" step="0.01" value={r.coefficient} onChange={(e) => { const nr = [...levelRanges]; nr[i].coefficient = Number(e.target.value); setLevelRanges(nr); }} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setLevelRanges(levelRanges.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                {!levelRanges.length && <p className="text-xs text-muted-foreground">Нет диапазонов — kLVL = 0</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
