# 🎡 Колесо Фортуны — Инструкция по интеграции

## 1. Prisma Schema

Добавь в `apps/api/prisma/schema.prisma`:

```prisma
// В модель WarehouseItem добавь поле:
availableInFortune Boolean @default(false) @map("available_in_fortune")

// Добавь новую модель FortuneSpin (см. prisma_schema_addition.prisma)
```

Запусти миграцию:
```bash
pnpm db:migrate
# или вручную:
# npx prisma migrate dev --name add_fortune_wheel
```

---

## 2. Backend — подключение модуля

В `apps/api/src/app.module.ts` добавь импорт:

```typescript
import { FortuneModule } from './modules/fortune/fortune.module';

@Module({
  imports: [
    // ... существующие модули
    FortuneModule,
  ],
})
export class AppModule {}
```

Скопируй файлы:
```
backend/fortune/fortune.module.ts     → apps/api/src/modules/fortune/fortune.module.ts
backend/fortune/fortune.controller.ts → apps/api/src/modules/fortune/fortune.controller.ts
backend/fortune/fortune.service.ts    → apps/api/src/modules/fortune/fortune.service.ts
backend/dto/spin.dto.ts               → apps/api/src/modules/fortune/dto/spin.dto.ts
```

### Важно: добавь тип транзакции в Prisma enum

В schema.prisma найди enum типов транзакций DKP и добавь:
```prisma
FORTUNE_SPIN
```

Найди enum для типов движения склада и добавь:
```prisma
FORTUNE_WIN
```

---

## 3. Frontend — маршрут

В `apps/web/src/App.tsx` (или router файл) добавь:

```tsx
import FortuneWheelPage from './pages/fortune/FortuneWheelPage';

// В routes:
{ path: '/fortune', element: <FortuneWheelPage /> }
```

Скопируй файл:
```
frontend/pages/fortune/FortuneWheelPage.tsx → apps/web/src/pages/fortune/FortuneWheelPage.tsx
```

### Добавь ссылку в навигацию

В компонент сайдбара/навбара добавь:
```tsx
<NavLink to="/fortune">🎡 Колесо Фортуны</NavLink>
```

---

## 4. Хранилище — включить предметы в Фортуну

В UI хранилища (Warehouse) добавь переключатель `availableInFortune` для каждого предмета.
На бэкенде в `warehouse.service.ts` добавь обновление этого поля.

Пример API-запроса (добавь в WarehouseController):
```typescript
@Patch(':id/fortune-toggle')
toggleFortune(@Param('id') id: string, @Body('enabled') enabled: boolean) {
  return this.prisma.warehouseItem.update({
    where: { id },
    data: { availableInFortune: enabled },
  });
}
```

---

## 5. Система шансов (логика)

| Ставка | Common | Uncommon | Rare | Epic | Legendary |
|--------|--------|----------|------|------|-----------|
| 15 DKP | ~62.5% | ~25%     | ~9.4%| ~2.5%| ~0.6%    |
| 30 DKP | ~45.5% | ~29.1%   |~10.9%| ~2.9%| ~0.7%    |
| 50 DKP | ~31.6% | ~37.9%   |~14.2%| ~3.8%| ~0.9%    |
|100 DKP | ~17.4% | ~41.7%   |~15.6%| ~4.2%| ~1%      |

**Механика fair**: при высоких ставках multiplier поднимает веса необычного/редкого лута,
но Common остаётся базовым — поэтому шанс хорошего лута честно растёт, но не гарантирует.

**Provably fair**: каждый спин имеет seed + SHA-256 hash, доступный игроку для проверки.

---

## 6. Зависимости (уже в проекте)

- `@tanstack/react-query` ✅
- `sonner` (toast) ✅ — или заменить на любой toast из проекта
- Canvas API (нативный браузер) ✅
- TailwindCSS ✅
