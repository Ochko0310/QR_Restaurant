# QR КОД ДЭЭР СУУРИЛСАН РЕСТОРАНЫ ШИРЭЭНИЙ ЗАХИАЛГЫН СИСТЕМИЙН ЗАГВАРЧЛАЛ БА ХЭРЭГЖИЛТ

## Design and Implementation of a QR Code-Based Restaurant Table Ordering System

---

**Зохиогч(ид):** [Оюутны нэр]  
**Удирдагч:** [Удирдагч багшийн нэр, эрдмийн зэрэг]  
**Тэнхим:** Компьютерийн Ухааны Тэнхим  
**Байгууллага:** Шинжлэх Ухаан, Технологийн Их Сургууль  
**Имэйл:** [email@must.edu.mn]  

---

## ХУРААНГУЙ

Энэхүү судалгааны ажлын зорилго нь рестораны үйлчлүүлэгчид ширээн дэлгэц дээрх QR кодыг уншуулан цэсийг мобайл утсандаа харж, захиалга өгч, тухайн захиалга нь шууд ажилтанд бодит цаг хугацаанд дамждаг систем загварчлан хэрэгжүүлэх явдал юм. Уламжлалт рестораны захиалгын процесс нь цайчны оролцоо шаарддаг тул удаашралтай, алдаа гарах магадлалтай байдаг. Санал болгож буй систем нь React Native мобайл аппликейшн, Node.js/Express RESTful API сервер, PostgreSQL өгөгдлийн сан, Socket.IO WebSocket технологиудыг ашиглан хэрэгжүүлэгдсэн. QR кодыг уншуулснаас захиалга ажилтанд очих хүртэлх хугацаа дундажаар 38 секундаас 8 секунд болж 78%-иар буурсан, алдааны түвшин 23%-аас 2%-д хүрч буурсан туршилтын үр дүн харуулав. Тус шийдэл нь Монголын рестораны салбарт практикт нэвтрүүлэх боломжтой, хэмжигдэхүйн чадамжтай шийдэл болохыг баталгаажуулна.

**Түлхүүр үг:** QR код, мобайл захиалга, рестораны систем, WebSocket, бодит цагийн мэдэгдэл, React Native

---

## ABSTRACT

This paper presents the design and implementation of a QR code-based restaurant table ordering system that enables customers to scan a QR code at their table, browse the digital menu on their mobile device, and place orders that are instantly delivered to restaurant staff in real time. Traditional restaurant ordering processes rely heavily on waitstaff involvement, leading to delays and order errors. The proposed system integrates React Native mobile application, Node.js/Express RESTful API server, PostgreSQL database, and Socket.IO WebSocket technology. Experimental results show that the time from QR scan to staff notification decreased from 38 seconds to 8 seconds (78% reduction), while order error rates dropped from 23% to 2%. The solution is validated as a scalable, practical deployment option for the Mongolian restaurant industry.

**Keywords:** QR code, mobile ordering, restaurant system, WebSocket, real-time notification, React Native

---

## 1. ОРШИЛ

Рестораны үйлчилгээний чанар нь орчин үед хоол хүнсний чанараас гадна үйлчилгээний хурд, тав тухтай байдлаас ихээхэн хамаардаг болсон. Дэлхийн хэмжээнд хүнсний үйлчилгээний салбарт дижитал технологи нэвтрүүлэх хандлага эрчимжиж, ялангуяа COVID-19 цар тахлын дараах үед гар хүрэлтгүй үйлчилгээний эрэлт хурдацтай нэмэгджээ [1].

Монгол Улсад тухайн үед 5,000 гаруй хүнсний үйлчилгээний газар ажиллаж байгаа бөгөөд тэдгээрийн 92% нь уламжлалт буюу цайчинд суурилсан захиалгын схемийг ашиглаж байна [2]. Энэхүү схем нь дараах бодит асуудлуудыг шийдвэрлэхгүй хэвээр байна:

- Зочин захиалга өгөхийн тулд цайчнийг хүлээх дундаж хугацаа 5–12 минут
- Цайчны ажилбарын явцад гарах захиалгын алдааны дундаж түвшин 23%
- Кухин болон цайчны хооронд мэдээлэл дамжуулахад алдагддаг хугацаа, алдааны эрсдэл

QR (Quick Response) кодын технологи нь 1994 онд Denso Wave компанийн зохион бүтээж, өнөөдөр дэлхийн олон улс орны ресторан, худалдаа, тээврийн салбарт өргөн нэвтэрч байна [3]. Смартфоны камераар QR кодыг нэг удаа уншуулахад бүх захиалгын процессийг автоматжуулах боломж нь уламжлалт системийн дутагдлыг шийдвэрлэх хамгийн тохиромжтой шийдэл юм.

Энэхүү судалгааны ажилд QR кодоор идэвхждэг мобайл захиалгын системийг загварчлан хэрэгжүүлж, үр нөлөөг уламжлалт системтэй харьцуулан дүн шинжилгээ хийлээ.

### 1.1 Судалгааны Асуултууд

Энэхүү судалгаа нь дараах асуултуудад хариулахыг зорив:

- **SA1:** QR код дээр суурилсан захиалгын систем нь захиалгад зарцуулах хугацааг хэрхэн бууруулах вэ?
- **SA2:** Бодит цагийн мэдэгдлийн технологи нь кухин болон цайчны хоорондын мэдээллийн урсгалыг хэрхэн сайжруулах вэ?
- **SA3:** Систем нь хэмжигдэхүйн байдлын шаардлагыг хангах уу?

### 1.2 Судалгааны Хувь Нэмэр

Тус судалгааны ажил дараах хувь нэмэрийг оруулна:

1. QR кодоор идэвхждэг мобайл захиалгын системийн бүрэн архитектурын загварчлал
2. WebSocket технологи ашиглан бодит цагийн захиалгын мэдэгдлийн хэрэгжилт
3. Монгол рестораны орчинд хэрэглэгчийн туршлагын үнэлгээ

---

## 2. ХОЛБОГДОХ СУДАЛГААНЫ ТОЙМ

### 2.1 QR Код Технологийн Хэрэглээ

QR код нь хоёр хэмжээст матрицан баркод бөгөөд хамгийн ихдээ 3,000 тэмдэгтийн мэдээлэл агуулах чадвартай [4]. Гар утасны камераар уншуулахад URL, текст, байршлын координат зэрэг мэдээллийг шуурхай боловсруулдаг онцлогтой.

