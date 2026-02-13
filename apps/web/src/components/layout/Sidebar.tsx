import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import {
  LayoutDashboard, Users, Swords, Trophy, Dices, Package,
  Newspaper, MessageSquare, Mail, Bell, ScrollText, Settings,
  Shield, LogOut, ChevronLeft, Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const navItems = [
  { label: 'Дашборд', icon: LayoutDashboard, path: '/' },
  { label: 'Мой клан', icon: Users, path: '/clan' },
  { label: 'DKP Кошелёк', icon: Coins, path: '/dkp' },
  { label: 'Активности', icon: Swords, path: '/activities' },
  { label: 'Аукцион', icon: Trophy, path: '/auctions' },
  { label: 'Рандомайзер', icon: Dices, path: '/randomizer' },
  { label: 'Хранилище', icon: Package, path: '/warehouse' },
  { label: 'Новости', icon: Newspaper, path: '/news' },
  { label: 'Лента', icon: MessageSquare, path: '/feed' },
  { label: 'Сообщения', icon: Mail, path: '/messages' },
  { label: 'Уведомления', icon: Bell, path: '/notifications' },
];

const adminItems = [
  { label: 'Админ-панель', icon: Shield, path: '/admin' },
  { label: 'Аудит', icon: ScrollText, path: '/admin/audit' },
  { label: 'Настройки', icon: Settings, path: '/admin/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[260px]',
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600">
              <span className="text-sm font-bold text-black">Y</span>
            </div>
            <span className="font-display text-lg font-bold gradient-gold">Ymir Hub</span>
          </Link>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600">
            <span className="text-sm font-bold text-black">Y</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8 shrink-0', collapsed && 'mx-auto mt-2')}
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {isAdmin() && (
          <>
            <div className={cn('my-3 border-t border-border', collapsed && 'mx-2')} />
            {adminItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-red-500/10 text-red-400'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    collapsed && 'justify-center px-2',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <div className={cn('flex items-center gap-3', collapsed && 'flex-col')}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
            {user?.profile?.nickname?.charAt(0)?.toUpperCase() || '?'}
          </div>
          {!collapsed && (
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium">{user?.profile?.nickname || 'User'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.profile?.displayName}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={logout}
            title="Выйти"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
