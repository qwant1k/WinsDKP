import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({ email, password, nickname, displayName: displayName || undefined });
      toast.success('Регистрация успешна! Проверьте email для подтверждения.');
      navigate('/login');
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
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl">Регистрация</CardTitle>
            <CardDescription>Создайте аккаунт для вступления в клан</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input id="email" type="email" placeholder="player@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label htmlFor="nickname" className="text-sm font-medium">Никнейм</label>
                <Input id="nickname" placeholder="DragonSlayer" value={nickname} onChange={(e) => setNickname(e.target.value)} required minLength={3} maxLength={32} />
              </div>
              <div className="space-y-2">
                <label htmlFor="displayName" className="text-sm font-medium">Отображаемое имя (опционально)</label>
                <Input id="displayName" placeholder="Убийца Драконов" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Пароль</label>
                <Input id="password" type="password" placeholder="Минимум 8 символов" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                <p className="text-xs text-muted-foreground">Минимум 8 символов, одна заглавная, одна строчная буква и цифра</p>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" variant="gold" className="w-full" disabled={isLoading}>
                <UserPlus className="h-4 w-4" />
                {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Уже есть аккаунт?{' '}
                <Link to="/login" className="text-primary hover:underline">Войти</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