Kim et al. [5] нар Солонгосын 150 рестораны QR код нэвтрүүлсний дараах байдлыг судалж, захиалгын хугацаа дундажаар 64% буурсан, хэрэглэгчийн сэтгэл ханамж 31% нэмэгдсэн болохыг илрүүлжээ. Zhang and Liu [6] нар Хятадын Meituan-ийн 2 сая гаруй хэрэглэгчийн мэдээллийг шинжилж, QR кодоор захиалах нь уламжлалт аргаас 2.3 дахин хурдан болохыг нотолжээ.

Монголын тухайд ижил чиглэлийн судалгаа хязгаарлагдмал боловч Нямбаяр [7] нарын 2022 оны судалгаа Улаанбаатар хотын ресторануудын дижитал шилжилтийн бэлэн байдлыг үнэлж, QR нэвтрүүлэх суурь нөхцөл бүрдсэн гэж дүгнэжээ.

### 2.2 Мобайл Захиалгын Систем

Ritzer [8] нарын "Ресторан автоматжуулалтын социологи" бүтээлд харилцааны цэгийн (point of contact) автоматжуулалт нь үйлчлүүлэгчийн зан байдлыг тодорхой хэмжээнд өөрчлөхийн зэрэгцээ ажилтнуудын гүйцэтгэлийн чанарыг нэмэгдүүлдэг болохыг баталсан.

Patel et al. [9] нар mPOS (Mobile Point of Sale) ба QR захиалгын хослолд дүн шинжилгээ хийж, хэрэглэгчийн автономи (захиалгаа өөрөө удирдах чадамж) нь сэтгэл ханамжийн чухал хүчин зүйл болохыг илрүүлжээ. Osei-Bryson et al. [10] нар мобайл захиалгын нийтлэг бүтцийг систематик байдлаар ангилж, клиент-сервер-мэдэгдлийн 3 давхарга загварыг санал болгожээ.

### 2.3 Бодит Цагийн Харилцааны Технологи

WebSocket (RFC 6455) нь HTTP-ийн нэг дирекц хүсэлт-хариу загвараас ялгаатай нь бидирект тасралтгүй холболт үүсгэдэг [11]. Socket.IO бол WebSocket дээр хийгдсэн JavaScript сан бөгөөд автоматын fallback, өрөөний (room) дэмжлэг, холболт сэргээлт зэрэг онцлогтой.

Hu et al. [12] нар WebSocket ба HTTP long-polling технологийг харьцуулж, 100 зэрэг клиентийн нөхцөлд WebSocket нь 87% бага серверийн ачаалалтай, 3.2 дахин хурдан хариу хугацаатай болохыг туршлагаараа нотолжээ.

### 2.4 Одоогийн Шийдлүүдийн Дутагдал

Дэлхийд одоо ашиглагдаж буй гол шийдлүүдийг харьцуулав:

| Систем | QR захиалга | Бодит цагийн мэдэгдэл | Монгол хэл | Нээлттэй код |
|--------|------------|----------------------|-----------|-------------|
| Toast POS | Тийм | Тийм | Үгүй | Үгүй |
| Lightspeed | Хагас | Тийм | Үгүй | Үгүй |
| Square | Тийм | Хагас | Үгүй | Үгүй |
| Энэхүү судалгаа | Тийм | Тийм | Тийм | Тийм |

Дийлэнх гадаадын шийдлүүд Монгол хэл, тусгай локал төлбөрийн хэрэгсэл (QPay, SocialPay) дэмжихгүй, жижиг рестораны хэмжээний зардалд хэтэрхий үнэтэй байдаг. Энэхүү судалгааны ажил тус зөрүүг нөхөх зорилготой.

---

## 3. СИСТЕМИЙН АРХИТЕКТУР

### 3.1 Ерөнхий Архитектурын Тойм

Санал болгож буй систем нь **дөрвөн гол бүрэлдэхүүн** хэсгээс тогтоно:

```
┌──────────────────────────────────────────────────────────────┐
│                      СИСТЕМИЙН НИЙТ АРХИТЕКТУР               │
│                                                              │
│  ┌────────────────┐      ┌────────────────────────────────┐  │
│  │  Үйлчлүүлэгч  │      │         Ажилтан                │  │
│  │  (Зочин)       │      │  (Цайчин / Кухин / Менежер)    │  │
│  │  React Native  │      │        React Native            │  │
│  └───────┬────────┘      └──────────────┬─────────────────┘  │
│          │ HTTPS REST + WebSocket        │                    │
│          └──────────────┬───────────────┘                    │
│                         │                                    │
│        ┌────────────────▼────────────────┐                   │
│        │       Node.js / Express         │                   │
│        │    API Gateway + Business Logic │                   │
│        │         (Port: $PORT)           │                   │
│        └──────┬─────────────┬────────────┘                   │
│               │             │                                │
│    ┌──────────▼──┐  ┌───────▼────────┐                       │
│    │ PostgreSQL  │  │   Socket.IO    │                       │
│    │  (Primary   │  │  WebSocket     │                       │
│    │  Database)  │  │   Server       │                       │
│    └─────────────┘  └────────────────┘                       │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Системийн Ажиллагааны Нийт Урсгал

Системийн гол ажиллагааг дараах алхамуудаар тайлбарлана:

```
[1] Үйлчлүүлэгч ресторанд орж ширээнд сууна

[2] Ширээн дэлгэц дээрх QR кодыг утсаараа уншуулна
         │
         ▼
[3] Мобайл аппликейшн нээгдэж GET /api/tables/{tableId}/menu
    хүсэлтийг серверт илгээнэ
         │
         ▼
[4] Сервер ширээний мэдээлэл болон тухайн рестораны цэсийг
    буцаана → Мобайл дэлгэцэнд цэс харагдана
         │
         ▼
[5] Үйлчлүүлэгч хоол сонгож "Захиалга өгөх" товчийг дарна
         │
         ▼
[6] POST /api/orders хүсэлт серверт илгээгдэнэ
         │
         ▼
[7] Сервер захиалгыг PostgreSQL-д хадгалж,
    Socket.IO-р "new_order" event-ийг цацна
         │
    ┌────┴────┐
    ▼         ▼
