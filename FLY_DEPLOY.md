# Деплой Ymir Clan Hub на Fly.io

## Архитектура

| Сервис | Тип в Fly.io | Стоимость |
|--------|-------------|-----------|
| **PostgreSQL** | Fly Postgres (managed) | Free (1GB) / $1.94+/мес |
| **Redis** | Upstash Redis (интеграция) | Free (10K cmd/день) |
| **API (NestJS)** | Machine (Docker) | Free (shared-1x) / ~$3.19/мес |
| **Frontend (React)** | Machine (Docker + nginx) | Free (shared-1x) / ~$1.94/мес |

> **Fly.io Free Allowance**: 3 shared-cpu-1x VMs (256MB), 3GB persistent volumes, 160GB outbound transfer.

---

## Предварительные требования

### 1. Установить flyctl

**Windows (PowerShell)**:
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**macOS/Linux**:
```bash
curl -L https://fly.io/install.sh | sh
```

### 2. Авторизация

```bash
fly auth signup   # регистрация
# или
fly auth login    # если уже есть аккаунт
```

---

## Шаг 1. Создание PostgreSQL

```bash
fly postgres create \
  --name ymir-db \
  --region ams \
  --vm-size shared-cpu-1x \
  --volume-size 1 \
  --initial-cluster-size 1
```

> Запишите **connection string** из вывода. Формат:
> `postgres://postgres:PASSWORD@ymir-db.flycast:5432/ymir_db?sslmode=disable`

Создайте базу данных:
```bash
fly postgres connect -a ymir-db
```
В psql-консоли:
```sql
CREATE DATABASE ymir_clan_hub;
\q
```

---

## Шаг 2. Создание Redis (Upstash)

```bash
fly redis create \
  --name ymir-redis \
  --region ams \
  --no-eviction
```

> Запишите **REDIS_URL** из вывода. Формат:
> `redis://default:PASSWORD@fly-ymir-redis.upstash.io:6379`

---

## Шаг 3. Деплой API

### 3.1 Создайте приложение

```bash
fly apps create ymir-api --machines
```

### 3.2 Привяжите PostgreSQL к API

```bash
fly postgres attach ymir-db -a ymir-api
```

Это автоматически установит `DATABASE_URL` в секреты приложения.

### 3.3 Установите секреты

```bash
fly secrets set -a ymir-api \
  REDIS_URL="redis://default:PASSWORD@fly-ymir-redis.upstash.io:6379" \
  REDIS_HOST="fly-ymir-redis.upstash.io" \
  REDIS_PORT="6379" \
  JWT_ACCESS_SECRET="$(openssl rand -hex 32)" \
  JWT_REFRESH_SECRET="$(openssl rand -hex 32)" \
  JWT_ACCESS_EXPIRES_IN="15m" \
  JWT_REFRESH_EXPIRES_IN="7d" \
  WEB_URL="https://ymir-web.fly.dev" \
  CORS_ORIGINS="https://ymir-web.fly.dev" \
  SMTP_HOST="smtp.resend.com" \
  SMTP_PORT="587" \
  SMTP_USER="resend" \
  SMTP_PASS="re_YOUR_API_KEY" \
  SMTP_FROM="noreply@yourdomain.com"
```

> ⚠️ Замените значения REDIS_URL, SMTP_* на реальные.
> Для SMTP можно использовать [Resend](https://resend.com) (бесплатно 100 писем/день).

### 3.4 Деплой

```bash
fly deploy --config apps/api/fly.toml
```

> При первом деплое `release_command` автоматически запустит `npx prisma migrate deploy`.

### 3.5 Сидирование базы (опционально)

```bash
fly ssh console -a ymir-api -C "npx prisma db seed"
```

Демо-аккаунты (пароль `Password123!`):
- `admin@ymir.local` — Админ портала
- `leader@ymir.local` — Лидер клана
- `elder@ymir.local` — Старейшина
- `member@ymir.local` — Участник
- `newbie@ymir.local` — Новичок

---

## Шаг 4. Деплой Frontend

### 4.1 Создайте приложение

```bash
fly apps create ymir-web --machines
```

### 4.2 Деплой

```bash
fly deploy --config apps/web/fly.toml \
  --build-arg VITE_API_URL=https://ymir-api.fly.dev \
  --build-arg VITE_WS_URL=wss://ymir-api.fly.dev
```

---

## Шаг 5. Проверка

```bash
# Проверить статус приложений
fly status -a ymir-api
fly status -a ymir-web

# Health check API
curl https://ymir-api.fly.dev/api/v1/health/live

# Логи API
fly logs -a ymir-api

# Логи Web
fly logs -a ymir-web
```

Откройте в браузере:
- **Frontend**: https://ymir-web.fly.dev
- **API Docs**: https://ymir-api.fly.dev/api/docs

---

## Обновление (последующие деплои)

```bash
# Запушить изменения в GitHub
git add -A && git commit -m "feat: update" && git push

# Деплой API (миграции применятся автоматически)
fly deploy --config apps/api/fly.toml

# Деплой Frontend
fly deploy --config apps/web/fly.toml \
  --build-arg VITE_API_URL=https://ymir-api.fly.dev \
  --build-arg VITE_WS_URL=wss://ymir-api.fly.dev
```

---

## Масштабирование

```bash
# Увеличить RAM для API
fly scale memory 512 -a ymir-api

# Добавить вторую машину API
fly scale count 2 -a ymir-api

# Переключить на dedicated CPU
fly scale vm shared-cpu-2x -a ymir-api
```

---

## Кастомный домен

```bash
# Для API
fly certs add api.yourdomain.com -a ymir-api

# Для Web
fly certs add yourdomain.com -a ymir-web
fly certs add www.yourdomain.com -a ymir-web
```

Добавьте CNAME-записи в DNS:
```
api.yourdomain.com    → ymir-api.fly.dev
yourdomain.com        → ymir-web.fly.dev
www.yourdomain.com    → ymir-web.fly.dev
```

После привязки домена обновите переменные API:
```bash
fly secrets set -a ymir-api \
  WEB_URL="https://yourdomain.com" \
  CORS_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
```

---

## CI/CD с GitHub Actions

Создайте файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --config apps/api/fly.toml --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  deploy-web:
    runs-on: ubuntu-latest
    needs: deploy-api
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: >
          flyctl deploy --config apps/web/fly.toml --remote-only
          --build-arg VITE_API_URL=https://ymir-api.fly.dev
          --build-arg VITE_WS_URL=wss://ymir-api.fly.dev
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

Получите токен:
```bash
fly tokens create deploy -x 999999h
```

Добавьте его в GitHub: **Settings → Secrets → Actions → New** → `FLY_API_TOKEN`.

---

## Стоимость

| Вариант | Стоимость/мес |
|---------|---------------|
| **Free tier** (2 apps + Postgres 1GB + Upstash Redis) | **$0** |
| **Starter** (512MB API + 256MB Web + 1GB Postgres) | ~$7/мес |
| **Production** (1GB API ×2 + Web + 10GB Postgres + Redis) | ~$25/мес |

---

## Команды-шпаргалка

```bash
fly status -a ymir-api       # статус
fly logs -a ymir-api          # логи
fly ssh console -a ymir-api   # SSH в контейнер
fly postgres connect -a ymir-db  # psql-консоль
fly secrets list -a ymir-api  # список секретов
fly scale show -a ymir-api    # текущие ресурсы
fly dashboard -a ymir-api     # открыть dashboard
```
