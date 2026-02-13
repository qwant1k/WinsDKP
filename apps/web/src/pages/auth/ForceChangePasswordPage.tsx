import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';

export function ForceChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { clearMustChangePassword } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    if (password.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/force-change-password', { newPassword: password });
      clearMustChangePassword();
      toast.success('Пароль успешно изменён');
      navigate('/');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 shadow-lg">
            <ShieldAlert className="h-8 w-8 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Смена пароля</h1>
          <p className="mt-2 text-sm text-muted-foreground">Администратор сбросил ваш пароль. Установите новый для продолжения работы.</p>
        </div>

        <Card className="border-amber-500/30 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl">Новый пароль</CardTitle>
            <CardDescription>Придумайте надёжный пароль</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Новый пароль</label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm" className="text-sm font-medium">Подтвердите пароль</label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить и продолжить'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