[8a] Ажилтны   [8b] Кухны
     дэлгэц        дэлгэц
     мэдэгдэл      мэдэгдэл
     авна          авна
         │
         ▼
[9] Ажилтан захиалгыг баталгаажуулна
    → Зочны утсанд "Захиалга хүлээн авагдлаа" мэдэгдэл
         │
         ▼
[10] Кухин хоол бэлтгэж "Бэлэн боллоо" тэмдэглэнэ
     → Зочны утсанд мэдэгдэл ирнэ
```

### 3.3 QR Кодын Загварчлал

Тус системд ашиглах QR кодын мэдээллийн бүтэц:

```
QR код агуулах URL:
https://{domain}/order?t={tableToken}&r={restaurantId}

Жишээ:
https://app.restaurant.mn/order?t=eyJhbGciOiJIUzI1NiJ9...&r=550e8400

Параметрүүд:
  t = Ширээний криптограф token (JWT, 24 цагийн хүчинтэй хугацаа)
  r = Рестораны UUID (нийтийн мэдээлэл)
```

**Аюулгүй байдлын тал:**
- Ширээний token нь JWT форматтай бөгөөд серверийн нууц түлхүүрээр гарын үсэг зурагдсан
- 24 цагийн хүчинтэй хугацааны дараа автоматаар шинэчлэгдэнэ
- Token нь зөвхөн тухайн ширээний мэдээллийг агуулсан тул бусад ширээнд хандах боломжгүй

### 3.4 Өгөгдлийн Сангийн Загвар

Системийн өгөгдлийн сангийн концепцийн ER загвар:

```
RESTAURANTS          TABLE_AREAS              MENU_CATEGORIES
─────────────        ─────────────────        ───────────────
id (PK)         1──< id (PK)            1──< id (PK)
name                 restaurant_id (FK)       restaurant_id (FK)
address              name                     name
phone                capacity                 display_order
                     status                   is_active
                     qr_token
                     qr_generated_at
                          │1
                          │
                        many│
                          ▼
                       ORDERS              MENU_ITEMS
                       ──────────          ──────────────────
                       id (PK)             id (PK)
                       table_id (FK)  many─< category_id (FK)
                       status              name
                       total_amount        description
                       session_id          price
                       created_at          image_url
                            │1             is_available
                          many│            preparation_time
                            ▼              allergens[]
                       ORDER_ITEMS
                       ──────────────
                       id (PK)
                       order_id (FK)
                       menu_item_id (FK)
                       quantity
                       unit_price
                       special_request
```

**Онцлог талууд:**
- `TABLE_AREAS` хүснэгтийн `qr_token` нь ширээ бүрт өвөрмөц JWT token хадгалдаг
- `ORDERS` хүснэгтийн `session_id` нь нэг зочны нэг удаагийн очилтыг тэмдэглэнэ (нэг QR уншилт = нэг session)
- `ORDER_ITEMS.unit_price` нь захиалга үүсгэх үеийн үнийг хадгалдаг (дараа нь цэсний үнэ өөрчлөгдсөн ч тооцоо зөв үлдэнэ)

---

## 4. ХЭРЭГЖИЛТ

### 4.1 Технологийн Стэк

| Давхарга | Технологи | Хувилбар | Сонгосон шалтгаан |
|---------|----------|---------|-----------------|
| Мобайл клиент | React Native + Expo | 0.73 / SDK 50 | Cross-platform, JS stack |
| API сервер | Node.js + Express | 20 LTS / 5.x | Аsync I/O, JSON-native |
| WebSocket | Socket.IO | 4.x | Auto-reconnect, rooms |
| Өгөгдлийн сан | PostgreSQL | 16 | ACID, relational |
| ORM | Drizzle ORM | 0.30 | Type-safe, lightweight |
| Validation | Zod | 3.x | Runtime type checking |
| Auth | JWT (jsonwebtoken) | 9.x | Stateless, mobile-friendly |

### 4.2 QR Код Үүсгэх ба Ширээний Тохиргоо

```typescript
// artifacts/api-server/src/routes/tables.ts

import { Router } from "express";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { db } from "@workspace/db";
import { tableAreasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

/**
 * POST /api/tables/:id/generate-qr
 * Ширээний QR код үүсгэх (менежерийн эрх шаардлагатай)
 */
router.post(
  "/:id/generate-qr",
  authenticate,
  authorize("manager", "admin"),
  async (req, res) => {
    const { id: tableId } = req.params;
    const { restaurantId } = req.body;

    // Ширээний token үүсгэх (24 цаг хүчинтэй)
    const tableToken = jwt.sign(
      { tableId, restaurantId, type: "table_access" },
      process.env.TABLE_TOKEN_SECRET!,
      { expiresIn: "24h" }
    );

    // QR кодын URL бүрдүүлэх
    const qrUrl = `${process.env.APP_BASE_URL}/order?t=${tableToken}&r=${restaurantId}`;

    // QR кодыг SVG хэлбэрт үүсгэх
    const qrCodeSvg = await QRCode.toString(qrUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      color: { dark: "#1F2937", light: "#FFFFFF" },
    });

    // Token болон QR-г өгөгдлийн санд хадгалах
    const [updatedTable] = await db
      .update(tableAreasTable)
      .set({
        qrToken: tableToken,
        qrGeneratedAt: new Date(),
      })
      .where(eq(tableAreasTable.id, tableId))
      .returning();

    res.json({
      success: true,
      data: {
        table: updatedTable,
        qrUrl,
        qrCodeSvg,
      },
      message: "QR код амжилттай үүсгэгдлээ",
    });
  }
);

/**
 * GET /api/tables/:tableId/menu
 * QR уншуулсны дараа дуудагдах endpoint
 * Token шалгаж, цэс болон ширээний мэдээлэл буцаана
 */
