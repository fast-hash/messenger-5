# Secure Corporate Messenger (Phase 1)

Простой корпоративный мессенджер (фаза 1.5) с готовой архитектурой для будущего сквозного шифрования. Бэкенд и фронтенд разделены на каталоги `server/` и `client/`.

## 1. Требования

- Node.js 22.x
- npm
- Docker Desktop (опционально, для MongoDB в контейнере)

## 1.1 Что есть из бизнес-функций

- Профили пользователей с ролью (`doctor`, `nurse`, `admin`, `staff`), отделом и должностью.
- Поиск коллег по имени/логину/email для быстрого создания нового личного чата.
- Список чатов с превью последнего сообщения и сортировкой по активности.
- Индикаторы присутствия (online/offline) и статус «печатает...». 
- Окно переписки: сообщения в реальном времени через Socket.IO, авто‑скролл, подсветка своих сообщений.
- Архитектурная заготовка под E2E-шифрование (noopCrypto сейчас хранит plaintext).

## 2. Подготовка окружения

```powershell
# клонировать репозиторий
# git clone <repo-url>

# backend
cd server
cp .env.example .env
npm install

# frontend
cd ../client
cp .env.example .env
npm install
```

## 3. Опционально: запуск MongoDB через Docker

```powershell
cd ..
docker compose up -d
```

## 4. Запуск backend

```powershell
cd server
npm run dev
# API: http://localhost:3000
```

## 5. Запуск frontend

```powershell
cd ../client
npm run dev
# UI: http://localhost:5173
```

## 6. Быстрый smoke-test (PowerShell + curl)

```powershell
# Регистрация пользователя Alice
curl -i -X POST http://localhost:3000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"alice\",\"email\":\"alice@mail.local\",\"password\":\"123654Aa\",\"displayName\":\"Alice\"}"

# Логин
curl -i -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"alice@mail.local\",\"password\":\"123654Aa\"}"

# После логина cookie сохранится, можно вызывать /api/auth/me
```

## Структура

- `server/` — Express + MongoDB API, Socket.IO, слои моделей/сервисов/роутов с абстракцией шифрования
- `client/` — Vite + React UI, Zustand, Socket.IO клиент
- `docker-compose.yml` — MongoDB 8.0 для локальной разработки

## 7. Что увидеть в интерфейсе

- Светлый «корпоративный» UI: слева список чатов с индикатором онлайн‑статуса и последним сообщением, справа окно переписки.
- В хедере — название приложения, имя пользователя, его роль и отдел, кнопка выхода.
- Кнопка «Новый чат» открывает поиск коллег; найденного пользователя можно выбрать, чтобы создать/открыть диалог.
- В окне чата видно, печатает ли собеседник, и статус его присутствия (online/offline).
