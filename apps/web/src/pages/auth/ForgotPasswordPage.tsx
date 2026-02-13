import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Mail } from 'lucide-react';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('Письмо отправлено');
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/20">
            <span className="font-display text-2xl font-bold text-black">Y</span>
          </div>
          <h1 className="font-display text-3xl font-bold gradient-gold">Ymir Clan Hub</h1>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl">Сброс пароля</CardTitle>
            <CardDescription>
              {sent
                ? 'Проверьте вашу почту. Если аккаунт существует, мы отправили ссылку для сброса пароля.'
                : 'Введите email, привязанный к вашему аккаунту'}
            </CardDescription>
          </CardHeader>
          {!sent ? (
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
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                  <Mail className="h-4 w-4" />
                  {loading ? 'Отправка...' : 'Отправить ссылку'}
                </Button>
                <Link to="/login" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                  <ArrowLeft className="h-3 w-3" /> Вернуться ко входу
                </Link>
              </CardFooter>
            </form>
          ) : (
            <CardFooter className="flex-col gap-3">
              <Button variant="outline" className="w-full" onClick={() => { setSent(false); setEmail(''); }}>
                Отправить повторно
              </Button>
              <Link to="/login" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                <ArrowLeft className="h-3 w-3" /> Вернуться ко входу
              </Link>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
