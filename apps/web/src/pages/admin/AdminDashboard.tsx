import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDkp } from '@/lib/utils';
import { Users, Shield, Trophy, Swords, Coins, Settings, ScrollText, Package, Newspaper, Bell, Dices, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const adminLinks = [
  { label: 'Пользователи', icon: Users, path: '/admin/users', color: 'text-blue-400' },
  { label: 'Аудит', icon: ScrollText, path: '/admin/audit', color: 'text-orange-400' },
  { label: 'Настройки', icon: Settings, path: '/admin/settings', color: 'text-purple-400' },
];

export function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => (await api.get('/admin/dashboard')).data,
  });

  const statCards = [
    { label: 'Пользователи', value: stats?.users, icon: Users, color: 'text-blue-400', bg: 'from-blue-500/5' },
    { label: 'Кланы', value: stats?.clans, icon: Shield, color: 'text-green-400', bg: 'from-green-500/5' },
    { label: 'Аукционы', value: stats?.auctions, icon: Trophy, color: 'text-purple-400', bg: 'from-purple-500/5' },
    { label: 'Активности', value: stats?.activities, icon: Swords, color: 'text-yellow-400', bg: 'from-yellow-500/5' },
    { label: 'DKP в обороте', value: stats?.totalDkpInCirculation ? formatDkp(Number(stats.totalDkpInCirculation)) : '0', icon: Coins, color: 'text-gold-400', bg: 'from-gold-500/5' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
          <LayoutDashboard className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold">Админ-панель</h1>
          <p className="text-sm text-muted-foreground">Управление всей системой Ymir Clan Hub</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={`bg-gradient-to-br ${stat.bg} to-transparent`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-16" /> : (
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value ?? 0}</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {adminLinks.map((link) => (
          <Link key={link.path} to={link.path}>
            <Card className="group cursor-pointer hover:border-primary/20 transition-all hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary group-hover:bg-primary/10 transition-colors">
                  <link.icon className={`h-6 w-6 ${link.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold group-hover:text-primary transition-colors">{link.label}</h3>
                  <p className="text-xs text-muted-foreground">Управление</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
