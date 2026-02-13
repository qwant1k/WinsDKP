# 🚀 Шпаргалка по деплою Ymir Clan Hub

## Быстрый старт (копируй-вставляй команды)

### 1. Пуш на GitHub из Windsurf

```bash
# Откройте терминал в Windsurf (Terminal → New Terminal)

# Инициализация (если еще не сделано)
git init
git add .
git commit -m "Initial commit: Ymir Clan Hub"
git branch -M main

# Добавьте ваш репозиторий (замените YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/ymir-clan-hub.git

# Отправка кода
git push -u origin main
```

**Если просит пароль:**
- Используйте Personal Access Token вместо пароля
- GitHub → Settings → Developer settings → Personal access tokens → Generate new token
- Выберите scope: `repo`

---

### 2. Генерация секретов для JWT

```bash
# В терминале Windsurf выполните дважды:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Сохраните оба ключа для Railway (JWT_SECRET и JWT_REFRESH_SECRET).

---

### 3. Порядок настройки сервисов

1. ✅ **GitHub** - загрузка кода
2. ✅ **Cloudflare R2** - создание бакета, получение API ключей
3. ✅ **Railway** - деплой API + PostgreSQL + Redis
4. ✅ **Vercel** - деплой Frontend
5. ✅ **Обновление FRONTEND_URL** в Railway
6. ✅ **Seed данных** через Railway CLI

---

### 4. Railway - Переменные окружения для API

Скопируйте и вставьте в Railway → API Service → Variables:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<вставьте сгенерированный ключ 1>
JWT_REFRESH_SECRET=<вставьте сгенерированный ключ 2>
FRONTEND_URL=<оставьте пустым, добавите после Vercel>
S3_ENDPOINT=<из Cloudflare R2>
S3_ACCESS_KEY_ID=<из Cloudflare R2>
S3_SECRET_ACCESS_KEY=<из Cloudflare R2>
S3_BUCKET_NAME=ymir-clan-hub
S3_REGION=auto
NODE_ENV=production
PORT=3000
```

---

### 5. Vercel - Переменные окружения для Frontend

Скопируйте в Vercel → Project Settings → Environment Variables:

```env
VITE_API_URL=https://ymir-api.up.railway.app/api/v1
VITE_WS_URL=wss://ymir-api.up.railway.app
```

(Замените на ваш реальный Railway URL)

---

### 6. Применение миграций и seed

После деплоя на Railway установите Railway CLI:

**macOS/Linux:**
```bash
curl -fsSL https://railway.app/install.sh | sh
```

**Windows (PowerShell):**
```powershell
iwr https://railway.app/install.ps1 | iex
```

**Затем:**
```bash
railway login
railway link  # выберите ваш проект
railway run -s api pnpm --filter api db:migrate:deploy
railway run -s api pnpm --filter api db:seed
```

---

### 7. Проверка деплоя

**API Health:**
```
https://ymir-api.up.railway.app/api/v1/health
```

**Swagger Docs:**
```
https://ymir-api.up.railway.app/api/docs
```

**Frontend:**
```
https://ymir-clan-hub.vercel.app
```

**Логин (демо):**
- Email: `admin@ymir.local`
- Password: `Password123!`

---

### 8. Continuous Deployment (авто-деплой)

После настройки просто делайте:

```bash
# Локальные изменения
git add .
git commit -m "ваше сообщение"
git push

# Railway и Vercel автоматически передеплоят
```

---

### 9. Полезные команды

**Просмотр логов:**
```bash
railway logs -s api
```

**Подключение к БД:**
```bash
railway connect postgres
```

**Выполнение команд в проде:**
```bash
railway run -s api <команда>
```

---

### 10. Стоимость (бесплатные лимиты)

| Сервис | Бесплатный план |
|--------|-----------------|
| Railway | $5 кредитов/месяц (~500 часов) |
| Vercel | Безлимит (для personal) |
| Cloudflare R2 | 10 GB storage навсегда |
| GitHub | Безлимит (public/private repos) |

**Итого:** Проект работает бесплатно (пока не превысите Railway лимиты).

---

### 11. Если что-то пошло не так

**Railway не деплоится:**
- Проверьте логи: Railway → API service → Deployments → View Logs
- Убедитесь, что все переменные окружения заданы

**Vercel выдает ошибку:**
- Проверьте Build Logs в Vercel
- Убедитесь, что Root Directory = `apps/web`

**CORS ошибки:**
- Проверьте, что FRONTEND_URL в Railway совпадает с URL Vercel

**WebSocket не работает:**
- Убедитесь, что используете `wss://` (не `ws://`)

---

### 12. Контакты поддержки

- **Railway:** https://discord.gg/railway
- **Vercel:** https://vercel.com/support
- **Cloudflare:** https://community.cloudflare.com

---

## Готово! 🎉

После выполнения всех шагов у вас будет:

✅ Код на GitHub с авто-деплоем  
✅ API на Railway с БД и Redis  
✅ Frontend на Vercel  
✅ Файлы на Cloudflare R2  
✅ HTTPS из коробки  
✅ Демо-данные для тестирования  

**URL вашего проекта:**
- Frontend: `https://ymir-clan-hub.vercel.app`
- API: `https://ymir-api.up.railway.app`
- Docs: `https://ymir-api.up.railway.app/api/docs`
