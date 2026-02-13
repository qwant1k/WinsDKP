# Деплой Ymir Clan Hub на Render.com (архивная инструкция)

## Архитектура на Render

| Сервис | Тип в Render | План |
|--------|-------------|------|
| PostgreSQL | Managed Database | Free / Starter |
| Redis | Managed Redis | Free / Starter |
| API (NestJS) | Web Service | Free / Starter |
| Worker | Background Worker | Starter |
| Frontend (React) | Static Site | Free |

> **MinIO** не доступен на Render. Для файлов используйте **Cloudflare R2**, **AWS S3** или **Backblaze B2** (S3-совместимые). Если файлы пока не нужны — можно пропустить.

> **Mailpit** — только для dev. В продакшене используйте **Resend**, **SendGrid** или **Mailgun**.

---

## Шаг 1. Создание базы данных PostgreSQL

1. Зайдите в [Render Dashboard](https://dashboard.render.com)
2. **New → PostgreSQL**
3. Настройки:
   - **Name**: `ymir-postgres`
   - **Database**: `ymir_clan_hub`
   - **User**: `ymir`
   - **Region**: выберите ближайший (например `Frankfurt EU Central`)
   - **Plan**: Free (90 дней) или Starter ($7/мес)
4. Нажмите **Create Database**
5. Скопируйте **Internal Database URL** — он понадобится для API

Формат: `postgresql://ymir:PASSWORD@HOST:5432/ymir_clan_hub`

---

## Шаг 2. Создание Redis

1. **New → Redis**
2. Настройки:
   - **Name**: `ymir-redis`
   - **Region**: тот же, что и PostgreSQL
   - **Plan**: Free или Starter ($7/мес)
3. Нажмите **Create Redis**
4. Скопируйте **Internal Redis URL**

Формат: `redis://red-XXXXX:6379`

---

## Шаг 3. Деплой API (Web Service)

1. **New → Web Service**
2. Подключите репозиторий `github.com/qwant1k/WinsDKP`
3. Настройки:
   - **Name**: `ymir-api`
   - **Region**: тот же
   - **Runtime**: `Node`
   - **Root Directory**: `apps/api`
   - **Build Command**:
     ```
     npm install -g pnpm@9.15.4 && cd ../.. && pnpm install && cd apps/api && npx prisma generate && pnpm build
     ```
   - **Start Command**:
     ```
     npx prisma migrate deploy && node dist/main.js
     ```
   - **Plan**: Free или Starter ($7/мес)

4. **Environment Variables** (вкладка Environment):

| Ключ | Значение |
|------|----------|
| `NODE_ENV` | `production` |
| `APP_PORT` | `3000` |
| `DATABASE_URL` | *(Internal URL из шага 1)* |
| `REDIS_URL` | *(Internal URL из шага 2)* |
| `REDIS_HOST` | *(хост из Redis URL, без redis://)* |
| `REDIS_PORT` | `6379` |
| `JWT_ACCESS_SECRET` | *(сгенерируйте: `openssl rand -hex 32`)* |
| `JWT_REFRESH_SECRET` | *(сгенерируйте: `openssl rand -hex 32`)* |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `WEB_URL` | `https://ymir-web.onrender.com` *(URL фронтенда после создания)* |
| `CORS_ORIGINS` | `https://ymir-web.onrender.com` |
| `SMTP_HOST` | *(ваш SMTP, например smtp.resend.com)* |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | *(логин SMTP)* |
| `SMTP_PASS` | *(пароль SMTP)* |
| `SMTP_FROM` | `noreply@yourdomain.com` |
| `MINIO_ENDPOINT` | *(S3-совместимый endpoint, если нужен)* |
| `MINIO_PORT` | `443` |
| `MINIO_ACCESS_KEY` | *(access key)* |
| `MINIO_SECRET_KEY` | *(secret key)* |
| `MINIO_BUCKET` | `ymir-uploads` |
| `MINIO_USE_SSL` | `true` |

5. Нажмите **Create Web Service**

---

## Шаг 4. Деплой Worker (Background Worker)

> Worker обрабатывает фоновые задачи (BullMQ). Если пока не нужен — можно пропустить.

1. **New → Background Worker**
2. Подключите тот же репозиторий
3. Настройки:
   - **Name**: `ymir-worker`
   - **Root Directory**: `apps/api`
   - **Build Command**:
     ```
     npm install -g pnpm@9.15.4 && cd ../.. && pnpm install && cd apps/api && npx prisma generate && pnpm build
     ```
   - **Start Command**:
     ```
     node dist/worker.js
     ```
   - **Plan**: Starter ($7/мес) — Free план не поддерживает Background Workers

4. **Environment Variables**: те же, что и у API (шаг 3)

---

## Шаг 5. Деплой Frontend (Static Site)

1. **New → Static Site**
2. Подключите тот же репозиторий
3. Настройки:
   - **Name**: `ymir-web`
   - **Root Directory**: `apps/web`
   - **Build Command**:
     ```
     npm install -g pnpm@9.15.4 && cd ../.. && pnpm install && cd apps/web && pnpm build
     ```
   - **Publish Directory**: `dist`

4. **Environment Variables**:

| Ключ | Значение |
|------|----------|
| `VITE_API_URL` | `https://ymir-api.onrender.com` |
| `VITE_WS_URL` | `wss://ymir-api.onrender.com` |

5. **Redirects/Rewrites** (вкладка Redirects):
   Добавьте правило для SPA роутинга:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`

6. Нажмите **Create Static Site**

---

## Шаг 6. Обновите CORS на API

После создания Static Site скопируйте его URL (например `https://ymir-web.onrender.com`) и обновите переменные окружения в API:

- `WEB_URL` = `https://ymir-web.onrender.com`
- `CORS_ORIGINS` = `https://ymir-web.onrender.com`

Сервис API автоматически перезапустится.

---

## Шаг 7. Сидирование базы (опционально)

Для начальных данных и демо-аккаунтов, зайдите в **Shell** сервиса API на Render:

```bash
npx prisma db seed
```

Или добавьте seed в Start Command (один раз):
```
npx prisma migrate deploy && npx prisma db seed && node dist/main.js
```

> ⚠️ Уберите `npx prisma db seed` после первого деплоя, чтобы не дублировать данные.

---

## Альтернатива: render.yaml (Infrastructure as Code)

Создайте файл `render.yaml` в корне репозитория для автоматического создания всех сервисов:

```yaml
databases:
  - name: ymir-postgres
    plan: starter
    databaseName: ymir_clan_hub
    user: ymir

services:
  - type: redis
    name: ymir-redis
    plan: starter
    ipAllowList: []

  - type: web
    name: ymir-api
    runtime: node
    plan: starter
    rootDir: apps/api
    buildCommand: "npm install -g pnpm@9.15.4 && cd ../.. && pnpm install && cd apps/api && npx prisma generate && pnpm build"
    startCommand: "npx prisma migrate deploy && node dist/main.js"
    healthCheckPath: /api/v1/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: APP_PORT
        value: "3000"
      - key: DATABASE_URL
        fromDatabase:
          name: ymir-postgres
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: ymir-redis
          type: redis
          property: connectionString
      - key: JWT_ACCESS_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: JWT_ACCESS_EXPIRES_IN
        value: "15m"
      - key: JWT_REFRESH_EXPIRES_IN
        value: "7d"
      - key: WEB_URL
        fromService:
          name: ymir-web
          type: web
          property: host
      - key: CORS_ORIGINS
        value: "https://ymir-web.onrender.com"

  - type: worker
    name: ymir-worker
    runtime: node
    plan: starter
    rootDir: apps/api
    buildCommand: "npm install -g pnpm@9.15.4 && cd ../.. && pnpm install && cd apps/api && npx prisma generate && pnpm build"
    startCommand: "node dist/worker.js"
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: ymir-postgres
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: ymir-redis
          type: redis
          property: connectionString

  - type: web
    name: ymir-web
    runtime: static
    rootDir: apps/web
    buildCommand: "npm install -g pnpm@9.15.4 && cd ../.. && pnpm install && cd apps/web && pnpm build"
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_URL
        value: "https://ymir-api.onrender.com"
      - key: VITE_WS_URL
        value: "wss://ymir-api.onrender.com"
```

Затем в Render Dashboard: **New → Blueprint → Connect Repository** — все сервисы создадутся автоматически.

---

## Стоимость

| Вариант | Стоимость/мес |
|---------|---------------|
| **Free tier** (API + Frontend + PostgreSQL + Redis) | $0 (с ограничениями*) |
| **Starter** (все сервисы) | ~$28/мес |
| **Starter + Worker** | ~$35/мес |

*Free tier ограничения: сервисы засыпают через 15 мин неактивности, 90 дней для БД, 750 часов/мес.

---

## Полезные ссылки

- [Render Docs: Node.js](https://docs.render.com/node-version)
- [Render Docs: Static Sites](https://docs.render.com/static-sites)
- [Render Docs: PostgreSQL](https://docs.render.com/databases)
- [Render Docs: Redis](https://docs.render.com/redis)
- [Render Docs: Blueprints (render.yaml)](https://docs.render.com/infrastructure-as-code)