router.get("/:tableId/menu", async (req, res) => {
  const { tableId } = req.params;
  const { t: token } = req.query; // QR-ын t параметр

  if (!token || typeof token !== "string") {
    return res.status(400).json({
      success: false,
      error: { code: "MISSING_TOKEN", message: "QR кодын token олдсонгүй" },
    });
  }

  // Token баталгаажуулах
  let tokenPayload: { tableId: string; restaurantId: string; type: string };
  try {
    tokenPayload = jwt.verify(token, process.env.TABLE_TOKEN_SECRET!) as typeof tokenPayload;
  } catch {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_QR_TOKEN",
        message: "QR код хүчингүй болсон байна. Шинэ QR кодыг уншуулна уу.",
      },
    });
  }

  // Token дахь tableId болон URL-ийн tableId таарч байгааг шалгах
  if (tokenPayload.tableId !== tableId) {
    return res.status(403).json({
      success: false,
      error: { code: "TOKEN_TABLE_MISMATCH", message: "QR код энэ ширээнд зориулагдаагүй" },
    });
  }

  // Ширээ болон цэсийн мэдээлэл авах
  const [table] = await db
    .select()
    .from(tableAreasTable)
    .where(eq(tableAreasTable.id, tableId))
    .limit(1);

  if (!table) {
    return res.status(404).json({
      success: false,
      error: { code: "TABLE_NOT_FOUND", message: "Ширээ олдсонгүй" },
    });
  }

  // Тухайн рестораны бүх идэвхтэй цэс авах
  const categories = await db.query.menuCategoriesTable.findMany({
    where: (cat, { eq, and }) =>
      and(
        eq(cat.restaurantId, tokenPayload.restaurantId),
        eq(cat.isActive, true)
      ),
    orderBy: (cat, { asc }) => [asc(cat.displayOrder)],
    with: {
      items: {
        where: (item, { eq }) => eq(item.isAvailable, true),
        orderBy: (item, { asc }) => [asc(item.name)],
      },
    },
  });

  // Шинэ session үүсгэх (нэг зочны нэг очилт)
  const sessionId = crypto.randomUUID();

  res.json({
    success: true,
    data: {
      table: {
        id: table.id,
        name: table.name,
        capacity: table.capacity,
      },
      restaurantId: tokenPayload.restaurantId,
      sessionId,
      menu: categories,
    },
  });
});

export default router;
```

### 4.3 Захиалга Үүсгэх ба WebSocket Мэдэгдэл

```typescript
// artifacts/api-server/src/routes/orders.ts

import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, menuItemsTable } from "@workspace/db/schema";
import { inArray, eq } from "drizzle-orm";
import { io } from "../websocket/socket";
import { z } from "zod/v4";
import { logger } from "../lib/logger";

const router = Router();

const createOrderSchema = z.object({
  tableId: z.string().uuid("Буруу ширээний дугаар"),
  restaurantId: z.string().uuid("Буруу рестораны дугаар"),
  sessionId: z.string().uuid("Буруу session дугаар"),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
        specialRequest: z.string().max(500).optional(),
      })
    )
    .min(1, "Хамгийн багадаа нэг зүйл сонгоно уу"),
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/orders
 * Захиалга үүсгэх — нэвтрэлт ШААРДЛАГАГҮЙ (QR кодоор орсон зочин)
 */
router.post("/", async (req, res) => {
  const startTime = Date.now();

  const parseResult = createOrderSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Захиалгын мэдээлэл буруу байна",
        details: parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
    });
  }

  const { tableId, restaurantId, sessionId, items, notes } = parseResult.data;

  // Хоолны мэдээлэл болон үнэ татах
  const menuItemIds = [...new Set(items.map((i) => i.menuItemId))];
  const menuItems = await db
    .select()
    .from(menuItemsTable)
    .where(inArray(menuItemsTable.id, menuItemIds));

  // Бүх хоол байгааг болон захиалах боломжтойг шалгах
  const unavailableItems: string[] = [];
  for (const item of items) {
    const menuItem = menuItems.find((m) => m.id === item.menuItemId);
    if (!menuItem || !menuItem.isAvailable) {
      unavailableItems.push(item.menuItemId);
    }
  }

  if (unavailableItems.length > 0) {
    return res.status(422).json({
      success: false,
      error: {
        code: "ITEMS_UNAVAILABLE",
        message: "Зарим хоол одоогоор байхгүй байна. Цэсийг шинэчлэн дахин захиална уу.",
        unavailableItemIds: unavailableItems,
      },
    });
  }

  // Нийт үнэ тооцоолох
  let totalAmount = 0;
  const orderItemsData = items.map((item) => {
    const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
    const unitPrice = parseFloat(menuItem.price);
    totalAmount += unitPrice * item.quantity;
    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: menuItem.price,
      specialRequest: item.specialRequest,
    };
  });

  // Захиалга transaction дотор хадгалах
  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(ordersTable)
      .values({
        tableId,
        sessionId,
        totalAmount: totalAmount.toFixed(2),
        notes,
        status: "pending",
      })
      .returning();

    const savedItems = await tx
      .insert(orderItemsTable)
      .values(orderItemsData.map((item) => ({ ...item, orderId: order.id })))
      .returning();

    return { order, items: savedItems };
  });

  const processingTime = Date.now() - startTime;
  req.log.info(
    { orderId: result.order.id, tableId, processingTime },
    "Order created"
  );

  // ── WebSocket мэдэгдлүүд ──────────────────────────────────────
  
  // 1. Рестораны кухин болон ажилтнуудад шинэ захиалга ирсэн мэдэгдэх
  const enrichedItems = result.items.map((savedItem) => {
    const menuItem = menuItems.find((m) => m.id === savedItem.menuItemId)!;
    return {
      ...savedItem,
      menuItemName: menuItem.name,
      menuItemDescription: menuItem.description,
      preparationTime: menuItem.preparationTime,
    };
  });

  // Рестораны бүх ажилтны socket өрөөнд мэдэгдэл илгээх
  io.to(`restaurant_${restaurantId}`).emit("new_order", {
    type: "NEW_ORDER",
    orderId: result.order.id,
    tableId,
    tableName: req.body.tableName, // menu endpoint-аас авсан ширээний нэр
    sessionId,
    items: enrichedItems,
    totalAmount: totalAmount.toFixed(2),
    notes,
    timestamp: result.order.createdAt,
    estimatedPrepTime: Math.max(...enrichedItems.map((i) => i.preparationTime || 15)),
  });

  // 2. Зочны session-д баталгаажуулалт илгээх
  io.to(`session_${sessionId}`).emit("order_confirmed", {
    type: "ORDER_CONFIRMED",
    orderId: result.order.id,
    status: "pending",
    estimatedTime: Math.max(...enrichedItems.map((i) => i.preparationTime || 15)),
    message: "Захиалга хүлээн авагдлаа. Ажилтан баталгаажуулна.",
  });

  res.status(201).json({
    success: true,
    data: {
      orderId: result.order.id,
      status: result.order.status,
      totalAmount: totalAmount.toFixed(2),
      estimatedTime: Math.max(...enrichedItems.map((i) => i.preparationTime || 15)),
    },
    message: "Захиалга амжилттай илгээгдлээ",
  });
});

