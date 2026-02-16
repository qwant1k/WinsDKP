import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useMobileMenuStore } from '@/stores/mobile-menu.store';
import {
  LayoutDashboard, Users, Swords, Trophy, Dices, Package,
  Newspaper, MessageSquare, Mail, Bell, ScrollText, Settings,
  Shield, LogOut, ChevronLeft, Coins, UserPlus, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

const navItems = [
  { label: 'Дашборд', icon: LayoutDashboard, path: '/', requiresClan: true },
  { label: 'Мой клан', icon: Users, path: '/clan', requiresClan: true },
  { label: 'DKP Кошелёк', icon: Coins, path: '/dkp', requiresClan: true },
  { label: 'Активности', icon: Swords, path: '/activities', requiresClan: true },
  { label: 'Аукцион', icon: Trophy, path: '/auctions', requiresClan: true },
  { label: 'Рандомайзер', icon: Dices, path: '/randomizer', requiresClan: true },
  { label: 'Хранилище', icon: Package, path: '/warehouse', requiresClan: true },
  { label: 'Новости', icon: Newspaper, path: '/news', requiresClan: true },
  { label: 'Лента', icon: MessageSquare, path: '/feed', requiresClan: true },
  { label: 'Сообщения', icon: Mail, path: '/messages', requiresClan: false },
  { label: 'Уведомления', icon: Bell, path: '/notifications', requiresClan: false },
];

const adminItems = [
  { label: 'Админ-панель', icon: Shield, path: '/admin' },
  { label: 'Аудит', icon: ScrollText, path: '/admin/audit' },
  { label: 'Настройки', icon: Settings, path: '/admin/settings' },
];

function SidebarContent({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuthStore();
  const { close: closeMobile } = useMobileMenuStore();

  const handleNavClick = () => {
    closeMobile();
  };

  return (
    <>
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2" onClick={handleNavClick}>
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
          className={cn('h-8 w-8 shrink-0 hidden md:flex', collapsed && 'mx-auto mt-2')}
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 md:hidden"
          onClick={closeMobile}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
        {!user?.clanMembership && !isAdmin() && (
          <Link
            to="/join-clan"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              'bg-gold-500/10 text-gold-400 hover:bg-gold-500/20',
              collapsed && 'justify-center px-2',
            )}
            title={collapsed ? 'Вступить в клан' : undefined}
            onClick={handleNavClick}
          >
            <UserPlus className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Вступить в клан</span>}
          </Link>
        )}
        {navItems.filter((item) => !item.requiresClan || !!user?.clanMembership || isAdmin()).map((item) => {
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
              onClick={handleNavClick}
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
                  onClick={handleNavClick}
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
          <Link to="/profile" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary hover:ring-2 hover:ring-primary/50 transition-all" title="Мой профиль" onClick={handleNavClick}>
            {user?.profile?.nickname?.charAt(0)?.toUpperCase() || '?'}
          </Link>
          {!collapsed && (
            <Link to="/profile" className="flex-1 truncate hover:opacity-80 transition-opacity" onClick={handleNavClick}>
              <p className="truncate text-sm font-medium">{user?.profile?.nickname || 'User'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.profile?.displayName}</p>
            </Link>
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
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { isOpen, close } = useMobileMenuStore();
  const location = useLocation();

  useEffect(() => {
    close();
  }, [location.pathname]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden md:flex h-screen flex-col border-r border-border bg-card transition-all duration-300',
          collapsed ? 'w-[68px]' : 'w-[260px]',
        )}
      >
        <SidebarContent collapsed={collapsed} setCollapsed={setCollapsed} />
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={close}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent collapsed={false} setCollapsed={() => {}} />
      </aside>
    </>
  );
}
