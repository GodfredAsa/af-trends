# AF Trends — Custom T-Shirt Store

AF Trends is a full-stack e-commerce app that sells **only t-shirts with custom designs**. Customers browse the public catalog, pick a color and size, and pay **cash on delivery**. Staff upload each shirt with multiple images and the same color options customers will see at checkout.

---

## 1. Review status

This README is the implementation contract. V1 is built against it. Local development uses SQLite by default so you can run without installing PostgreSQL; point `DATABASE_URL` at Postgres when you have it.

| Item | Proposal | Needs your OK? |
| --- | --- | --- |
| Product | Custom-design t-shirts only (no other clothing) | Confirm |
| Theme | Dark gray + white | Confirm |
| Payment | Cash on delivery only (no card/mobile money in v1) | Confirm |
| Public landing | Catalog visible with no login | Confirm |
| Checkout | Customer must have an account (guest checkout is out of v1) | Confirm |
| Customization | Staff upload finished designs; customers do **not** upload their own artwork in v1 | Confirm |
| Stack | React (Vite) client + FastAPI API + SQLAlchemy (SQLite locally, Postgres-ready) | Confirm |
| Currency | GHS, configurable later | Confirm |
| Delivery | Fee by zone, configured by superadmin | Confirm |

---

## 2. Product summary

**What it is.** A storefront and operations console for a t-shirt brand. The public site lists every published shirt. A customer chooses a design, a color, and a size, then places an order that is paid when the shirt is delivered.

**What it is not (v1).** Not a general fashion marketplace. Not print-your-own (customer artwork). Not card, MoMo, or Stripe checkout. Not multi-vendor.

**Primary users**

| Role | Who | Job |
| --- | --- | --- |
| Guest | Anyone | Browse the landing catalog and product pages |
| Client (customer) | Shopper with an account | Cart, checkout, order history, addresses |
| Support | Staff | Answer order questions, add notes, limited status updates |
| Manager | Staff | Catalog, images, colors, stock, order fulfillment |
| Superadmin | Owner | Everything managers can do, plus staff accounts and store settings |

---

## 3. Goals and non-goals

### Goals (v1)

- Public landing page that lists all **published** t-shirts with no authentication.
- Product upload: name, description, price, available colors, available sizes, stock per color+size, and **many images** per shirt.
- Buying: same color list as upload; customer also picks a size and quantity.
- Cash on delivery: order is created unpaid; payment is recorded when the item is delivered.
- Role-based access for superadmin, manager, support, and client.
- Order lifecycle from placement through delivery or cancellation.
- Inventory deducted when an order is confirmed, restored if cancelled before pack.

### Non-goals (v1)

- Online payment gateways.
- Customer-uploaded designs / live mockup editor.
- Wishlists, reviews, coupons, gift cards, subscriptions.
- Multi-currency checkout.
- Native mobile apps (responsive web is enough).
- Real-time chat (support uses order notes + status).

### Later (v2+, not in this plan)

- Customer artwork upload and print preview.
- Mobile money / card payment as an **optional** alternative to COD.
- Reviews, discounts, abandoned-cart email.
- Analytics dashboards beyond simple order counts.

---

## 4. Proposed stack

Matches the previous project layout so the team can reuse the same local workflow.

```
af-trends/
  client/     React 19 + Vite  — storefront + staff console
  api/        FastAPI          — REST API, JWT auth, file uploads
  storage/    local disk in api/media (SQLite file: api/af_trends.db)
```

| Layer | Choice | Why |
| --- | --- | --- |
| Client | React + Vite SPA | Same pattern as the previous app; fast UI iteration |
| Routing | React Router | Public store vs `/account` vs `/staff` |
| API | FastAPI | Typed contracts, OpenAPI, JWT already familiar |
| Auth | JWT Bearer access token + hashed passwords | Simple, role claim on the user |
| Database | SQLAlchemy 2 (SQLite locally) | Relational catalog, variants, orders |
| Images | Multipart upload; store files, save URLs | Many images per shirt |
| API docs | FastAPI `/docs` (Swagger) | Review and QA against this README |