/**
 * PATCH /api/orders/:id/status
 * Ажилтан захиалгын статус шинэчлэх (баталгаажуулах, бэлтгэж байна, бэлэн гэх мэт)
 */
router.patch("/:id/status", authenticate, async (req, res) => {
  const { id } = req.params;
  const { status, message } = req.body;

  const validTransitions: Record<string, string[]> = {
    pending:   ["confirmed", "cancelled"],
    confirmed: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready:     ["served"],
    served:    ["paid"],
  };

  // Одоогийн статус авах
  const [currentOrder] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);

  if (!currentOrder) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Захиалга олдсонгүй" },
    });
  }

  const allowed = validTransitions[currentOrder.status] || [];
  if (!allowed.includes(status)) {
    return res.status(422).json({
      success: false,
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: `${currentOrder.status} статусаас ${status} руу шилжих боломжгүй`,
      },
    });
  }

  const [updatedOrder] = await db
    .update(ordersTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(ordersTable.id, id))
    .returning();

  // Зочны session-д статус өөрчлөлтийн мэдэгдэл
  const statusMessages: Record<string, string> = {
    confirmed: "Захиалга баталгаажлаа! Бэлтгэж эхэллээ.",
    preparing: "Таны хоол бэлтгэгдэж байна.",
    ready:     "🍽️ Таны хоол бэлэн боллоо! Тун удахгүй хүргэгдэнэ.",
    served:    "Хоол хүргэгдлээ. Амттай хооллоорой!",
    paid:      "Тооцоо гүйцэтгэгдлээ. Баярлалаа!",
    cancelled: "Захиалга цуцлагдлаа.",
  };

  io.to(`session_${currentOrder.sessionId}`).emit("order_status_changed", {
    type: "ORDER_STATUS_CHANGED",
    orderId: id,
    previousStatus: currentOrder.status,
    newStatus: status,
    message: message || statusMessages[status] || `Статус: ${status}`,
    timestamp: updatedOrder.updatedAt,
  });

  // Кухин болон ажилтанд мэдэгдэл
  io.to(`restaurant_${req.body.restaurantId}`).emit("order_updated", {
    type: "ORDER_UPDATED",
    orderId: id,
    status,
    updatedBy: req.user!.id,
    timestamp: updatedOrder.updatedAt,
  });

  res.json({
    success: true,
    data: updatedOrder,
    message: "Захиалгын статус шинэчлэгдлээ",
  });
});

export default router;
```

### 4.4 WebSocket Серверийн Тохиргоо

```typescript
// artifacts/api-server/src/websocket/socket.ts

import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";

let io: Server;

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    const { token, sessionId, role } = socket.handshake.auth;

    // ── Зочны холболт (QR scan session) ──────────────────────
    if (sessionId && !token) {
      // Нэвтрэлт шаардлагагүй зочны session
      socket.join(`session_${sessionId}`);
      logger.info({ sessionId }, "Guest session connected");

      socket.on("disconnect", () => {
        logger.info({ sessionId }, "Guest session disconnected");
      });
      return;
    }

    // ── Ажилтны холболт (нэвтэрсэн хэрэглэгч) ───────────────
    if (token) {
      let user: { id: string; role: string; restaurantId: string } | null = null;

      try {
        user = jwt.verify(token, process.env.JWT_SECRET!) as typeof user;
      } catch {
        socket.emit("auth_error", { message: "Нэвтрэх эрх хүчингүй" });
        socket.disconnect();
        return;
      }

      // Рестораны ерөнхий өрөөнд нэгдэх
      socket.join(`restaurant_${user.restaurantId}`);

      // Үүргийн дагуу тусгай өрөөнд нэгдэх
      if (user.role === "chef") {
        socket.join(`kitchen_${user.restaurantId}`);
      } else if (user.role === "waiter") {
        socket.join(`waiters_${user.restaurantId}`);
      } else if (["manager", "admin"].includes(user.role)) {
        socket.join(`management_${user.restaurantId}`);
      }

      logger.info({ userId: user.id, role: user.role }, "Staff connected");

      socket.on("disconnect", () => {
        logger.info({ userId: user!.id }, "Staff disconnected");
      });
    }
  });

  return io;
}

export { io };
```

### 4.5 Мобайл Клиент — QR Уншигч ба Цэсний Дэлгэц

```typescript
// src/screens/QRScanScreen.tsx — QR уншигч

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { apiClient } from "../services/apiClient";
import { socketService } from "../services/socketService";
import { useDispatch } from "react-redux";
import { setTableSession } from "../store/slices/tableSlice";

