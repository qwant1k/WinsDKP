# 🔧 Решение проблем при деплое Ymir Clan Hub

## Railway - Проблемы деплоя

### ❌ Проблема: "Build failed: command not found: pnpm"

**Причина:** Railway не может найти pnpm.

**Решение 1:** Добавьте `nixpacks.toml` в корень проекта:

```toml
[phases.setup]
nixPkgs = ["nodejs-20_x", "pnpm"]

[phases.install]
cmds = ["pnpm install --frozen-lockfile"]

[phases.build]
cmds = ["pnpm --filter api build"]

[start]
cmd = "cd apps/api && pnpm start:prod"
```

**Решение 2:** Используйте npm вместо pnpm (изменить команды в Railway):

```bash
# Build Command
npm install && npm run build --workspace=apps/api

# Start Command
npm run start:prod --workspace=apps/api
```

---

### ❌ Проблема: "Module not found: Cannot find module 'prisma'"

**Причина:** Prisma клиент не был сгенерирован.

**Решение:** Добавьте в `apps/api/package.json`:

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

Или измените Build Command в Railway:

```bash
pnpm install && pnpm --filter api db:generate && pnpm --filter api build
```

---

### ❌ Проблема: "Error: P1001: Can't reach database server"

**Причина:** Переменная `DATABASE_URL` не настроена или неправильная.

**Решение:**

1. В Railway → PostgreSQL сервис → **Connect**
2. Скопируйте **Database URL**
3. В API сервис → Variables → проверьте `DATABASE_URL`
4. Должно быть: `${{Postgres.DATABASE_URL}}` (ссылка на сервис Postgres)

**Альтернатива:** Вручную скопируйте URL из PostgreSQL:

```env
DATABASE_URL=postgresql://postgres:password@containers-us-west-xxx.railway.app:6543/railway
```

---

### ❌ Проблема: "Port 3000 already in use"

**Причина:** Railway автоматически назначает порт через переменную `PORT`.

**Решение:** В `apps/api/src/main.ts` используйте:

```typescript
const port = process.env.PORT || 3000;
await app.listen(port, '0.0.0.0');
```

**Или** удалите переменную `PORT=3000` из Railway Variables (Railway сам установит).

---

### ❌ Проблема: "Migrations failed: Table already exists"

**Причина:** Миграции уже были применены, но пытаются применится снова.

**Решение 1:** Используйте `migrate deploy` вместо `migrate dev`:

```bash
railway run -s api pnpm --filter api db:migrate:deploy
```

**Решение 2:** Сбросьте БД (ОСТОРОЖНО - удалит все данные):

```bash
railway run -s api pnpm --filter api db:reset
```

---

### ❌ Проблема: "Redis connection refused"

**Причина:** Переменная `REDIS_URL` не настроена.

**Решение:**

1. Railway → Redis сервис → **Connect**
2. Скопируйте **Redis URL**
3. В API сервис → Variables → проверьте `REDIS_URL`
4. Должно быть: `${{Redis.REDIS_URL}}`

---

### ❌ Проблема: "Out of credits" в Railway

**Причина:** Превышен бесплатный лимит $5/месяц.

**Решение 1:** Добавьте платежную карту (минимум $5/месяц):

1. Railway → Account Settings → Billing
2. Add Payment Method

**Решение 2:** Оптимизируйте использование:

1. В сервисах → Settings → **Sleep after inactivity** (остановка при простое)
2. Удалите неиспользуемые сервисы

**Решение 3:** Перейдите на Render.com (750 часов бесплатно).

---

### ❌ Проблема: "WebSocket connection failed"

**Причина:** Railway не поддерживает WebSocket из коробки (нужна настройка).

**Решение:** В `apps/api/src/main.ts` добавьте:

```typescript
const app = await NestFactory.create(AppModule, new FastifyAdapter());

// WebSocket для Railway
app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
});

// Важно: используйте polling как fallback
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  transports: ['websocket', 'polling'], // <--- важно!
});
```

---

## Vercel - Проблемы деплоя

### ❌ Проблема: "Build failed: Cannot find module 'vite'"

**Причина:** Зависимости не установлены правильно в monorepo.

**Решение:** Измените Build Command в Vercel:

```bash
cd ../.. && pnpm install && cd apps/web && pnpm build
```

Или используйте `vercel.json` в корне проекта:

```json
{
  "buildCommand": "pnpm install && pnpm --filter web build",
  "outputDirectory": "apps/web/dist",
  "framework": "vite"
}
```

