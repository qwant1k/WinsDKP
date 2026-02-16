import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Coins, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DkpRulesPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/dkp">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold gradient-gold">Правила DKP</h1>
            <p className="text-muted-foreground">Dragon Kill Points — система справедливого распределения</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5 text-gold-400" /> Что такое DKP?</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert max-w-none text-sm space-y-3">
            <p>DKP (Dragon Kill Points) — внутренняя валюта клана, начисляемая за участие в клановых активностях. DKP используется для приобретения предметов на аукционах клана.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-400" /> Как заработать DKP</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">•</span><div><strong>Участие в рейдах</strong> — базовое начисление + коэффициенты за БМ и уровень</div></li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">•</span><div><strong>Экспедиции</strong> — стандартное начисление за участие</div></li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">•</span><div><strong>PvP/Гильд-вары</strong> — начисление по результатам</div></li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">•</span><div><strong>Мировые боссы</strong> — повышенное начисление</div></li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">•</span><div><strong>Ручное начисление</strong> — лидер/старейшина может начислить за особые заслуги</div></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-blue-400" /> Формула расчёта</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="rounded-lg bg-secondary/50 p-4 font-mono text-center">
              DKP = base_dkp + (base_dkp × coef_by_power) + (base_dkp × coef_by_level)
            </div>
            <p>Коэффициенты настраиваются лидером клана в диапазонах:</p>
            <ul className="space-y-1 list-none">
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><strong>По боевой мощи:</strong> диапазоны БМ → коэффициент</li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><strong>По уровню:</strong> диапазоны уровней → коэффициент</li>
            </ul>
            <p>Границы диапазонов включительные и не пересекаются.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-400" /> Штрафы и ограничения</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">•</span><div><strong>DKP не может уйти в минус</strong> при стандартных операциях (ставки, покупки)</div></li>
              <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">•</span><div><strong>Штрафы</strong> могут быть наложены лидером/старейшиной за нарушения</div></li>
              <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">•</span><div><strong>Удержание (Hold)</strong> — при ставке на аукционе DKP блокируется до завершения</div></li>
              <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">•</span><div><strong>Все транзакции</strong> записываются в журнал и не подлежат удалению</div></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Кошелёк</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ul className="space-y-1 list-none">
              <li><strong>Баланс</strong> — общее количество DKP на счету</li>
              <li><strong>В удержании</strong> — заблокированные DKP (активные ставки)</li>
              <li><strong>Доступно</strong> = Баланс − В удержании</li>
              <li><strong>Всего заработано</strong> — суммарно начислено за всё время</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
