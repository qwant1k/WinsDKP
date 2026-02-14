import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      const { mustChangePassword } = useAuthStore.getState();
      if (mustChangePassword) {
        navigate('/force-change-password');
        return;
      }
      toast.success('Добро пожаловать!');
      navigate('/');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/20">
            <span className="font-display text-2xl font-bold text-black">Y</span>
          </div>
          <h1 className="font-display text-3xl font-bold gradient-gold">Ymir Clan Hub</h1>
          <p className="mt-2 text-sm text-muted-foreground">Система управления кланом Legend of Ymir</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl">Вход в систему</CardTitle>
            <CardDescription>Введите ваш email и пароль</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="player@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Пароль</label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-2">Демо-аккаунты (пароль: demo123)</p>
                <div className="space-y-1">
                  <button type="button" className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-accent/50 transition-colors" onClick={() => { setEmail('admin@ymir.local'); setPassword('demo123'); }}>
                    <span className="text-primary">admin@ymir.local</span>
                    <span className="text-muted-foreground">SuperAdmin</span>
                  </button>
                  <button type="button" className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-accent/50 transition-colors" onClick={() => { setEmail('leader@ymir.local'); setPassword('demo123'); }}>
                    <span className="text-primary">leader@ymir.local</span>
                    <span className="text-muted-foreground">Asma31337 — Глава</span>
                  </button>
                  <button type="button" className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-accent/50 transition-colors" onClick={() => { setEmail('elder@ymir.local'); setPassword('demo123'); }}>
                    <span className="text-primary">elder@ymir.local</span>
                    <span className="text-muted-foreground">Valkyrion — Старейшина</span>
                  </button>
                  <button type="button" className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-accent/50 transition-colors" onClick={() => { setEmail('member@ymir.local'); setPassword('demo123'); }}>
                    <span className="text-primary">member@ymir.local</span>
                    <span className="text-muted-foreground">RuneKeeper — Участник</span>
                  </button>
                  <button type="button" className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-accent/50 transition-colors" onClick={() => { setEmail('newbie@ymir.local'); setPassword('demo123'); }}>
                    <span className="text-primary">newbie@ymir.local</span>
                    <span className="text-muted-foreground">FrostBite — Новичок</span>
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" variant="gold" className="w-full" disabled={isLoading}>
                <LogIn className="h-4 w-4" />
                {isLoading ? 'Вход...' : 'Войти'}
              </Button>
              <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-primary">
                Забыли пароль?
              </Link>
              <p className="text-sm text-muted-foreground">
                Нет аккаунта?{' '}
                <Link to="/register" className="text-primary hover:underline">Регистрация</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