---

### ❌ Проблема: "404 Not Found" на роутах

**Причина:** React Router требует SPA rewrites.

**Решение:** Создайте `vercel.json` в корне проекта:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

### ❌ Проблема: "CORS error when calling API"

**Причина:** FRONTEND_URL не настроен в Railway или CORS не включен в API.

**Решение 1:** Проверьте переменную в Railway:

```env
FRONTEND_URL=https://ymir-clan-hub.vercel.app
```

**Решение 2:** Проверьте CORS в `apps/api/src/main.ts`:

```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
});
```

**Решение 3:** В `apps/web/.env.production` проверьте:

```env
VITE_API_URL=https://ymir-api.up.railway.app/api/v1
```

---

### ❌ Проблема: "Environment variables not found"

**Причина:** Vercel не видит переменные окружения.

**Решение:**

1. Vercel → Project Settings → Environment Variables
2. Добавьте переменные:
   ```
   VITE_API_URL=https://ymir-api.up.railway.app/api/v1
   VITE_WS_URL=wss://ymir-api.up.railway.app
   ```
3. Выберите **Production**, **Preview**, **Development**
4. Redeploy проект

---

### ❌ Проблема: "Function timeout (10s limit exceeded)"

**Причина:** Vercel Free tier имеет лимит 10 секунд на функцию (но это для API, не для фронтенда).

**Решение:** Убедитесь, что фронтенд не делает серверный рендеринг. Для Vite это не проблема (статический SPA).

---

## Cloudflare R2 - Проблемы

### ❌ Проблема: "S3 Access Denied"

**Причина:** Неправильные ключи доступа или права.

**Решение:**

1. Cloudflare R2 → Manage R2 API Tokens
2. Создайте новый токен с правами **Object Read & Write**
3. Обновите переменные в Railway:
   ```env
   S3_ACCESS_KEY_ID=<новый ключ>
   S3_SECRET_ACCESS_KEY=<новый секрет>
   ```

---

### ❌ Проблема: "Bucket not found"

**Причина:** Неправильное имя бакета.

**Решение:** Проверьте переменную в Railway:

```env
S3_BUCKET_NAME=ymir-clan-hub
```

Имя должно совпадать с именем в Cloudflare R2.

---

### ❌ Проблема: "Files uploaded but not accessible"

**Причина:** Файлы не публичны.

**Решение 1:** Настройте CORS в Cloudflare R2:

1. R2 → Bucket → Settings → CORS
2. Добавьте:

```json
[
  {
    "AllowedOrigins": ["https://ymir-clan-hub.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

**Решение 2:** Используйте signed URLs в коде API.

---

## GitHub - Проблемы с Git

### ❌ Проблема: "Authentication failed"

**Причина:** GitHub больше не принимает пароли для HTTPS.

**Решение:** Используйте Personal Access Token (PAT):

1. GitHub → https://github.com/settings/tokens
2. **Generate new token (classic)**
3. Scope: `repo`
4. При запросе пароля вставьте токен

---

### ❌ Проблема: ".env файлы загрузились на GitHub"

**Причина:** `.gitignore` не был добавлен до первого коммита.

**Решение:**

1. Удалите файлы из Git (но сохраните локально):

```bash
git rm --cached .env
git rm --cached apps/api/.env
git commit -m "fix: remove .env files"
git push
```

2. Добавьте `.gitignore`:

```gitignore
.env
.env.local
.env.production
apps/**/.env
```

3. **ВАЖНО:** Смените все секреты (JWT, database passwords, API keys) — они скомпрометированы!

---

### ❌ Проблема: "node_modules загрузились на GitHub"

**Причина:** `.gitignore` не был добавлен.

**Решение:**

```bash
git rm -r --cached node_modules
git commit -m "fix: remove node_modules"
git push
```

Добавьте в `.gitignore`:

```gitignore
node_modules/
```

---

## Database - Проблемы с PostgreSQL

### ❌ Проблема: "Too many connections"

**Причина:** Railway Free tier ограничивает количество подключений.

**Решение:** Используйте connection pooling в Prisma:

В `apps/api/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // Для миграций
}
```

В Railway добавьте переменные:

```env
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true
DIRECT_URL=postgresql://user:pass@host:5432/db
```

---

### ❌ Проблема: "Slow queries"

**Причина:** Нет индексов на часто запрашиваемых полях.

**Решение:** Добавьте индексы в Prisma schema:

```prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  
  @@index([email]) // Добавьте индекс
}
```

Создайте миграцию:

```bash
pnpm --filter api db:migrate dev --name add_indexes
```

---

## Email - Проблемы

### ❌ Проблема: "Email not sending"

**Причина:** SMTP не настроен.

**Решение:** Используйте Resend.com (бесплатно 3000 писем/месяц):

1. https://resend.com → Sign up
2. API Keys → Create
3. В Railway добавьте:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxx
SMTP_FROM=noreply@yourdomain.com
```

