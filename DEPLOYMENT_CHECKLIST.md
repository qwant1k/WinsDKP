# ✅ Чеклист деплоя Ymir Clan Hub

Используйте этот чеклист для пошагового деплоя проекта.

---

## Подготовка (5 минут)

- [ ] Создан аккаунт GitHub
- [ ] Создан аккаунт Railway (через GitHub)
- [ ] Создан аккаунт Vercel (через GitHub)
- [ ] Создан аккаунт Cloudflare
- [ ] Установлен Git на компьютере
- [ ] Проект открыт в Windsurf

---

## Шаг 1: Подготовка проекта (10 минут)

### 1.1. Добавление конфигов в проект

Скопируйте следующие файлы в корень проекта:

- [ ] `.gitignore` (из DEPLOYMENT_GUIDE.md)
- [ ] `railway.json` (опционально)
- [ ] `vercel.json` (опционально)
- [ ] `nixpacks.toml` (опционально)
- [ ] `.github/workflows/ci.yml` (опционально, для автотестов)

### 1.2. Проверка структуры

Убедитесь, что структура проекта выглядит так:

```
ymir-clan-hub/
├── .gitignore
├── railway.json
├── vercel.json
├── nixpacks.toml
├── README.md
├── .env.example
├── apps/
│   ├── api/
│   └── web/
└── .github/
    └── workflows/
        └── ci.yml
```

---

## Шаг 2: GitHub (15 минут)

### 2.1. Генерация JWT секретов

В терминале Windsurf выполните дважды:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

- [ ] Скопирован JWT_SECRET
- [ ] Скопирован JWT_REFRESH_SECRET

### 2.2. Инициализация Git

```bash
git init
git add .
git commit -m "Initial commit: Ymir Clan Hub production-ready"
git branch -M main
```

- [ ] Git инициализирован
- [ ] Код закоммичен

### 2.3. Создание репозитория на GitHub

1. Перейдите на https://github.com/new
2. Название: `ymir-clan-hub`
3. Private или Public (на ваш выбор)
4. НЕ добавляйте README, .gitignore, license

- [ ] Репозиторий создан на GitHub

### 2.4. Пуш кода

```bash
git remote add origin https://github.com/YOUR_USERNAME/ymir-clan-hub.git
git push -u origin main
```

- [ ] Код загружен на GitHub
- [ ] Репозиторий виден на GitHub.com

---

## Шаг 3: Cloudflare R2 (10 минут)

### 3.1. Создание бакета

1. Cloudflare Dashboard → R2
2. Create bucket → `ymir-clan-hub`
3. Location: Automatic

- [ ] Бакет создан

### 3.2. Получение API ключей

1. R2 → Manage R2 API Tokens
2. Create API token → `ymir-api-token`
3. Permissions: Object Read & Write
4. Скопируйте:

- [ ] Access Key ID сохранен
- [ ] Secret Access Key сохранен
- [ ] Endpoint URL сохранен (вида `https://xxxxx.r2.cloudflarestorage.com`)

---

## Шаг 4: Railway - Backend (20 минут)

### 4.1. Создание проекта

1. https://railway.app/new
2. Deploy from GitHub repo
3. Выберите `ymir-clan-hub`

- [ ] Проект создан в Railway

### 4.2. Добавление PostgreSQL

1. В проекте → + New
2. Database → PostgreSQL

- [ ] PostgreSQL создан
- [ ] Скопирован `DATABASE_URL` (Railway автоматически создаст переменную)

### 4.3. Добавление Redis

1. + New
2. Database → Redis

- [ ] Redis создан
- [ ] Скопирован `REDIS_URL` (Railway автоматически создаст переменную)

### 4.4. Настройка Backend сервиса

1. + New → GitHub Repo
2. Выберите `ymir-clan-hub`
3. Settings:
   - Root Directory: `apps/api`
   - Build Command: `pnpm install && pnpm --filter api build`
   - Start Command: `pnpm --filter api start:prod`

- [ ] Backend сервис создан

### 4.5. Добавление переменных окружения

