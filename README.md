# Restaurant Table Booking

Энэхүү төсөл нь рестораны ширээ захиалгын систем юм. **pnpm workspace** (monorepo) бүтэцтэй бөгөөд дотроо API сервер (Express + Socket.IO + Drizzle/PostgreSQL), хэрэглэгчийн вэб апп (React + Vite) болон UI-н макет (mockup-sandbox) гэсэн гурван үндсэн apps-тай.

---

## 1. Шаардлагатай орчин (Prerequisites)

Дараах хэрэгсэлүүд **заавал** суусан байх шаардлагатай:

| Хэрэгсэл | Хувилбар | Тайлбар |
|---|---|---|
| **Node.js** | `>= 20.x` | https://nodejs.org/ |
| **pnpm** | `>= 9.x` | `npm install -g pnpm` |
| **PostgreSQL** | `>= 14` | Локал эсвэл Docker-ээр ажиллуулна |
| **Git** | сүүлийн | Source code татах |

> Windows дээр **Bash** (Git Bash, WSL, эсвэл PowerShell) ашиглаж болно. Доорх командууд нь cross-platform байхаар бичигдсэн.

---

## 2. Төслийн бүтэц (File / Folder Layout)

```
Restaurant-Table-Booking-1/
├── package.json                  # Монорепогийн root package
├── pnpm-workspace.yaml           # Workspace тохиргоо (artifacts/*, lib/*)
├── tsconfig.base.json            # Бүх sub-package-ийн нийтлэг TS тохиргоо
│
├── artifacts/                    # Ажиллах боломжтой apps
│   ├── api-server/               # ⭐ BACKEND — Express + Socket.IO API
│   │   ├── .env                  # Орчны хувьсагчид (PORT, DATABASE_URL, JWT_SECRET)
│   │   ├── build.mjs             # esbuild bundler config
│   │   ├── seed.ts               # DB-г жишээ өгөгдлөөр дүүргэх скрипт
│   │   ├── package.json          # Сервер dependencies + dev/build/start scripts
│   │   ├── src/
│   │   │   ├── index.ts          # HTTP + Socket.IO сервер эхлэх entry point
│   │   │   ├── app.ts            # Express app, middleware-үүд холбогдох газар
│   │   │   ├── lib/              # Logger, helper-үүд
│   │   │   ├── middlewares/      # Auth, error handling гэх мэт
│   │   │   └── routes/           # API endpoint-ууд (доороос үзнэ үү)
│   │   ├── dist/                 # Build-ийн гаралт (`pnpm run build`)
│   │   ├── uploads/              # Хэрэглэгчийн оруулсан зураг хадгалах folder
│   │   ├── thesis/               # LaTeX дипломын материал
│   │   └── paper/                # Эрдэм шинжилгээний цаас
│   │
│   ├── restaurant-app/           # ⭐ FRONTEND — React + Vite клиент
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── package.json
│   │   ├── public/               # Статик файл
│   │   └── src/                  # React компонент, page-үүд, store
│   │
│   └── mockup-sandbox/           # UI макетын dev sandbox
│       ├── vite.config.ts
│       ├── mockupPreviewPlugin.ts
│       └── src/
│
├── lib/                          # Workspace-ийн дотоод сангууд
│   ├── db/                       # Drizzle ORM + PostgreSQL schema
│   │   ├── drizzle.config.ts     # Migration / push тохиргоо
│   │   ├── package.json          # `pnpm run push` — schema-г DB рүү түлхэх
│   │   └── src/
│   │       ├── index.ts          # DB client export
│   │       └── schema/           # Хүснэгтийн тодорхойлолтууд
│   ├── api-zod/                  # Zod schema-ууд (validation)
│   ├── api-spec/                 # API-ийн нэгдсэн contract
│   └── api-client-react/         # React-д зориулсан API клиент
│
└── scripts/                      # Туслах скриптүүд (post-merge.sh гэх мэт)
```

### API-ийн route-ууд ([artifacts/api-server/src/routes/](artifacts/api-server/src/routes/))

| Файл | Зориулалт |
|---|---|
| [auth.ts](artifacts/api-server/src/routes/auth.ts) | Нэвтрэх / бүртгүүлэх / JWT |
| [menu.ts](artifacts/api-server/src/routes/menu.ts) | Хоолны цэс |
| [tables.ts](artifacts/api-server/src/routes/tables.ts) | Ширээний CRUD |
| [reservations.ts](artifacts/api-server/src/routes/reservations.ts) | Ширээний захиалга |
| [orders.ts](artifacts/api-server/src/routes/orders.ts) | Захиалга / order |
| [customers.ts](artifacts/api-server/src/routes/customers.ts) | Хэрэглэгчийн мэдээлэл |
| [reviews.ts](artifacts/api-server/src/routes/reviews.ts) | Сэтгэгдэл |
| [banners.ts](artifacts/api-server/src/routes/banners.ts) | Нүүр хуудасны баннер |
| [reports.ts](artifacts/api-server/src/routes/reports.ts) | Тайлан |
| [settings.ts](artifacts/api-server/src/routes/settings.ts) | Системийн тохиргоо |
| [upload.ts](artifacts/api-server/src/routes/upload.ts) | Файл upload (multer) |
| [health.ts](artifacts/api-server/src/routes/health.ts) | Health-check endpoint |

