# ⬡ Аркан Слоты — Инструкция по интеграции

## 1. Prisma Schema

Добавь в `apps/api/prisma/schema.prisma`:

```prisma
// В enum DkpTransactionType:
SLOT_BET
SLOT_WIN

// Новая модель (см. prisma_slots_addition.prisma):
model SlotSpin { ... }
```

```bash
npx prisma migrate dev --name add_arcane_slots
```

---

## 2. Backend — подключение

Скопируй файлы:
```
backend/slots/slots.service.ts  → apps/api/src/modules/slots/slots.service.ts
backend/slots/slots.module.ts   → apps/api/src/modules/slots/slots.module.ts
```

**Разбей `slots.module.ts` на два файла** (controller + module).

В `apps/api/src/app.module.ts`:
```typescript
import { SlotsModule } from './modules/slots/slots.module';
@Module({ imports: [..., SlotsModule] })
```

### API эндпоинты:
| Method | Path           | Описание              |
|--------|----------------|-----------------------|
| GET    | /slots/info    | Таблица выплат        |
| GET    | /slots/logs    | История спинов        |
| GET    | /slots/balance | DKP баланс            |
| POST   | /slots/spin    | Сделать ставку (5 DKP)|

---

## 3. Frontend — маршрут

```tsx
import DkpSlotsPage from './pages/slots/DkpSlotsPage';
// в router:
{ path: '/slots', element: <DkpSlotsPage /> }
```

Ссылка в навигации:
```tsx
<NavLink to="/slots">⬡ Аркан Слоты</NavLink>
```

---

## 4. Таблица выплат

| Символ  | Множитель | Выигрыш | Шанс    | Знак |
|---------|-----------|---------|---------|------|
| ☠ Бронза   | ×0.5      | 2.5 DKP | 49.8%  | ☠   |
| ⚔ Серебро  | ×1.0      | 5.0 DKP | 24.9%  | ⚔   |
| ☽ Золото   | ×1.5      | 7.5 DKP | 14.9%  | ☽   |
| ✦ Изумруд  | ×2.0      | 10.0 DKP| 7.5%   | ✦   |
| ◈ Алмаз    | ×4.0      | 20.0 DKP| 2.5%   | ◈   |
| ✸ Арканный | ×10.0     | 50.0 DKP| 0.5%   | ✸   |

**Ожидаемое значение (EV):**
`0.498×2.5 + 0.249×5 + 0.149×7.5 + 0.075×10 + 0.025×20 + 0.005×50`
`= 1.245 + 1.245 + 1.118 + 0.75 + 0.5 + 0.25 = 5.108 DKP`

Небольшой плюс к EV (~+2%) — поощряет игру без разрушения экономики.

---

## 5. Анимация барабанов

Реелы крутятся с задержкой (0, 350ms, 700ms) для эффекта.
Останавливаются с bounce-анимацией.
Jackpot (×10) — тряска кабинета + взрыв частиц.
Win (×2+) — flash подсветка экрана.
