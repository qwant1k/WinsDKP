# Ymir Clan Hub

**Production-ready веб-система для управления кланом в MMORPG "Legend of Ymir"**

![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![NestJS](https://img.shields.io/badge/NestJS-11-red)
![React](https://img.shields.io/badge/React-19-61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)

## Возможности

- **DKP-экономика** — прозрачное начисление/списание с полным аудитом
- **Live-аукционы** — ставки в реальном времени с anti-sniper защитой
- **Рандомайзер** — честный розыгрыш с приоритетом слабым игрокам, аудируемый алгоритм
- **Управление кланом** — роли, заявки, штрафы, хранилище
- **Активности** — рейды, экспедиции с автоматическим начислением DKP
- **Соцсеть** — новости, лента, комментарии, реакции
- **Админ-панель** — полный контроль над всеми сущностями
- **Real-time** — WebSocket уведомления, чат аукциона

## Технологический стек

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Backend | NestJS 11 (Fastify) + Prisma + PostgreSQL 16 |
| Frontend | React 19 + Vite + TailwindCSS + TanStack Query |
| Realtime | Socket.IO (Redis adapter ready) |
| Cache/Queue | Redis 7 + BullMQ |
| Storage | MinIO (S3-compatible) |
| Auth | JWT (access+refresh) + OAuth2 (Google, Discord) |

## Быстрый старт

### Требования

- Docker & Docker Compose
- Node.js ≥ 24 (для локальной разработки)
- pnpm ≥ 9.15

### Запуск одной командой

```bash
# 1. Клонировать и перейти в директорию
cd ymir-clan-hub

# 2. Скопировать конфиг
cp .env.example .env

# 3. Запустить всё
make init
```

Это запустит:
- **PostgreSQL** на порту 5432
- **Redis** на порту 6379
- **MinIO** на портах 9000/9001
- **Mailpit** на портах 1025/8025
- **API** на порту 3000
- **Web** на порту 5173
- **Nginx** на порту 80

### Доступ

| Сервис | URL |
|--------|-----|
| Web App | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/api/docs |
| Mailpit | http://localhost:8025 |
| MinIO Console | http://localhost:9001 |

### Демо-аккаунты

Пароль для всех: `Password123!`

| Роль | Email |
|------|-------|
| Portal Admin | admin@ymir.local |
| Clan Leader | leader@ymir.local |
| Elder | elder@ymir.local |
| Member | member@ymir.local |
| Newbie | newbie@ymir.local |

## Команды

```bash
make up        # Запуск контейнеров
make down      # Остановка
make init      # Полная инициализация (up + migrate + seed)
make test      # Запуск тестов
make lint      # Линтинг
make seed      # Пересидирование БД
make logs      # Просмотр логов
make clean     # Полная очистка (volumes + images)
make migrate   # Применение миграций
make studio    # Prisma Studio
```

## Локальная разработка (без Docker)

```bash
# Установка зависимостей
pnpm install

# Генерация Prisma клиента
pnpm db:generate

# Миграции
pnpm db:migrate

# Сидирование
pnpm db:seed

# Запуск в dev-режиме
pnpm dev
```

## Архитектура

```
ymir-clan-hub/
├── apps/
│   ├── api/              # NestJS backend
│   │   ├── prisma/       # Schema, migrations, seed
│   │   └── src/
│   │       ├── common/   # Prisma, Redis, Socket, Guards, Decorators
│   │       └── modules/  # Feature modules
│   │           ├── auth/
│   │           ├── users/
│   │           ├── clans/
│   │           ├── dkp/
│   │           ├── activities/
│   │           ├── auctions/
│   │           ├── randomizer/
│   │           ├── warehouse/
│   │           ├── news/
│   │           ├── feed/
│   │           ├── notifications/
│   │           ├── audit/
│   │           ├── admin/
│   │           └── health/
│   └── web/              # React frontend
│       └── src/
│           ├── components/
│           ├── lib/
│           ├── pages/
│           └── stores/
├── infra/
│   └── nginx/
├── docker-compose.yml
├── Makefile
└── .env.example
```

## Модули

### Auth
- Email+password, OAuth (Google, Discord)
- JWT access+refresh с ротацией
- Email verification, password reset
- Logout all sessions

### Clans
- Заявки на вступление с одобрением
- Роли: clan_leader, elder, member, newbie
- Управление участниками, штрафы, исключение

### DKP Economy
- Атомарные транзакции (Serializable isolation)
- Hold/finalize/release для аукционов
- Коэффициенты по БМ и уровню
- Полная история транзакций

### Auctions (Live)
- Realtime ставки через WebSocket
- Anti-sniper защита (настраиваемые N/M)
- Автоставки
- Чат аукциона
- Атомарное списание DKP

### Randomizer
- Детерминистический алгоритм (seed + SHA-256)
- Приоритет слабым (bonus ∈ [0.03, 0.05])
- Полная аудируемость (seed, hash, weights, proof)
- Идемпотентность по session_id

### Warehouse
- CRUD предметов с редкостью
- Движения: приход/расход/возврат/списание
- Интеграция с аукционом и рандомайзером

## API

- Versioned: `/api/v1`
- OpenAPI/Swagger: `/api/docs`
- Единый формат ошибок
- Пагинация, фильтрация, сортировка
- Идемпотентность через `X-Idempotency-Key`

## Безопасность

- Helmet + secure headers
- CORS + CSRF protection
- Rate limiting
- Argon2id / scrypt password hashing
- JWT + refresh token rotation
- RBAC/ABAC guards на backend
- Immutable audit trail
- Input validation (class-validator + Zod)

## Timezone

- БД хранит UTC
- Отображение в Asia/Almaty

## Лицензия

Proprietary — Ymir Clan Hub © 2025