**Local run**

```bash
# Terminal 1 — API
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # first time only
uvicorn app.main:app --reload --port 8000

# Terminal 2 — client
cd client
npm install
npm run dev
```

Storefront: [http://127.0.0.1:5174](http://127.0.0.1:5174)  
API: [http://127.0.0.1:8000](http://127.0.0.1:8000)  
Swagger: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

Seed password for all demo accounts: `trends123`

| Email | Role |
| --- | --- |
| `superadmin@aftrends.com` | superadmin |
| `manager@aftrends.com` | manager |
| `support@aftrends.com` | support |
| `client@aftrends.com` | client |

---

## 5. Visual design

**Palette (app chrome, not t-shirt colors)**

| Token | Hex | Use |
| --- | --- | --- |
| `gray-950` | `#111213` | Page background |
| `gray-900` | `#1A1C1E` | Cards, header, staff sidebar |
| `gray-800` | `#2A2D31` | Borders, inputs, hover |
| `gray-400` | `#A8ADB4` | Secondary text |
| `white` | `#FFFFFF` | Primary text, buttons, icons |
| `white-muted` | `#F4F4F5` | Product photo wells, empty states |

No accent color in v1. Interactive states use white-on-dark or inverted white buttons. Product photography sits on dark gray so shirt colors read clearly.

**UI rules**

- Public store and staff console share the same palette.
- Product cards: image, name, price, available color dots.
- Color picker on product and upload forms uses the shirt’s actual hex, with a white ring on the selected swatch.
- Staff console is a dark sidebar + content pane, not a separate theme.

---

## 6. Roles and permissions

Roles are stored on the user. Every protected route checks **role**, not only “is logged in”.

| Capability | Guest | Client | Support | Manager | Superadmin |
| --- | --- | --- | --- | --- | --- |
| View landing + product pages | Yes | Yes | Yes | Yes | Yes |
| Register / login | Yes | Yes | Yes | Yes | Yes |
| Cart, checkout, own orders | | Yes | | | |
| View any order | | own only | Yes | Yes | Yes |
| Add order notes | | | Yes | Yes | Yes |
| Update order status (see matrix below) | | cancel own if pending | limited | Yes | Yes |
| Mark COD collected | | | | Yes | Yes |
| Delete delivered / cancelled orders (after 2 days) | | | | Yes | Yes |
| View shirts and stock | | | Yes | Yes | Yes |
| Create / edit / unpublish products | | | | Yes | Yes |
| Upload / reorder / delete product images | | | | Yes | Yes |
| Set colors, sizes, stock | | | | Yes | Yes |
| Add palette colors | | | | Yes | Yes |
| Create manager / support / client accounts | | | | | Yes |
| Deactivate staff or clients | | | | | Yes |
| Store settings (zones, fees, copy) | | | | | Yes |

**CRUD matrix (staff)**

| Resource | Support | Manager | Superadmin |
| --- | --- | --- | --- |
| Orders | Read; update notes + limited status | Read; full status + COD; delete after 2 days | Same as manager |
| Shirts | Read | Create, read, update, delete | Same as manager |
| Stock | Read | Create, read, update | Same as manager |
| Palette colors | Read | Create, read | Same as manager |
| Users | — | — | Create, read, update |
| Settings / zones | — | — | Create, read, update |

**Order status who can set what**

| From → To | Client | Support | Manager | Superadmin |
| --- | --- | --- | --- | --- |
| `pending` → `cancelled` | own order | Yes | Yes | Yes |
| `pending` → `confirmed` | | | Yes | Yes |
| `confirmed` → `packed` | | | Yes | Yes |
| `packed` → `out_for_delivery` | | Yes | Yes | Yes |
| `out_for_delivery` → `delivered` | | | Yes | Yes |
| `out_for_delivery` → `failed_delivery` | | Yes | Yes | Yes |
| Any non-delivered → `cancelled` | | | Yes | Yes |

Support cannot confirm stock, pack, mark payment collected, or change the catalog. That keeps support from accidentally committing inventory. Privileges live in `api/app/privileges.py` and `client/src/privileges.js`. Login and `/auth/me` return the current user's privilege list.

---

## 7. Domain model

A **product** is one custom design (for example “Kente Crest Tee”).  
A **variant** is that design in one **color + size**, with its own SKU and stock.  
**Images** belong to the product. Each image may optionally be tagged to a color so the gallery can switch when the customer picks a color.

```
User 1──* Address
User 1──* Order
User 1──* CartItem

Product 1──* ProductImage     (many images; optional color_id)
Product 1──* ProductColor     (colors offered for this shirt)
Product 1──* ProductSize      (sizes offered for this shirt)
Product 1──* Variant          (color × size, stock, sku)

ColorPalette  (global: name + hex; reused across shirts)
SizePalette   (global: XS, S, M, L, XL, XXL)

Order 1──* OrderItem
Order 1──* OrderNote
Order  *──1 DeliveryZone
```

**Why variants are color × size.** Stock of “Black / L” is independent of “White / L”. The customer always chooses both. Upload UI lets staff tick colors and sizes; the API creates the variant grid.

---

## 8. Pages and flows

### Public (no auth)

| Route | Purpose |
| --- | --- |
| `/` | Landing: hero + grid of all published t-shirts |
| `/shirts/:slug` | Product: image gallery, color swatches, size, add to cart (cart requires login) |
| `/login` | Sign in (client or staff) |
| `/register` | Client account only |

Staff do not self-register. Superadmin creates manager and support users.

### Client (auth, role `client`)

| Route | Purpose |
| --- | --- |
| `/cart` | Line items with color, size, qty |
| `/checkout` | Address, delivery zone, COD acknowledgement |
| `/account/orders` | Order list |
| `/account/orders/:id` | Tracking + cancel if `pending` |
| `/account/addresses` | Delivery addresses |

### Staff (`/staff`, roles `support` \| `manager` \| `superadmin`)

| Route | Support | Manager | Superadmin |
| --- | --- | --- | --- |
| `/staff` dashboard | Yes | Yes | Yes |
| `/staff/orders` | Yes | Yes | Yes |
| `/staff/orders/:id` | notes + limited status | full | full |
| `/staff/products` | | Yes | Yes |
| `/staff/products/new` | | Yes | Yes |
| `/staff/products/:id` | | Yes | Yes |
| `/staff/users` | | | Yes |
| `/staff/settings` | | | Yes |

### Flow: upload a shirt (manager / superadmin)

1. Create product: name, slug, description, base price, publish flag.
2. Select colors from the palette (same list customers will see).
3. Select sizes.
4. Set stock for each color × size cell.
5. Upload **many images**. Mark one primary. Optionally tag an image to a color.
6. Publish. Shirt appears on the landing page.

### Flow: buy a shirt (client)

1. Guest browses `/` and opens a shirt.
2. Picks color (gallery filters to that color’s images when tagged).
3. Picks size; sees remaining stock.
4. Add to cart — if not logged in, redirect to login, then return.
5. Checkout: choose address + zone, confirm **Pay on delivery**.
6. Order created as `pending`, `payment_status = unpaid`, `payment_method = cash_on_delivery`.
7. On delivery, manager marks `delivered` and `paid`.

### Flow: cash on delivery

```
pending → confirmed → packed → out_for_delivery → delivered
                                              ↘ failed_delivery (retry or cancel)
         ↘ cancelled (stock restored if it was reserved)
```

Payment is **not** taken at checkout. `payment_status` becomes `paid` only when the order is marked delivered and COD is collected. `failed_delivery` stays unpaid.

---

## 9. Data shapes (implementation contract)

IDs are UUIDs. Timestamps are UTC ISO-8601.

### User

```json
{
  "id": "uuid",
  "email": "string",
  "full_name": "string",
  "phone": "string",
  "role": "superadmin | manager | support | client",
  "is_active": true,
  "created_at": "datetime",
  "privileges": ["orders.read", "catalog.read"]
}
```

Password is never returned. Staff accounts are created by superadmin. Clients register themselves.

### Color (palette)

```json
{
  "id": "uuid",
  "name": "Black",
  "hex": "#111111",
  "sort_order": 1
}
```

Seeded defaults: White `#FFFFFF`, Black `#111111`, Dark Gray `#4B4F54`, Navy `#1B2A4A`, Red `#B42318`, Olive `#3F5C3A`. Superadmin can add more later via settings or a palette endpoint.

### Product

```json
{
  "id": "uuid",
  "slug": "kente-crest-tee",
  "name": "Kente Crest Tee",
  "description": "string",
  "base_price": "120.00",
  "currency": "GHS",
  "is_published": true,
  "colors": [{ "id": "uuid", "name": "Black", "hex": "#111111" }],
  "sizes": ["S", "M", "L", "XL"],
  "images": [
    {
      "id": "uuid",
      "url": "/media/products/.../1.jpg",
      "alt_text": "Front",
      "sort_order": 0,
      "is_primary": true,
      "color_id": null
    }
  ],
  "variants": [
    {
      "id": "uuid",
      "sku": "KCT-BLK-M",
      "color": { "id": "uuid", "name": "Black", "hex": "#111111" },
      "size": "M",
      "stock": 12,
      "price": "120.00"
    }
  ]
}
```

`color_id` on an image is optional. Untagged images show for every color. Tagged images show when that color is selected.

### Cart item

```json
{
  "id": "uuid",
  "product_id": "uuid",
  "variant_id": "uuid",
  "quantity": 2,
  "unit_price": "120.00",
  "product_name": "Kente Crest Tee",
  "color_name": "Black",
  "size": "M",
  "image_url": "string"
}
```

### Order

```json
{
  "id": "uuid",
  "order_number": "AFT-20260828-0042",
  "status": "pending",
  "payment_method": "cash_on_delivery",
  "payment_status": "unpaid",
  "subtotal": "240.00",
  "delivery_fee": "20.00",
  "total": "260.00",
  "currency": "GHS",
  "customer": { "id": "uuid", "full_name": "string", "phone": "string", "email": "string" },
  "delivery_address": { "label": "Home", "line1": "string", "city": "Accra", "region": "Greater Accra", "notes": "string" },
  "delivery_zone": { "id": "uuid", "name": "Accra Metro", "fee": "20.00" },
  "items": [],
  "notes": [],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Order status:** `pending` | `confirmed` | `packed` | `out_for_delivery` | `delivered` | `failed_delivery` | `cancelled`  
**Payment status:** `unpaid` | `paid` | `refunded` (refunded unused in v1 COD, reserved for later)

---

## 10. API conventions

Base path: `/api/v1`

| Rule | Detail |
| --- | --- |
| Format | JSON. Image upload is `multipart/form-data`. |
| Auth | `Authorization: Bearer <access_token>` |
| Public routes | No header. Documented per endpoint. |
| Role | 401 if missing/invalid token; 403 if role cannot perform the action |
| Money | Decimal strings (`"120.00"`), never floats |
| Pagination | `?page=1&page_size=20` — response `{ "items", "page", "page_size", "total" }` |
| Errors | `{ "detail": "message" }` or FastAPI validation `{ "detail": [ ... ] }` |
| Filtering | Query params, never in the body for GET |
| IDs | UUID in path params |

**Envelope for lists**

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0
}
```

---

## 11. API catalog

Role legend: **Public** · **Client** · **Support** · **Manager** · **Superadmin**  
`Staff` = Support + Manager + Superadmin  
`Catalog readers` = Staff  
`Catalog editors` = Manager + Superadmin

---

### 11.1 Health

#### `GET /api/v1/health` — Public

```json
{ "status": "ok", "service": "af-trends" }
```

---

### 11.2 Auth

#### `POST /api/v1/auth/register` — Public (creates `client` only)

Request

```json
{
  "email": "ada@example.com",
  "password": "string, min 8",
  "full_name": "Ada Mensah",
  "phone": "0240000000"
}
```

Response `201` — same as login: token + user (role always `client`).

#### `POST /api/v1/auth/login` — Public

Request

```json
{ "email": "string", "password": "string" }
```

Response `200`

```json
{
  "access_token": "jwt",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "string",
    "full_name": "string",
    "phone": "string",
    "role": "client"
  }
}
```

Staff use this same login. The client app sends them to `/staff` when `role !== client`.

#### `GET /api/v1/auth/me` — Any authenticated

Returns the current user.

#### `PATCH /api/v1/auth/me` — Any authenticated

Request (all fields optional): `{ "full_name", "phone", "password" }`  
Email change is out of v1.

---

### 11.3 Public catalog

Landing page uses these. **No token.** Only `is_published = true` products.

#### `GET /api/v1/catalog/products` — Public

Query: `page`, `page_size`, `color_id`, `size`, `q` (name search), `sort=newest|price_asc|price_desc`

Each list item includes `id`, `slug`, `name`, `base_price`, `primary_image`, `colors` (for swatches). Variants and full image lists are omitted for speed.

#### `GET /api/v1/catalog/products/{slug}` — Public

Full product: images, colors, sizes, variants with stock. Unpublished → `404` for guests; staff editors can use the admin product endpoint instead.

#### `GET /api/v1/catalog/colors` — Public

Palette used for filters on the landing page.

#### `GET /api/v1/catalog/sizes` — Public

```json
{ "items": ["XS", "S", "M", "L", "XL", "XXL"] }
```

---

### 11.4 Client addresses

All **Client**.

#### `GET /api/v1/addresses`

#### `POST /api/v1/addresses`

```json
{
  "label": "Home",
  "line1": "12 Oxford Street",
  "line2": "",
  "city": "Accra",
  "region": "Greater Accra",
  "notes": "Gate is blue",
  "is_default": true
}
```

#### `PATCH /api/v1/addresses/{id}`

#### `DELETE /api/v1/addresses/{id}`

#### `GET /api/v1/delivery-zones` — Public or Client

Active zones with fees, shown at checkout.

---

### 11.5 Cart

All **Client**. Cart is server-side, keyed by user.

#### `GET /api/v1/cart`

```json
{
  "items": [],
  "subtotal": "240.00",
  "currency": "GHS"
}
```

#### `POST /api/v1/cart/items`

```json
{ "variant_id": "uuid", "quantity": 1 }
```

Rejects if quantity > stock. Merges into an existing line for the same variant.

#### `PATCH /api/v1/cart/items/{id}`

```json
{ "quantity": 3 }
```

Quantity `0` is not used; delete instead.

#### `DELETE /api/v1/cart/items/{id}`

#### `DELETE /api/v1/cart` — clear all

---

### 11.6 Client orders (COD checkout)

#### `POST /api/v1/orders` — Client

Creates an order from the current cart.

```json
{
  "address_id": "uuid",
  "delivery_zone_id": "uuid",
  "customer_note": "Call on arrival"
}
```

Server behavior:

1. Validate cart not empty and every variant still in stock.
2. Compute subtotal + zone fee = total.
3. Create order: `status=pending`, `payment_method=cash_on_delivery`, `payment_status=unpaid`.
4. Snapshot product name, color, size, unit price on each line (so later catalog edits do not rewrite history).
5. **Do not** deduct stock until `confirmed` (avoids holding stock for abandoned pending orders). Alternative, if you prefer: deduct at placement — call this out in review (see §14).
6. Clear the cart.
7. Return `201` with the order.

There is no payment token, no card field, no “pay now”.

#### `GET /api/v1/orders` — Client

Own orders only. Query: `page`, `page_size`, `status`.

#### `GET /api/v1/orders/{id}` — Client

Own order only; others get `404` (do not leak existence).

#### `POST /api/v1/orders/{id}/cancel` — Client

Allowed only when `status=pending`. Sets `cancelled`.

---

### 11.7 Staff — products (catalog editors)

#### `GET /api/v1/staff/products` — Catalog readers

Includes unpublished. Query: `page`, `page_size`, `q`, `is_published`.

#### `POST /api/v1/staff/products` — Catalog editors

```json
{
  "name": "Kente Crest Tee",
  "slug": "kente-crest-tee",
  "description": "…",
  "base_price": "120.00",
  "color_ids": ["uuid", "uuid"],
  "sizes": ["S", "M", "L", "XL"],
  "variants": [
    { "color_id": "uuid", "size": "M", "stock": 12, "sku": "KCT-BLK-M" }
  ],
  "is_published": false
}
```

If `variants` is omitted, the API builds a zero-stock grid from `color_ids` × `sizes`. Slug must be unique. Images are added in a follow-up call so multipart stays simple.

Response `201` — full product (images empty).

#### `GET /api/v1/staff/products/{id}` — Catalog readers

#### `PATCH /api/v1/staff/products/{id}` — Catalog editors

Same fields as create, all optional. Changing colors/sizes adds missing variants (stock 0) and **rejects** removal of a variant that appears on a non-cancelled order (deactivate by setting stock 0 instead).

#### `DELETE /api/v1/staff/products/{id}` — Catalog editors

Soft delete: `is_published=false` and `deleted_at` set. Never hard-delete a product that has order history.

---

### 11.8 Staff — product images (many per shirt)

#### `POST /api/v1/staff/products/{id}/images` — Catalog editors

`multipart/form-data`

| Field | Type | Notes |
| --- | --- | --- |
| `files` | file[] | 1–12 images per request; jpeg/png/webp; max 5 MB each |
| `color_id` | uuid, optional | Applied to all files in this request |
| `alt_text` | string, optional | |

First image on a product with no images becomes `is_primary`. Response: updated image list.

#### `PATCH /api/v1/staff/products/{id}/images/{image_id}` — Catalog editors

```json
{
  "alt_text": "Back print",
  "sort_order": 2,
  "is_primary": true,
  "color_id": "uuid or null"
}
```

Setting `is_primary: true` clears primary on siblings.

#### `DELETE /api/v1/staff/products/{id}/images/{image_id}` — Catalog editors

Cannot delete the last image of a **published** product (unpublish first, or replace).

---

### 11.9 Staff — variants and stock

#### `PUT /api/v1/staff/products/{id}/variants` — Catalog editors

Replace stock/SKU/price for the existing grid (does not invent new color/size pairs; those go through `PATCH` product).

```json
{
  "variants": [
    { "id": "uuid", "stock": 8, "sku": "KCT-BLK-M", "price": "120.00" }
  ]
}
```

`price` omitted → inherit `base_price`.

#### `GET /api/v1/staff/palette/colors` — Staff (catalog read)  
#### `POST /api/v1/staff/palette/colors` — Manager, Superadmin

```json
{ "name": "Forest", "hex": "#1F4D2A" }
```

#### `GET /api/v1/staff/palette/sizes` — Staff (catalog read)

Read-only in v1 (fixed XS–XXL).

---

### 11.10 Staff — orders

#### `GET /api/v1/staff/orders` — Staff

Query: `page`, `page_size`, `status`, `payment_status`, `q` (order number, customer name, phone).

#### `GET /api/v1/staff/orders/{id}` — Staff

Full order + notes + status history.

#### `PATCH /api/v1/staff/orders/{id}/status` — Staff (role matrix in §6)

```json
{ "status": "confirmed", "note": "Stock checked" }
```

Illegal transitions → `409`. On `confirmed`, deduct stock. On `cancelled` after confirm, restore stock. On `delivered`, require a following or combined payment mark.

#### `PATCH /api/v1/staff/orders/{id}/payment` — Manager, Superadmin

```json
{ "payment_status": "paid" }
```

Only when status is `delivered` (or in the same request as moving to `delivered`). COD collection is the only v1 path to `paid`.

#### `POST /api/v1/staff/orders/{id}/notes` — Staff

```json
{ "body": "Customer asked for evening drop-off." }
```

Notes are internal. Clients do not see them.

---

### 11.11 Staff — users (superadmin)

#### `GET /api/v1/staff/users` — Superadmin

Query: `role`, `is_active`, `q`.

#### `POST /api/v1/staff/users` — Superadmin

```json
{
  "email": "manager@aftrends.com",
  "password": "string",
  "full_name": "string",
  "phone": "string",
  "role": "manager"
}
```

`role` may be `manager` or `support` only (not `superadmin`, not `client`). Clients use register.

#### `PATCH /api/v1/staff/users/{id}` — Superadmin

```json
{
  "full_name": "string",
  "phone": "string",
  "role": "support",
  "is_active": false,
  "password": "optional reset"
}
```

Cannot deactivate the last superadmin. Cannot change own role to drop superadmin if you are the last one.

---

### 11.12 Store settings (superadmin)

#### `GET /api/v1/staff/settings` — Superadmin

```json
{
  "store_name": "AF Trends",
  "support_email": "support@aftrends.com",
  "support_phone": "string",
  "currency": "GHS",
  "cod_instructions": "Please have the exact amount ready. Payment is collected on delivery.",
  "low_stock_threshold": 5
}
```

#### `PATCH /api/v1/staff/settings` — Superadmin

Partial update of the object above.

#### `GET /api/v1/staff/delivery-zones` — Superadmin  
#### `POST /api/v1/staff/delivery-zones` — Superadmin  
#### `PATCH /api/v1/staff/delivery-zones/{id}` — Superadmin  

```json
{ "name": "Accra Metro", "fee": "20.00", "is_active": true }
```

---

## 12. Endpoint index

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/v1/health` | Public |
| POST | `/api/v1/auth/register` | Public → client |
| POST | `/api/v1/auth/login` | Public |
| GET | `/api/v1/auth/me` | Any user |
| PATCH | `/api/v1/auth/me` | Any user |
| GET | `/api/v1/catalog/products` | Public |
| GET | `/api/v1/catalog/products/{slug}` | Public |
| GET | `/api/v1/catalog/colors` | Public |
| GET | `/api/v1/catalog/sizes` | Public |
| GET | `/api/v1/delivery-zones` | Public |
| GET | `/api/v1/addresses` | Client |
| POST | `/api/v1/addresses` | Client |
| PATCH | `/api/v1/addresses/{id}` | Client |
| DELETE | `/api/v1/addresses/{id}` | Client |
| GET | `/api/v1/cart` | Client |
| POST | `/api/v1/cart/items` | Client |
| PATCH | `/api/v1/cart/items/{id}` | Client |
| DELETE | `/api/v1/cart/items/{id}` | Client |
| DELETE | `/api/v1/cart` | Client |
| POST | `/api/v1/orders` | Client |
| GET | `/api/v1/orders` | Client |
| GET | `/api/v1/orders/{id}` | Client |
| POST | `/api/v1/orders/{id}/cancel` | Client |
| GET | `/api/v1/staff/products` | Staff |
| POST | `/api/v1/staff/products` | Manager, Superadmin |
| GET | `/api/v1/staff/products/{id}` | Staff |
| PATCH | `/api/v1/staff/products/{id}` | Manager, Superadmin |
| DELETE | `/api/v1/staff/products/{id}` | Manager, Superadmin |
| POST | `/api/v1/staff/products/{id}/images` | Manager, Superadmin |
| PATCH | `/api/v1/staff/products/{id}/images/{image_id}` | Manager, Superadmin |
| DELETE | `/api/v1/staff/products/{id}/images/{image_id}` | Manager, Superadmin |
| PUT | `/api/v1/staff/products/{id}/variants` | Manager, Superadmin |
| GET | `/api/v1/staff/stock` | Staff |
| POST | `/api/v1/staff/stock` | Manager, Superadmin |
| GET | `/api/v1/staff/palette/colors` | Staff |
| POST | `/api/v1/staff/palette/colors` | Manager, Superadmin |
| GET | `/api/v1/staff/palette/sizes` | Staff |
| GET | `/api/v1/staff/orders` | Staff |
| GET | `/api/v1/staff/orders/{id}` | Staff |
| PATCH | `/api/v1/staff/orders/{id}/status` | Staff (matrix) |
| PATCH | `/api/v1/staff/orders/{id}/payment` | Manager, Superadmin |
| POST | `/api/v1/staff/orders/{id}/notes` | Staff |
| DELETE | `/api/v1/staff/orders/{id}` | Manager, Superadmin (delivered/cancelled, 2 days) |
| GET | `/api/v1/staff/users` | Superadmin |
| POST | `/api/v1/staff/users` | Superadmin |
| PATCH | `/api/v1/staff/users/{id}` | Superadmin |
| GET | `/api/v1/staff/settings` | Superadmin |
| PATCH | `/api/v1/staff/settings` | Superadmin |
| GET | `/api/v1/staff/delivery-zones` | Superadmin |
| POST | `/api/v1/staff/delivery-zones` | Superadmin |
| PATCH | `/api/v1/staff/delivery-zones/{id}` | Superadmin |

---

## 13. Implementation phases (after approval)

Do not start until this README is signed off. Suggested order:

| Phase | Scope | Done when |
| --- | --- | --- |
| 0 | Repo layout, Postgres, Alembic, JWT, seed superadmin | Health + login work |
| 1 | Color/size palettes, products, multi-image upload, variants | Staff can publish a shirt with 3+ images and 2+ colors |
| 2 | Public landing + product page (no auth) | Guest sees catalog and color picker |
| 3 | Client register, addresses, cart | Logged-in add-to-cart works |
| 4 | COD checkout + client order history/cancel | Order created unpaid |
| 5 | Staff orders, status machine, stock, COD paid | Delivered + paid path works |
| 6 | Support role limits, superadmin users + settings + zones | RBAC matches §6 |
| 7 | Polish: empty/error states, image reorder, low-stock on dashboard | Ready to use |

Seed users for development (passwords in `.env`, never committed as production secrets):

| Email | Role |
| --- | --- |
| `superadmin@aftrends.com` | superadmin |
| `manager@aftrends.com` | manager |
| `support@aftrends.com` | support |
| `client@aftrends.com` | client |

---

## 14. Open decisions (please reply)

These are the only product choices that should be settled before coding.

1. **Stock timing.** Deduct stock at `confirmed` (current proposal) or at checkout (`pending`)? Confirming later is friendlier to abandoned carts; deducting at checkout prevents oversell.
2. **Guest checkout.** v1 requires an account. Allow guests to order with only name + phone + address?
3. **Customer designs.** Confirm v1 is staff-uploaded artwork only (no customer print file).
4. **Currency and market.** GHS and Ghana-style regions/zones — or keep addresses generic?
5. **Delivery fee.** Per zone (proposed) vs one flat fee vs free over a threshold.
6. **Returns / exchanges.** Out of v1 unless you want a `returned` status now.
7. **Max images per shirt.** Proposed 12. Change if you want more.
8. **Add to cart while logged out.** Proposed: prompt login, then add. Alternatively keep a guest cart in `localStorage` and merge after login.

---

## 15. Approval

Comment on this README (inline or in chat) with:

- Approved as written, or
- Changes to any row in §1 / answers to §14

Implementation starts only after that. The first build slice will be Phase 0 + 1 (auth, products, colors, multi-image upload) so the landing page has real shirts to list.