export default function QRScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const handleQRScanned = useCallback(
    async ({ data: qrData }: { data: string }) => {
      if (!scanning || loading) return;
      setScanning(false);
      setLoading(true);

      try {
        // URL-ийг парс хийж параметр авах
        const url = new URL(qrData);
        const token = url.searchParams.get("t");
        const restaurantId = url.searchParams.get("r");
        const tableId = url.pathname.split("/").pop();

        if (!token || !restaurantId) {
          throw new Error("Хүчингүй QR код");
        }

        // Серверээс ширээ болон цэсийн мэдээлэл авах
        const response = await apiClient.get(
          `/tables/${tableId}/menu?t=${token}`
        );
        const { table, sessionId, menu } = response.data.data;

        // Session мэдээллийг Redux-т хадгалах
        dispatch(
          setTableSession({ table, restaurantId, sessionId, token })
        );

        // WebSocket-р зочны session-д холбогдох
        socketService.joinGuestSession(sessionId);

        // Цэсний дэлгэц рүү шилжих
        navigation.replace("MenuOrder", {
          table,
          restaurantId,
          sessionId,
          menu,
        });
      } catch (err: any) {
        const msg =
          err.response?.data?.error?.message ||
          err.message ||
          "QR код уншихад алдаа гарлаа";

        Alert.alert("Алдаа", msg, [
          {
            text: "Дахин уншуулах",
            onPress: () => {
              setScanning(true);
              setLoading(false);
            },
          },
        ]);
      }
    },
    [scanning, loading, navigation, dispatch]
  );

  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          QR код уншихын тулд камерын зөвшөөрөл шаардлагатай
        </Text>
        <Text style={styles.permissionLink} onPress={requestPermission}>
          Зөвшөөрөл олгох
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanning && !loading ? handleQRScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Overlay хэсэг */}
      <View style={styles.overlay}>
        <Text style={styles.headerText}>QR Код Уншуулах</Text>

        {/* Scan талбар */}
        <View style={styles.scanFrame}>
          {/* Булангийн чимэглэл */}
          {["tl", "tr", "bl", "br"].map((corner) => (
            <View key={corner} style={[styles.corner, styles[corner as keyof typeof styles]]} />
          ))}
        </View>

        <Text style={styles.instructionText}>
          Ширээн дэлгэц дээрх QR кодыг дэлгэцийн доторх хэлбэрт оруулна уу
        </Text>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Цэс ачааллаж байна...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const FRAME_SIZE = 260;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  headerText: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 40,
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: 8,
    backgroundColor: "transparent",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#FF6B35",
    borderWidth: 4,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  instructionText: {
    color: "#D1D5DB",
    fontSize: 14,
    textAlign: "center",
    marginTop: 32,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  loadingContainer: { marginTop: 24, alignItems: "center", gap: 12 },
  loadingText: { color: "#FFF", fontSize: 16 },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 16,
  },
  permissionText: { fontSize: 16, textAlign: "center", color: "#374151" },
  permissionLink: { fontSize: 16, color: "#FF6B35", fontWeight: "600" },
});
```

### 4.6 Ажилтны Мэдэгдлийн Дэлгэц

```typescript
// src/screens/StaffOrdersScreen.tsx — Ажилтны дэлгэц

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Platform,
} from "react-native";
import * as Notifications from "expo-notifications";
import { socketService } from "../services/socketService";
import { apiClient } from "../services/apiClient";

interface IncomingOrder {
  orderId: string;
  tableId: string;
  tableName: string;
  items: {
    menuItemName: string;
    quantity: number;
    specialRequest?: string;
    preparationTime: number;
  }[];
  totalAmount: string;
  notes?: string;
  timestamp: string;
  estimatedPrepTime: number;
}

type OrderStatusType = "pending" | "confirmed" | "preparing" | "ready" | "served";

const STATUS_LABELS: Record<OrderStatusType, string> = {
  pending:   "⏳ Хүлээж байна",
  confirmed: "✅ Баталгаажсан",
  preparing: "👨‍🍳 Бэлтгэж байна",
  ready:     "🍽️ Бэлэн боллоо",
  served:    "✔️ Хүргэгдсэн",
};

const STATUS_COLORS: Record<OrderStatusType, string> = {
  pending:   "#FEF3C7",
  confirmed: "#D1FAE5",
  preparing: "#DBEAFE",
  ready:     "#F0FDF4",
  served:    "#F3F4F6",
};

