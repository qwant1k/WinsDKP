import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Mail, KeyRound, ShieldCheck } from 'lucide-react';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setStep('code');
      toast.success('Код отправлен на почту');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/verify-reset-code', { email, code });
      setStep('password');
      toast.success('Код подтверждён');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    if (password.length < 6) {
      toast.error('Минимум 6 символов');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, code, password });
      toast.success('Пароль успешно изменён!');
      navigate('/login');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const stepInfo = {
    email: { title: 'Сброс пароля', desc: 'Введите email, привязанный к вашему аккаунту', icon: Mail },
    code: { title: 'Введите код', desc: `Мы отправили 6-значный код на ${email}`, icon: KeyRound },
    password: { title: 'Новый пароль', desc: 'Придумайте новый надёжный пароль', icon: ShieldCheck },
  };

  const { title, desc, icon: StepIcon } = stepInfo[step];

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
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <StepIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{title}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </div>
            </div>
            <div className="flex gap-1 mt-4">
              {['email', 'code', 'password'].map((s, i) => (
                <div key={s} className={`h-1 flex-1 rounded-full ${i <= ['email', 'code', 'password'].indexOf(step) ? 'bg-primary' : 'bg-border'}`} />
              ))}
            </div>
          </CardHeader>

          {step === 'email' && (
            <form onSubmit={handleSendCode}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">Email</label>
                  <Input id="email" type="email" placeholder="player@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                  {loading ? 'Отправка...' : 'Отправить код'}
                </Button>
                <Link to="/login" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                  <ArrowLeft className="h-3 w-3" /> Вернуться ко входу
                </Link>
              </CardFooter>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleVerifyCode}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium">6-значный код</label>
                  <Input id="code" type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required
                    className="text-center text-2xl tracking-[0.5em] font-mono" autoComplete="one-time-code" />
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button type="submit" variant="gold" className="w-full" disabled={loading || code.length !== 6}>
                  {loading ? 'Проверка...' : 'Подтвердить код'}
                </Button>
                <button type="button" onClick={() => { setCode(''); handleSendCode({ preventDefault: () => {} } as any); }}
                  className="text-sm text-muted-foreground hover:text-primary">Отправить код повторно</button>
                <button type="button" onClick={() => setStep('email')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                  <ArrowLeft className="h-3 w-3" /> Изменить email
                </button>
              </CardFooter>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handleResetPassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">Новый пароль</label>
                  <Input id="password" type="password" placeholder="Минимум 6 символов" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="confirm" className="text-sm font-medium">Подтвердите пароль</label>
                  <Input id="confirm" type="password" placeholder="Повторите пароль" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button type="submit" variant="gold" className="w-full" disabled={loading || !password || password !== confirmPassword}>
                  {loading ? 'Сохранение...' : 'Установить новый пароль'}
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
