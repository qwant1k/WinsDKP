# 🚀 Полное руководство по деплою Ymir Clan Hub

## Часть 1: Подготовка к деплою

### 1.1. Создание аккаунтов

Регистрируемся на следующих платформах:

1. **GitHub** - https://github.com/signup (если еще нет)
2. **Railway** - https://railway.app (войти через GitHub)
3. **Vercel** - https://vercel.com (войти через GitHub)
4. **Cloudflare** - https://dash.cloudflare.com/sign-up

### 1.2. Подготовка проекта

Перед пушем в GitHub нужно добавить несколько файлов:

#### Создайте `.gitignore` в корне проекта:

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
dist/
build/

# Environment
.env
.env.local
.env.production.local
.env.development.local
.env.test.local

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Prisma
apps/api/prisma/migrations/*.sql

# Docker
docker-compose.override.yml

# Misc
.turbo/
.cache/
```

#### Создайте `.env.example` для референса:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"

# Redis
REDIS_URL="redis://:password@host:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"

# OAuth (опционально)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""

# Frontend URL
FRONTEND_URL="http://localhost:5173"

# S3/MinIO/R2
S3_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_BUCKET_NAME="ymir-clan-hub"
S3_REGION="auto"

# Email (используйте Resend.com для прода)
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@yourdomain.com"

# App
NODE_ENV="production"
PORT="3000"
```

---

## Часть 2: Загрузка на GitHub из Windsurf

### 2.1. Инициализация Git в терминале Windsurf

Откройте терминал в Windsurf (Terminal → New Terminal) и выполните:

```bash
# 1. Инициализация Git (если еще не сделано)
git init

# 2. Добавление всех файлов
git add .

# 3. Первый коммит
git commit -m "Initial commit: Ymir Clan Hub production-ready"

# 4. Переименование ветки в main (если нужно)
git branch -M main
```

### 2.2. Создание репозитория на GitHub

1. Перейдите на https://github.com/new
2. Название: `ymir-clan-hub`
3. Description: `Production-ready MMORPG clan management system`
4. Выберите **Private** (если хотите скрыть код) или **Public**
5. **НЕ** добавляйте README, .gitignore, license (у вас уже есть)
6. Нажмите **Create repository**

### 2.3. Пуш в GitHub

GitHub покажет команды, но вот точная последовательность:

```bash
# Добавление remote (замените YOUR_USERNAME на ваш никнейм)
git remote add origin https://github.com/YOUR_USERNAME/ymir-clan-hub.git

# Пуш кода
git push -u origin main
```

Если попросит логин/пароль — используйте Personal Access Token:
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token → выберите `repo` scope
3. Скопируйте токен и используйте вместо пароля

### 2.4. Проверка

Обновите страницу GitHub — код должен появиться.

---

## Часть 3: Настройка Cloudflare R2 (хранилище файлов)

### 3.1. Создание бакета

1. Перейдите в Cloudflare Dashboard → R2
2. Нажмите **Create bucket**
3. Название: `ymir-clan-hub`
4. Location: **Automatic**
5. Создайте

### 3.2. Получение API ключей

1. В R2 → **Manage R2 API Tokens**
2. **Create API token**
3. Token name: `ymir-api-token`
4. Permissions: **Object Read & Write**
5. Скопируйте:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL (будет вида `https://xxxxx.r2.cloudflarestorage.com`)

Сохраните эти данные — понадобятся для Railway.

---

## Часть 4: Деплой Backend на Railway

### 4.1. Создание проекта

1. Перейдите на https://railway.app/new
2. **Deploy from GitHub repo**
3. Выберите `ymir-clan-hub`
4. Railway создаст проект

### 4.2. Добавление сервисов

#### А) PostgreSQL

1. В проекте нажмите **+ New**
2. **Database → PostgreSQL**
3. Railway автоматически создаст базу

#### Б) Redis

1. Снова **+ New**
2. **Database → Redis**
3. Railway создаст Redis

#### В) Backend (API)

1. **+ New → GitHub Repo**
2. Выберите `ymir-clan-hub`
3. В настройках сервиса:
   - **Root Directory**: `apps/api`
   - **Build Command**: `pnpm install && pnpm --filter api build`
   - **Start Command**: `pnpm --filter api start:prod`

### 4.3. Настройка переменных окружения (Backend)

В сервисе API → **Variables** добавьте:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

JWT_SECRET=<сгенерируйте сложный ключ>
JWT_REFRESH_SECRET=<сгенерируйте другой сложный ключ>

FRONTEND_URL=<оставьте пустым, добавите после деплоя Vercel>

S3_ENDPOINT=<из Cloudflare R2>
S3_ACCESS_KEY_ID=<из Cloudflare R2>
S3_SECRET_ACCESS_KEY=<из Cloudflare R2>
S3_BUCKET_NAME=ymir-clan-hub
S3_REGION=auto

NODE_ENV=production
PORT=3000

# Email (пока можно оставить пустым)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@ymirclan.com
```

**Генерация секретов:**

В терминале Windsurf выполните:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Выполните дважды для JWT_SECRET и JWT_REFRESH_SECRET.

### 4.4. Применение миграций

После деплоя, в Railway:

1. Перейдите в сервис API
2. **Settings → Deploy Triggers**
3. Добавьте **Run Command After Deploy**:

```bash
pnpm --filter api db:migrate:deploy
```

Или выполните вручную через Railway CLI (см. раздел 7).

### 4.5. Получение URL API

1. В сервисе API → **Settings**
2. **Generate Domain** — Railway создаст домен вида `ymir-api.up.railway.app`
3. Скопируйте URL

---

## Часть 5: Деплой Frontend на Vercel

### 5.1. Импорт проекта

1. Перейдите на https://vercel.com/new
2. **Import Git Repository**
3. Выберите `ymir-clan-hub`
4. Configure Project:
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/web`
   - **Build Command**: `pnpm install && pnpm --filter web build`
   - **Output Directory**: `dist`

### 5.2. Environment Variables

Добавьте переменные:

```env
VITE_API_URL=https://ymir-api.up.railway.app/api/v1
VITE_WS_URL=wss://ymir-api.up.railway.app
```

(Замените на ваш реальный Railway URL)

### 5.3. Deploy

Нажмите **Deploy** — Vercel автоматически соберет и задеплоит фронтенд.

После деплоя получите URL вида `ymir-clan-hub.vercel.app`.

### 5.4. Обновление FRONTEND_URL на Railway

1. Вернитесь в Railway → API сервис → Variables
2. Обновите `FRONTEND_URL=https://ymir-clan-hub.vercel.app`
3. Railway автоматически передеплоит

---

## Часть 6: Настройка Email (опционально)

Для продакшена рекомендую **Resend.com**:

1. Регистрация на https://resend.com
2. API Keys → Create
3. В Railway обновите переменные:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<ваш API key>
SMTP_FROM=noreply@yourdomain.com
```

---

## Часть 7: Seed данных (демо-аккаунты)

### Вариант 1: Через Railway CLI (рекомендую)

Установите Railway CLI:

```bash
# macOS/Linux
curl -fsSL https://railway.app/install.sh | sh

# Windows (PowerShell)
iwr https://railway.app/install.ps1 | iex
```

Затем:

```bash
# Логин
railway login

# Подключение к проекту
railway link

# Выполнение seed
railway run -s api pnpm --filter api db:seed
```

### Вариант 2: Temporary Shell в Railway

1. В Railway → API сервис → Settings
2. **Enable Railway Shell** (если доступно)
3. Выполните `pnpm --filter api db:seed`

### Вариант 3: Добавить seed в post-deploy скрипт

В `apps/api/package.json` добавьте:

```json
"scripts": {
  "deploy": "prisma migrate deploy && prisma db seed"
}
```

И в Railway используйте эту команду.

---

## Часть 8: Финальная проверка

### 8.1. Проверка API

Откройте в браузере:

```
https://ymir-api.up.railway.app/api/v1/health
```

Должен вернуть `{"status":"ok"}`.

### 8.2. Проверка Swagger

```
https://ymir-api.up.railway.app/api/docs
```

### 8.3. Проверка Frontend

Откройте:

```
https://ymir-clan-hub.vercel.app
```

Попробуйте залогиниться с демо-аккаунтом:
- Email: `admin@ymir.local`
- Password: `Password123!`

---

## Часть 9: Настройка кастомного домена (опционально)

### 9.1. Бесплатный домен

**Внимание**: Freenom (.tk/.ml/.ga) нестабилен, часто блокируют домены.

Лучше использовать:
- Поддомены от Railway/Vercel (уже есть)
- Или купить дешевый домен на Namecheap ($0.99/год для .xyz)

### 9.2. Если есть свой домен

#### Для Frontend (Vercel):

1. Vercel → Project Settings → Domains
2. Добавьте `yourdomain.com`
3. Настройте DNS (A/CNAME записи) у регистратора

#### Для Backend (Railway):

1. Railway → API Service → Settings → Domains
2. Добавьте `api.yourdomain.com`
3. Настройте CNAME запись у регистратора

---

## Часть 10: Continuous Deployment

После настройки каждый push в GitHub:
- **Railway** автоматически пересобирает API
- **Vercel** автоматически пересобирает Frontend

### Рабочий процесс:

```bash
# Локальные изменения
git add .
git commit -m "feat: add new feature"
git push origin main

# Railway и Vercel автоматически задеплоят через 2-3 минуты
```

---

## Часть 11: Мониторинг и логи

### Railway:

1. API сервис → **Deployments** — статусы
2. **Observability** → View Logs

### Vercel:

1. Project → **Deployments** — история
2. Выберите деплой → **View Function Logs**

---

## Часть 12: Troubleshooting

### Проблема: "Module not found" при деплое

**Решение**: Убедитесь, что в Railway:
- Root Directory установлен правильно
- Build command включает `pnpm install`

### Проблема: Миграции не применились

**Решение**: Выполните вручную через Railway CLI:

```bash
railway run -s api pnpm --filter api db:migrate:deploy
```

### Проблема: WebSocket не работает

**Решение**: Убедитесь, что:
1. В `apps/web/.env` используется `wss://` (не `ws://`)
2. CORS настроен правильно в `apps/api/src/main.ts`

### Проблема: CORS ошибки

**Решение**: Проверьте `FRONTEND_URL` в Railway соответствует Vercel URL.

---

## Часть 13: Оптимизация costs (Railway кредиты)

Railway дает $5/месяц бесплатно. Чтобы не превысить:

1. **Выключайте неиспользуемые сервисы** в настройках
2. **Sleep after 30 min of inactivity** (для тестовых проектов)
3. Мониторьте usage: Project → **Usage**

Если кредиты кончатся — добавьте карту ($5/месяц минимум).

---

## Итоговая архитектура

```
GitHub (source)
    ↓
    ├─→ Railway (API + PostgreSQL + Redis)
    │   └→ https://ymir-api.up.railway.app
    │
    └─→ Vercel (Frontend)
        └→ https://ymir-clan-hub.vercel.app

Cloudflare R2 (Storage)
    └→ S3-compatible files
```

---

## Следующие шаги

1. ✅ Настроить OAuth (Google/Discord) через их консоли
2. ✅ Подключить реальный домен
3. ✅ Настроить monitoring (Sentry, LogRocket)
4. ✅ Добавить CI/CD тесты (GitHub Actions)
5. ✅ Настроить backup БД (Railway automatic backups)

---

## Поддержка

Если возникнут проблемы при деплое:
- Railway Discord: https://discord.gg/railway
- Vercel Support: https://vercel.com/support

Удачи с деплоем! 🚀
