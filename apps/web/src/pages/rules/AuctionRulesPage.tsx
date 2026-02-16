import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Clock, Shield, Gavel, AlertTriangle, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AuctionRulesPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/auctions">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold gradient-gold">Правила аукциона</h1>
            <p className="text-muted-foreground">Честное распределение лута через DKP-аукционы</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-gold-400" /> Как работает аукцион</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <p>Аукцион — основной способ распределения ценного лута в клане. Лидер или старейшина создаёт аукцион, добавляет лоты из хранилища, и запускает торги.</p>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2"><span className="text-gold-400 mt-0.5">•</span><div><strong>Лоты выставляются последовательно</strong> — когда один лот завершён, начинается следующий</div></li>
              <li className="flex items-start gap-2"><span className="text-gold-400 mt-0.5">•</span><div><strong>Участвовать могут только члены клана</strong>, допущенные к аукциону</div></li>
              <li className="flex items-start gap-2"><span className="text-gold-400 mt-0.5">•</span><div><strong>Ставки делаются в DKP</strong> — используется доступный баланс</div></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gavel className="h-5 w-5 text-blue-400" /> Правила ставок</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><div><strong>Минимальная ставка</strong> — стартовая цена лота или текущая цена + минимальный шаг</div></li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><div><strong>Шаг ставки</strong> — минимальное увеличение над предыдущей ставкой (настраивается для каждого лота)</div></li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><div><strong>Проверка баланса</strong> — доступный DKP (баланс минус удержания) должен покрывать ставку</div></li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><div><strong>Удержание DKP</strong> — при ставке сумма блокируется; предыдущее удержание автоматически снимается</div></li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span><div><strong>Автоставки</strong> — можно указать максимум, и система будет автоматически повышать до указанного лимита</div></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-purple-400" /> Таймер и Anti-Sniper</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <p>Для предотвращения "снайперских" ставок в последнюю секунду используется система Anti-Sniper:</p>
            <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
              <p><strong>Если ставка сделана в последние N секунд</strong> (по умолчанию 20 сек),</p>
              <p><strong>таймер лота продлевается на M секунд</strong> (по умолчанию 30 сек).</p>
            </div>
            <p className="text-muted-foreground">Параметры N и M настраиваются администратором для каждого аукциона.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-400" /> Определение победителя</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2"><span className="text-yellow-400 mt-0.5">•</span><div><strong>Побеждает максимальная валидная ставка</strong></div></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 mt-0.5">•</span><div><strong>При равных ставках</strong> — побеждает тот, кто сделал ставку раньше</div></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 mt-0.5">•</span><div><strong>DKP победителя</strong> списывается окончательно (hold → finalize)</div></li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 mt-0.5">•</span><div><strong>DKP остальных</strong> разблокируется автоматически (hold → release)</div></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-400" /> Непроданные лоты</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <p>Если на лот не было ни одной ставки:</p>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">•</span><div>Лот получает статус <strong>«Не продан»</strong></div></li>
              <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">•</span><div>Предмет <strong>автоматически возвращается в хранилище</strong> клана</div></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-green-400" /> Безопасность и прозрачность</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">•</span><div>Все ставки записываются в <strong>неизменяемый журнал аудита</strong></div></li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">•</span><div>Операции с DKP выполняются <strong>атомарно в транзакциях БД</strong></div></li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">•</span><div>Поддержка <strong>идемпотентности</strong> — дублирующие запросы безопасны</div></li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">•</span><div>Защита от <strong>гонок</strong> — row-level locks при работе с кошельками</div></li>
              <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">•</span><div><strong>Realtime обновления</strong> — все участники видят ставки мгновенно через WebSocket</div></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