В сервисе API → Variables добавьте:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<ваш ключ 1>
JWT_REFRESH_SECRET=<ваш ключ 2>
FRONTEND_URL=
S3_ENDPOINT=<из Cloudflare>
S3_ACCESS_KEY_ID=<из Cloudflare>
S3_SECRET_ACCESS_KEY=<из Cloudflare>
S3_BUCKET_NAME=ymir-clan-hub
S3_REGION=auto
NODE_ENV=production
PORT=3000
```

- [ ] Все переменные добавлены
- [ ] FRONTEND_URL оставлен пустым (заполним позже)

### 4.6. Деплой и получение URL

1. Railway автоматически задеплоит
2. Settings → Generate Domain

- [ ] Деплой успешен (зеленый статус)
- [ ] Получен URL вида `ymir-api.up.railway.app`
- [ ] URL сохранен

### 4.7. Проверка API

Откройте в браузере:

```
https://ymir-api.up.railway.app/api/v1/health
```

- [ ] Возвращает `{"status":"ok"}`

---

## Шаг 5: Vercel - Frontend (15 минут)

### 5.1. Импорт проекта

1. https://vercel.com/new
2. Import Git Repository
3. Выберите `ymir-clan-hub`

- [ ] Проект импортирован

### 5.2. Настройка

Configure Project:
- Framework Preset: **Vite**
- Root Directory: `apps/web`
- Build Command: `pnpm install && pnpm --filter web build`
- Output Directory: `dist`

- [ ] Настройки заданы

### 5.3. Environment Variables

Добавьте:

```env
VITE_API_URL=https://ymir-api.up.railway.app/api/v1
VITE_WS_URL=wss://ymir-api.up.railway.app
```

(Замените на ваш реальный Railway URL)

- [ ] Переменные добавлены

### 5.4. Deploy

Нажмите Deploy

- [ ] Деплой успешен
- [ ] Получен URL вида `ymir-clan-hub.vercel.app`
- [ ] URL сохранен

### 5.5. Проверка Frontend

Откройте:

```
https://ymir-clan-hub.vercel.app
```

- [ ] Сайт открывается
- [ ] Дизайн загружается корректно

---

## Шаг 6: Финализация (10 минут)

### 6.1. Обновление FRONTEND_URL

1. Railway → API сервис → Variables
2. Обновите `FRONTEND_URL=https://ymir-clan-hub.vercel.app`

- [ ] FRONTEND_URL обновлен
- [ ] Railway автоматически передеплоил

### 6.2. Применение миграций

Установите Railway CLI:

**macOS/Linux:**
```bash
curl -fsSL https://railway.app/install.sh | sh
```

**Windows:**
```powershell
iwr https://railway.app/install.ps1 | iex
```

Затем:

```bash
railway login
railway link
railway run -s api pnpm --filter api db:migrate:deploy
```

- [ ] Railway CLI установлен
- [ ] Миграции применены успешно

### 6.3. Seed демо-данных

```bash
railway run -s api pnpm --filter api db:seed
```

- [ ] Демо-данные загружены

### 6.4. Проверка логина

Откройте `https://ymir-clan-hub.vercel.app` и попробуйте войти:

- Email: `admin@ymir.local`
- Password: `Password123!`

- [ ] Логин работает
- [ ] Главная страница загружается
- [ ] Навигация работает

---

## Шаг 7: Дополнительно (опционально)

### 7.1. Настройка Email (Resend.com)

1. Регистрация на https://resend.com
2. API Keys → Create
3. В Railway обновите:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<ваш API key>
SMTP_FROM=noreply@yourdomain.com
```

- [ ] Email настроен (опционально)

### 7.2. OAuth (Google/Discord)

**Google:**
1. https://console.cloud.google.com
2. Create Project → APIs & Services → Credentials
3. OAuth 2.0 Client ID
4. Добавьте в Railway:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

- [ ] Google OAuth настроен (опционально)

**Discord:**
1. https://discord.com/developers/applications
2. New Application → OAuth2
3. Добавьте в Railway:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`

- [ ] Discord OAuth настроен (опционально)

### 7.3. Кастомный домен

**Frontend (Vercel):**
1. Project Settings → Domains
2. Добавьте `yourdomain.com`
3. Настройте DNS у регистратора

- [ ] Кастомный домен настроен (опционально)

**Backend (Railway):**
1. API Service → Settings → Domains
2. Добавьте `api.yourdomain.com`
3. Настройте CNAME у регистратора

- [ ] API на кастомном домене (опционально)

---

## Финальная проверка

- [ ] API работает: `https://ymir-api.up.railway.app/api/v1/health`
- [ ] Swagger доступен: `https://ymir-api.up.railway.app/api/docs`
- [ ] Frontend работает: `https://ymir-clan-hub.vercel.app`
- [ ] Логин через демо-аккаунт работает
- [ ] WebSocket подключается (если используется)
- [ ] Загрузка файлов работает (если используется)

---

## Continuous Deployment

После успешного деплоя каждый `git push` будет автоматически деплоить проект:

```bash
git add .
git commit -m "feat: new feature"
git push
```

- [ ] Автодеплой настроен

---

## Мониторинг

### Railway:
- [ ] Deployments — смотрим статусы
- [ ] Observability → Logs — смотрим логи

### Vercel:
- [ ] Deployments — история деплоев
- [ ] Function Logs — логи функций

---

## Поддержка

Если что-то не работает:
- Railway Discord: https://discord.gg/railway
- Vercel Support: https://vercel.com/support

---

## 🎉 Готово!

Если все пункты отмечены — ваш проект успешно задеплоен и доступен в интернете!

**Ваши URL:**
- Frontend: `https://ymir-clan-hub.vercel.app`
- API: `https://ymir-api.up.railway.app`
- Docs: `https://ymir-api.up.railway.app/api/docs`

**Демо-логин:**
- Email: `admin@ymir.local`
- Password: `Password123!`