---

## 3. Анхны суулгалт (First-time setup)

Төслийн **root folder** (Restaurant-Table-Booking-1) дээр зогсож байгаа гэж үзэн:

### 3.1. Dependencies суулгах

```bash
pnpm install
```

> Энэ нь `artifacts/*` болон `lib/*` доторх бүх workspace-ийн dependencies-ийг нэг дор татна.

### 3.2. PostgreSQL DB үүсгэх

Локал PostgreSQL дээр дараах нэртэй database үүсгэнэ:

```sql
CREATE DATABASE restaurant_db;
```

Default user/password нь [.env](artifacts/api-server/.env) дотор:

```env
PORT=8080
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/restaurant_db
JWT_SECRET=postgres123
```

> Хэрэв та өөр user/password ашигладаг бол [.env](artifacts/api-server/.env)-г засна. Production-д **JWT_SECRET-ийг заавал солих**.

### 3.3. DB schema-г түлхэх (migrate)

```bash
cd lib/db
pnpm run push
```

> Энэ команд нь [lib/db/src/schema/](lib/db/src/schema/) доторх Drizzle schema-г бодит DB-д үүсгэнэ. Хэрэв conflict гарвал `pnpm run push-force`.

### 3.4. Жишээ өгөгдөл (seed) — заавал биш

```bash
cd artifacts/api-server
node --env-file=.env --experimental-strip-types seed.ts
```

---

## 4. Сервер ажиллуулах (Development)

### 4.1. API сервер (Backend)

```bash
cd artifacts/api-server
pnpm run dev
```

Юу болох вэ:
1. `NODE_ENV=development` болгож тавина
2. `pnpm run build` → [build.mjs](artifacts/api-server/build.mjs) ажиллаж `dist/index.mjs` үүсгэнэ
3. `pnpm run start` → `node --env-file=.env ./dist/index.mjs`-г ажиллуулна
4. Сервер `http://localhost:8080` дээр Express + Socket.IO-той хамт босно

> Зөвхөн build хийх бол `pnpm run build`, зөвхөн ажиллуулах бол `pnpm run start`.

### 4.2. Restaurant app (Frontend)

**Шинэ terminal нээгээд:**

```bash
cd artifacts/restaurant-app
pnpm run dev
```

- Vite dev server `http://localhost:5173` (default) дээр асна
- Hot Module Reload идэвхтэй
- Production build: `pnpm run build` → `dist/`
- Build-сэн хувилбарыг preview хийх: `pnpm run serve`

### 4.3. Mockup sandbox (UI макет)

```bash
cd artifacts/mockup-sandbox
pnpm run dev
```

---

## 5. Бүтэн системийг нэг дор ажиллуулах дараалал

```
Terminal 1:  cd artifacts/api-server     && pnpm run dev   # backend  :8080
Terminal 2:  cd artifacts/restaurant-app && pnpm run dev   # frontend :5173
```

Эхлээд **PostgreSQL ажиллаж байгаа эсэхийг** шалга. Дараа нь backend, тэгээд frontend-г ажиллуулна.

---

## 6. Type-check & Build

Бүх workspace-ийн TypeScript-г шалгах:

```bash
pnpm run typecheck
```

Бүгдийг build хийх:

```bash
pnpm run build
```

---

## 7. Түгээмэл алдаа (Troubleshooting)

| Алдаа | Шийдэл |
|---|---|
| `PORT environment variable is required` | [artifacts/api-server/.env](artifacts/api-server/.env) файл байгаа эсэх, `PORT=8080` мөр байгаа эсэхийг шалга |
| `ECONNREFUSED ... 5432` | PostgreSQL ажиллаж байхгүй байна. Service-ийг асаа |
| `password authentication failed` | [.env](artifacts/api-server/.env)-ийн `DATABASE_URL` доторх user/password-ыг засаарай |
| `relation "..." does not exist` | `cd lib/db && pnpm run push` хийгээгүй байна |
| `pnpm: command not found` | `npm install -g pnpm` |
| Frontend нь API-тай холбогдохгүй байна | Backend `:8080`-д ажиллаж байгаа эсэх, CORS, Vite proxy тохиргоог шалга |

---

## 8. Үндсэн порт-ууд (Default ports)

| Service | Port | URL |
|---|---|---|
| API server | `8080` | http://localhost:8080 |
| Restaurant app (Vite) | `5173` | http://localhost:5173 |
| Mockup sandbox (Vite) | `5174` | http://localhost:5174 |
| PostgreSQL | `5432` | localhost:5432 |

---

## 9. Хурдан эхлэх (TL;DR)

```bash
# 1. Dependencies
pnpm install

# 2. DB schema (PostgreSQL ажиллаж байх ёстой)
cd lib/db && pnpm run push && cd ../..

# 3. Backend асаах
cd artifacts/api-server && pnpm run dev
# → http://localhost:8080

# 4. Шинэ terminal — Frontend асаах
cd artifacts/restaurant-app && pnpm run dev
# → http://localhost:5173
```