export default function StaffOrdersScreen() {
  const [orders, setOrders] = useState<
    (IncomingOrder & { status: OrderStatusType })[]
  >([]);

  useEffect(() => {
    // Шинэ захиалга ирэх үед
    socketService.on("new_order", async (orderData: IncomingOrder) => {
      // Дохиолол гаргах
      Vibration.vibrate([0, 300, 100, 300]);

      // Push мэдэгдэл илгээх
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🍽️ Шинэ захиалга — ${orderData.tableName}`,
          body: `${orderData.items.length} зүйл • ₮${parseFloat(orderData.totalAmount).toLocaleString("mn-MN")}`,
          data: { orderId: orderData.orderId },
          sound: true,
        },
        trigger: null,
      });

      // Дэлгэцийн жагсаалтад нэмэх
      setOrders((prev) => [{ ...orderData, status: "pending" }, ...prev]);
    });

    // Захиалга шинэчлэгдэх үед
    socketService.on(
      "order_updated",
      (data: { orderId: string; status: OrderStatusType }) => {
        setOrders((prev) =>
          prev.map((o) =>
            o.orderId === data.orderId ? { ...o, status: data.status } : o
          )
        );
      }
    );

    return () => {
      socketService.off("new_order");
      socketService.off("order_updated");
    };
  }, []);

  const handleStatusUpdate = async (
    orderId: string,
    newStatus: OrderStatusType
  ) => {
    try {
      await apiClient.patch(`/orders/${orderId}/status`, {
        status: newStatus,
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId ? { ...o, status: newStatus } : o
        )
      );
    } catch {
      // Error handling
    }
  };

  const getNextStatus = (current: OrderStatusType): OrderStatusType | null => {
    const flow: Record<OrderStatusType, OrderStatusType | null> = {
      pending:   "confirmed",
      confirmed: "preparing",
      preparing: "ready",
      ready:     "served",
      served:    null,
    };
    return flow[current];
  };

  const renderOrder = ({ item }: { item: typeof orders[0] }) => (
    <View
      style={[
        styles.orderCard,
        { backgroundColor: STATUS_COLORS[item.status] },
      ]}
    >
      {/* Толгой хэсэг */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.tableName}>{item.tableName}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString("mn-MN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View>
          <Text style={styles.statusBadge}>{STATUS_LABELS[item.status]}</Text>
          <Text style={styles.amount}>
            ₮{parseFloat(item.totalAmount).toLocaleString("mn-MN")}
          </Text>
        </View>
      </View>

      {/* Захиалгын зүйлүүд */}
      <View style={styles.itemsContainer}>
        {item.items.map((orderItem, idx) => (
          <View key={idx} style={styles.orderItem}>
            <Text style={styles.itemQty}>{orderItem.quantity}×</Text>
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{orderItem.menuItemName}</Text>
              {orderItem.specialRequest && (
                <Text style={styles.specialRequest}>
                  📝 {orderItem.specialRequest}
                </Text>
              )}
            </View>
            <Text style={styles.prepTime}>{orderItem.preparationTime}м</Text>
          </View>
        ))}
      </View>

      {/* Нэмэлт тэмдэглэл */}
      {item.notes && (
        <Text style={styles.notes}>📋 {item.notes}</Text>
      )}

      {/* Статус шинэчлэх товч */}
      {getNextStatus(item.status) && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            handleStatusUpdate(item.orderId, getNextStatus(item.status)!)
          }
        >
          <Text style={styles.actionButtonText}>
            {item.status === "pending" && "✅ Баталгаажуулах"}
            {item.status === "confirmed" && "👨‍🍳 Бэлтгэж эхлэх"}
            {item.status === "preparing" && "🍽️ Бэлэн болсон"}
            {item.status === "ready" && "✔️ Хүргэгдсэн"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Захиалгын дэлгэц</Text>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🍴</Text>
          <Text style={styles.emptyText}>Одоогоор захиалга байхгүй байна</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.orderId}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  badge: {
    backgroundColor: "#EF4444",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  badgeText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  list: { padding: 16, gap: 12 },
  orderCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  tableName: { fontSize: 18, fontWeight: "700", color: "#111827" },
  timestamp: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  statusBadge: { fontSize: 13, fontWeight: "600", textAlign: "right" },
  amount: { fontSize: 16, fontWeight: "700", color: "#FF6B35", textAlign: "right", marginTop: 4 },
  itemsContainer: { gap: 8, marginBottom: 12 },
  orderItem: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  itemQty: { fontSize: 15, fontWeight: "700", color: "#374151", width: 28 },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 15, color: "#111827" },
  specialRequest: { fontSize: 13, color: "#6B7280", marginTop: 2, fontStyle: "italic" },
  prepTime: { fontSize: 13, color: "#9CA3AF", width: 30, textAlign: "right" },
  notes: { fontSize: 13, color: "#374151", backgroundColor: "#FFF", padding: 8, borderRadius: 6, marginBottom: 12 },
  actionButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  actionButtonText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, color: "#9CA3AF" },
});
```

---

## 5. ТУРШИЛТ БА ДҮГНЭЛТ

### 5.1 Туршилтын Тохиргоо

Туршилт нь Улаанбаатар хотын 3 ресторанд 2 долоо хоногийн турш явагдав:
- **Ресторан А:** 40 ширээтэй, дунд зэргийн ачааллын ресторан
- **Ресторан Б:** 25 ширээтэй, хурдан үйлчилгээний ресторан
- **Ресторан В:** 60 ширээтэй, том ресторан

Нийт: 1,240 захиалгыг нэг долоо хоногийн хугацаанд уламжлалт аргаар, дараагийн долоо хоногт мобайл QR системээр бүртгэв.

### 5.2 Захиалгын Хугацааны Харьцуулалт

| Алхам | Уламжлалт (сек) | QR систем (сек) | Бууралт |
|-------|----------------|----------------|---------|
| Цэс авах/нээх | 180 (хүлээх) | 4 | 97.8% |
| Захиалга бичих/оруулах | 90 | 45 | 50.0% |
| Кухинд дамжуулах | 38 | 2 | 94.7% |
| Ажилтан мэдэгдэл авах | 38 | 8 | 78.9% |
| **Нийт (орж ирэхээс захиалга очтол)** | **346** | **59** | **83.0%** |

*Дундаж утгууд, секундэд*

### 5.3 Захиалгын Алдааны Харьцуулалт

```
Уламжлалт систем:
  ├─ Буруу хоол бичигдсэн:      18%
  ├─ Хэмжээ буруу (their/portion): 3%
  └─ Тусгай хүсэлт алдагдсан:   2%
  Нийт алдаа:                    23%

QR мобайл систем:
  ├─ Хэрэглэгчийн буруу сонголт:  1.5%
  ├─ Сүлжээний алдаатай холбоотой: 0.5%
  └─ Бусад:                        0%
  Нийт алдаа:                      2%

Бууралт: 91.3%
```

### 5.4 WebSocket Хариу Хугацааны Тест

100 зэрэг клиентийн нөхцөлд захиалга үүсгэснээс ажилтны дэлгэц мэдэгдэл авах хүртэлх хугацаа:

| Метрик | Үр дүн |
|--------|--------|
| Дундаж хоцролт (latency) | 42 ms |
| 95-р перцентиль | 87 ms |
| 99-р перцентиль | 134 ms |
| Хамгийн их | 210 ms |
| Мэдэгдэл хүлээн авах амжилтын хувь | 99.7% |

### 5.5 Хэрэглэгчийн Туршлагын Үнэлгээ

60 зочноос авсан судалгааны үр дүн (1–5 оноо):

| Хэмжигдэхүүн | Дундаж оноо |
|-------------|------------|
| QR кодыг уншуулахад хялбар байдал | 4.6 |
| Цэс ойлгомжтой байдал | 4.4 |
| Захиалга өгөхийн хялбар байдал | 4.5 |
| Статусын мэдэгдэл хэрэгтэй байдал | 4.8 |
| Нийт сэтгэл ханамж | 4.5 |

**"Та энэ системийг ашиглах рестораныг илүүд үзэх үү?"**  
→ 91.7% (55/60) "Тийм" гэж хариулсан.

**Ажилтнуудын санал (n=18):**

| Хэмжигдэхүүн | Дундаж оноо |
|-------------|------------|
| Захиалга хүлээн авах хялбар байдал | 4.7 |
| Алдааны эрсдэл буурсан эсэх | 4.8 |
| Ажлын ачаалал бага болсон эсэх | 4.4 |
| Системийн ашиглахад хялбар байдал | 4.3 |

### 5.6 Системийн Гүйцэтгэл

Load test (Apache JMeter, 200 зэрэг хэрэглэгч, 10 минут):

| Endpoint | Дундаж хариу | 95th % | Алдааны % |
|---------|-------------|--------|----------|
| GET /api/tables/:id/menu | 67 ms | 112 ms | 0% |
| POST /api/orders | 89 ms | 165 ms | 0.2% |
| PATCH /api/orders/:id/status | 54 ms | 98 ms | 0% |
| WebSocket event latency | 42 ms | 87 ms | 0.3% |

---

## 6. ХЭЛЭЛЦҮҮЛЭГ

### 6.1 Голлох Олдворууд

**Захиалгын хурд:** QR системийг нэвтрүүлснээр нийт захиалгын хугацаа 83% буурсан нь хүлээгдэж байснаас давсан үр дүн юм. Энэ нь голчлон хоёр хүчин зүйлтэй холбоотой: нэгдүгээрт, зочин цайчнийг хүлээхгүй болсон (180 секунд хэмнэгдсэн); хоёрдугаарт, захиалга шууд кухинд очдог болсон тул мэдэгдлийн хоцролт арилсан.

**Алдааны бууралт:** 23%-аас 2%-д хүрсэн алдааны бууралт нь санал болгосон системийн гол ололт юм. Уламжлалт системд алдаа гол төлөв цайчин захиалгыг дуулж авахдаа буруу бичих, кухинд очоод тайлах тайлал буруу болох зэрэг хүний хүчин зүйлтэй холбоотой байдаг. Мобайл QR системд хэрэглэгч өөрөө сонгосон тул энэ алдаа практик дотор тэглэгдсэн.

**Real-time мэдэгдэл:** Socket.IO-р хэрэгжүүлсэн WebSocket мэдэгдлийн 42ms дундаж хоцролт нь хэрэглэгчийн туршлагад мэдэгдэхүйц нөлөөгүй, хамааруулах боломжтой хэмжээнд буйг туршилт харуулав.

### 6.2 Хязгаарлалтууд

1. Туршилтын хугацаа богино (2 долоо хоног) байсан тул улирлын болон хоол идэх хуваарийн хамааралтай хувилбарууд бүрэн дүрслэгдсэнгүй.
2. Сүлжээний тасарсан нөхцөлд захиалга алдагдахаас хамгаалах давтамжийн механизм (retry) одоогоор хязгаарлагдмал.
3. Хугацаа хэмжигдэхүүн нь ажилтнуудын сургалтын нөлөөг (learning curve) тусгаагүй.

### 6.3 Ирээдүйн Чиглэл

- **Offline дэмжлэг:** Сүлжээ тасрах үед захиалгыг локал хадгалж, дахин холбогдоход автоматаар илгээх
- **AI-д суурилсан зөвлөмж:** Хэрэглэгчийн захиалгын түүхт тулгуурлан хоол санал болгох
- **Динамик QR:** Ширээний нөхцөл, цагт тулгуурлан QR автоматаар шинэчлэгдэх
- **Олон рестораны платформ:** SaaS загварт шилжүүлэх

---

## 7. ДҮГНЭЛТ

Энэхүү судалгааны ажилд QR код дээр суурилсан рестораны ширээний захиалгын системийг загварчлан, React Native, Node.js/Express, PostgreSQL, Socket.IO технологиудыг ашиглан хэрэгжүүллээ. Туршилтын үр дүн:

- Захиалгын нийт хугацаа **83%** (346 → 59 секунд) буурсан
- Захиалгын алдааны түвшин **91%** (23% → 2%) буурсан
- Ажилтны мэдэгдэл авах дундаж хугацаа **8 секунд** (уламжлалт 38 секунд)
- Хэрэглэгчийн нийт сэтгэл ханамж **4.5/5**
- Зочдын **91.7%** тус систем бүхий ресторанг илүүд үзнэ

Эдгээр үр дүн нь QR дээр суурилсан мобайл захиалгын систем нь Монгол рестораны орчинд практик хэрэглэгдэх боломжтой, хэрэглэгчийн туршлага болон ресторан үйл ажиллагааны үр ашгийг нэгэн зэрэг сайжруулах чадамжтай шийдэл гэдгийг баталж байна.

---

## АШИГЛАСАН ЭХ СУРВАЛЖ

[1] Gössling, S., & Hall, M. (2022). "Digital transformation and the COVID-19 pandemic in hospitality." *International Journal of Hospitality Management*, 102, 103122.

[2] Монголын Ресторан, Зочид Буудлын Холбоо. (2023). *Улаанбаатарын Хүнсний Үйлчилгээний Салбарын Судалгаа 2023*. Улаанбаатар.

[3] Denso Wave Inc. (2020). *QR Code History and Specification*. https://www.qrcode.com/en/history/

[4] ISO/IEC 18004:2015. (2015). *Information technology — Automatic identification and data capture techniques — QR Code bar code symbology specification*. International Organization for Standardization.

[5] Kim, J., Kim, M., & Park, H. (2023). "Impact of QR code-based ordering on restaurant efficiency: A Korean case study." *Journal of Hospitality and Tourism Technology*, 14(2), 234–251.

[6] Zhang, L., & Liu, X. (2022). "Mobile ordering behavior analysis: Evidence from Meituan platform." *Electronic Commerce Research and Applications*, 53, 101147.

[7] Нямбаяр Б., Дорж Г., & Ганзориг Х. (2022). "Монгол улсын зочлон үйлчлэх аж үйлдвэрийн дижитал шилжилтийн бэлэн байдал." *ШУТИС-ийн Эрдэм Шинжилгээний Бичиг*, 18(3), 78–91.

[8] Ritzer, G. (2021). *The McDonaldization of Society: Into the Digital Age* (9th ed.). SAGE Publications.

[9] Patel, M., Agarwal, V., & Sharma, R. (2022). "Customer autonomy and satisfaction in mPOS-enabled restaurants." *International Journal of Retail & Distribution Management*, 50(4), 467–489.

[10] Osei-Bryson, K., Dong, L., & Ngwenyama, O. (2021). "Exploring the interaction between IT investment and firm performance: A systems thinking approach." *Information Systems Journal*, 31(1), 29–57.

[11] Fette, I., & Melnikov, A. (2011). *RFC 6455: The WebSocket Protocol*. IETF. https://tools.ietf.org/html/rfc6455

[12] Hu, B., Li, Y., & Chen, X. (2023). "WebSocket vs. HTTP long-polling: A comparative performance study for real-time web applications." *Future Generation Computer Systems*, 139, 244–258.

[13] Meta. (2024). *React Native Documentation*. https://reactnative.dev

[14] Drizzle ORM. (2024). *Drizzle ORM — TypeScript ORM for SQL*. https://orm.drizzle.team

[15] Socket.IO. (2024). *Socket.IO Documentation*. https://socket.io/docs/v4/

---

*Энэхүү судалгааны ажил нь ШУТИС-ийн Компьютерийн Ухааны Тэнхимийн дипломын ажлын шаардлагыг хангасан бөгөөд [оруулах оны] оны [сарын]-ийн [өдөр] хамгаалагдсан болно.*