---

## Performance - Проблемы производительности

### ❌ Проблема: "App is slow to respond"

**Причина 1:** Railway Free tier усыпляет приложение после 30 минут неактивности.

**Решение:** Добавьте в Railway:

1. Settings → **Disable Sleep** (требует платного плана)

Или используйте Uptime Robot для пинга каждые 5 минут (бесплатно):

```
https://uptimerobot.com
```

**Причина 2:** Слишком много запросов к БД.

**Решение:** Используйте кэширование в Redis:

```typescript
// Пример кэширования
const cachedData = await redis.get('key');
if (cachedData) return JSON.parse(cachedData);

const data = await db.query();
await redis.setex('key', 3600, JSON.stringify(data));
return data;
```

---

## Мониторинг и отладка

### Просмотр логов в Railway

```bash
# Установите Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Логин
railway login

# Подключение к проекту
railway link

# Просмотр логов
railway logs -s api
```

---

### Просмотр логов в Vercel

1. Vercel → Project → Deployments
2. Выберите последний деплой → **View Function Logs**

---

### Проверка здоровья API

```bash
# Health check
curl https://ymir-api.up.railway.app/api/v1/health

# Должно вернуть:
{"status":"ok"}
```

---

### Тестирование WebSocket

```javascript
// В браузерной консоли на сайте
const ws = new WebSocket('wss://ymir-api.up.railway.app');
ws.onopen = () => console.log('Connected!');
ws.onerror = (err) => console.error('Error:', err);
```

---

## Чеклист отладки

Если что-то не работает, пройдитесь по списку:

- [ ] Все переменные окружения заданы в Railway/Vercel
- [ ] FRONTEND_URL в Railway совпадает с URL Vercel
- [ ] VITE_API_URL в Vercel совпадает с URL Railway
- [ ] Миграции применены (`railway run -s api pnpm db:migrate:deploy`)
- [ ] Seed данных загружен (`railway run -s api pnpm db:seed`)
- [ ] Логи Railway не показывают ошибок
- [ ] Логи Vercel не показывают ошибок
- [ ] Health endpoint возвращает `{"status":"ok"}`
- [ ] CORS настроен правильно в API
- [ ] Cloudflare R2 ключи правильные

---

## Куда обратиться за помощью

1. **Railway Community:**
   - Discord: https://discord.gg/railway
   - Docs: https://docs.railway.app

2. **Vercel Support:**
   - Support: https://vercel.com/support
   - Docs: https://vercel.com/docs

3. **Cloudflare Community:**
   - Forum: https://community.cloudflare.com
   - Docs: https://developers.cloudflare.com/r2

4. **Stack Overflow:**
   - Теги: `nestjs`, `react`, `railway`, `vercel`, `prisma`

---

## Профилактика проблем

Чтобы избежать проблем в будущем:

1. ✅ Всегда проверяйте логи после деплоя
2. ✅ Используйте `.env.example` как референс
3. ✅ Тестируйте локально перед пушем
4. ✅ Делайте частые коммиты
5. ✅ Создавайте бэкапы БД регулярно (Railway делает это автоматически)
6. ✅ Мониторьте usage в Railway (Project → Usage)
7. ✅ Ставьте алерты на Uptime Robot

---

## Экстренное восстановление

Если всё сломалось:

### Plan A: Откат деплоя

**Railway:**
1. API Service → Deployments
2. Выберите предыдущий успешный деплой
3. **Redeploy**

**Vercel:**
1. Project → Deployments
2. Выберите предыдущий деплой
3. **Promote to Production**

### Plan B: Полный пересоздание

```bash
# 1. Удалите проект в Railway
# 2. Удалите проект в Vercel
# 3. Следуйте DEPLOYMENT_CHECKLIST.md заново
```

### Plan C: Восстановление БД из бэкапа

Railway автоматически делает бэкапы PostgreSQL.

1. Railway → PostgreSQL Service → Backups
2. Выберите бэкап → **Restore**

---

## Готово! 🎉

Если проблема не решена — напишите детали в комментарий или обратитесь в поддержку сервиса.
