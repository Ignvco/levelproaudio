# LEVELPRO OS V4.0 — GATE 0.1
## 02. Matriz Verificable de Evidencia de Código: Modelos, APIs, Rutas y Servicios

**Documento:** `docs/v4/gate0.1/02-code-evidence-matrix.md`  
**Versión:** 4.0.0-gate0.1  
**Fecha de Certificación:** Noviembre 2026  
**Auditor:** Senior Software Architect & Lead Backend Engineer  
**Entorno de Referencia:** Repositorio local `Ignvco/levelproaudio`, Commit `e33f699a55b2709a6921b0c65fe301d2477ee9a8`.

---

### 1. Inventario Exhaustivo de Aplicaciones Django y Modelos

El backend cuenta con 11 aplicaciones activas en `backend/apps/`. A continuación se detalla cada modelo, su archivo fuente, línea de definición, campos críticos, relaciones e índices:

#### 1.1. `apps/users`
- **Modelo:** `User(AbstractUser)`
  - **Archivo:** `backend/apps/users/models.py:9`
  - **Campos Principales:** `id` (UUIDField PK), `email` (EmailField unique), `phone` (CharField), `address_street`, `address_comuna`, `address_city`, `address_province`, `address_zip`.
  - **Configuración:** `USERNAME_FIELD = 'email'`, `REQUIRED_FIELDS = ['username']`.
  - **Settings:** `AUTH_USER_MODEL = 'users.User'` en `backend/config/settings/base.py:196`.

#### 1.2. `apps/products`
- **Modelo:** `Category(TimeStampedModel)` (`backend/apps/products/models.py:11`)
  - Campos: `name`, `slug` (unique), `description`, `image`, `order`.
- **Modelo:** `Brand(TimeStampedModel)` (`backend/apps/products/models.py:37`)
  - Campos: `name`, `slug` (unique), `logo`, `website`, `is_active`.
- **Modelo:** `Product(TimeStampedModel)` (`backend/apps/products/models.py:58`)
  - Campos: `name`, `slug`, `sku` (CharField unique nullable), `product_type` (`stock`, `preorder`, `on_demand`, `bundle`), `price` (Decimal CLP base), `price_usd` (Decimal nullable), `price_ars` (Decimal nullable), `compare_price`, `cost_price`, `stock` (`PositiveIntegerField`), `stock_min` (`PositiveIntegerField`, default 5), `weight`, `is_active`.
  - Relaciones: `category` (FK Category), `brand` (FK Brand), `related_products` (M2M self), `bundle_items` (M2M through `BundleItem`), `course` (1:1 opt Course).
- **Modelo:** `BundleItem(TimeStampedModel)` (`backend/apps/products/models.py:245`)
  - Campos: `bundle` (FK Product), `component` (FK Product), `quantity` (PositiveIntegerField).
- **Modelo:** `ProductImage(TimeStampedModel)` (`backend/apps/products/models.py:269`)
  - Campos: `product` (FK Product), `image`, `alt_text`, `is_primary`, `order`.
- **Modelo:** `Favorite(TimeStampedModel)` (`backend/apps/products/models.py:294`)
  - Campos: `user` (FK User), `product` (FK Product), `price_when_added`, `lowest_notified_price`, `was_in_stock`.
- **Modelo:** `SpecialOrderRequest(TimeStampedModel)` (`backend/apps/products/models.py:323`)
  - Campos: `user` (FK User opt), `full_name`, `email`, `phone`, `product_name`, `brand_preference`, `target_budget`, `currency`, `details`, `status` (`pending`, `contacted`, `quoted`, `ordered`, `rejected`, `completed`).

#### 1.3. `apps/orders`
- **Modelo:** `Cart(TimeStampedModel)` (`backend/apps/orders/models.py:26`)
  - Campos: `user` (FK User), `is_active` (BooleanField).
- **Modelo:** `CartItem(TimeStampedModel)` (`backend/apps/orders/models.py:66`)
  - Campos: `cart` (FK Cart), `product` (FK Product), `quantity` (PositiveIntegerField).
- **Modelo:** `Order(TimeStampedModel)` (`backend/apps/orders/models.py:103`)
  - Campos: `user` (FK User opt), `status` (`pending`, `paid`, `shipped`, `completed`, `cancelled`), `total` (Decimal), `currency` (CharField, default 'CLP'), `stock_deductions` (JSONField), `loyalty_points_redeemed`, `loyalty_discount`, `email`, `shipping_address`, `shipping_carrier`, `tracking_number`, `notes`.
  - Índices: `order_status_created_idx` (`status`, `-created_at`), `order_currency_status_idx` (`currency`, `status`).
- **Modelo:** `OrderItem(TimeStampedModel)` (`backend/apps/orders/models.py:212`)
  - Campos: `order` (FK Order), `product` (FK Product opt), `product_name`, `price` (Decimal), `quantity` (PositiveIntegerField).
- **Modelo:** `B2BQuote(TimeStampedModel)` (`backend/apps/orders/models.py:262`)
  - Campos: `user` (FK User opt), `company_name`, `tax_id`, `contact_name`, `email`, `phone`, `currency`, `subtotal`, `discount_amount`, `discount_percent`, `tax_amount`, `total`, `valid_until`, `status` (`pending`, `reviewed`, `approved`, `rejected`, `converted`, `expired`), `client_notes`, `admin_notes`, `converted_order` (1:1 Order opt).
- **Modelo:** `B2BQuoteItem(TimeStampedModel)` (`backend/apps/orders/models.py:291`)
  - Campos: `quote` (FK B2BQuote), `product` (FK Product opt), `product_name`, `unit_price` (Decimal), `quantity` (PositiveIntegerField), `subtotal`.

#### 1.4. `apps/payments`
- **Modelo:** `Payment(TimeStampedModel)` (`backend/apps/payments/models.py:28`)
  - Campos: `order` (FK Order), `provider` (`mercadopago_cl`, `mercadopago_ar`, `uala`, `paypal`, `global66`, `transfer`, `payoneer`, `cash`), `status` (`pending`, `approved`, `rejected`, `cancelled`, `refunded`, `in_review`), `amount`, `currency`, `external_id`, `preference_id`, `provider_reference`, `payment_url`, `paid_at`, `raw_response` (JSONField).
- **Modelo:** `PaymentMethodConfig(TimeStampedModel)` (`backend/apps/payments/models.py:92`)
  - Campos: `method` (CharField unique), `is_active`, `label`, `description`, `currencies`, `order`.
- **Modelo:** `BankAccount(TimeStampedModel)` (`backend/apps/payments/models.py:145`)
  - Campos: `payment_method`, `label`, `currency`, `bank_name`, `account_type`, `account_number`, `holder_name`, `holder_id`, `email`, `instructions`, `is_active`, `order`.
- **Modelo:** `PaymentWebhookEvent(TimeStampedModel)` (`backend/apps/payments/models.py:189`)
  - Campos: `provider`, `event_id`, `resource_id`, `topic`, `status` (`received`, `processing`, `processed`, `ignored`, `error`), `payload_hash`, `raw_payload`, `error_message`, `processed_at`.
  - Índices y Constraints: `unique_together = ("provider", "event_id")`, `payments_we_provide_idx`, `payments_we_status_idx`.

#### 1.5. `apps/billing`
- **Modelo:** `TributaryDocument(TimeStampedModel)` (`backend/apps/billing/models.py:19`)
  - Campos: `order` (1:1 FK Order), `tipo` (`33` Factura, `39` Boleta), `folio` (CharField), `pdf_file`, `xml_file`, `monto_total`, `monto_neto`, `monto_iva`, `estado` (`emitido`, `anulado`, `con_error`), `rut_receptor`, `razon_social_receptor`.

#### 1.6. `apps/analytics`
- **Modelo:** `DistributionCategory(TimeStampedModel)` (`backend/apps/analytics/models.py:9`)
  - Campos: `name`, `percentage`, `is_remainder`, `is_active`.
- **Modelo:** `IncomeRecord(TimeStampedModel)` (`backend/apps/analytics/models.py:40`)
  - Campos: `order` (1:1 FK Order), `payment` (FK Payment opt), `gross_amount`, `cost_amount`, `net_amount`, `currency`.
- **Modelo:** `IncomeDistribution(TimeStampedModel)` (`backend/apps/analytics/models.py:127`)
  - Campos: `income_record` (FK IncomeRecord), `category` (FK DistributionCategory), `amount`, `percentage_applied`.
- **Modelo:** `Withdrawal(TimeStampedModel)` (`backend/apps/analytics/models.py:142`)
  - Campos: `category` (FK DistributionCategory), `amount`, `currency`, `notes`, `created_by` (FK User).
- **Modelo:** `WithdrawalDeletionLog(TimeStampedModel)` (`backend/apps/analytics/models.py:162`)
  - Campos: `withdrawal_id`, `category_name`, `amount`, `deleted_by` (FK User), `reason`.

#### 1.7. `apps/loyalty`
- **Modelo:** `LoyaltyConfig(TimeStampedModel)` (`backend/apps/loyalty/models.py:9`)
  - Campos: Singleton de configuración (`points_per_amount`, `redemption_ratio`, `currency`).
- **Modelo:** `LoyaltyAccount(TimeStampedModel)` (`backend/apps/loyalty/models.py:44`)
  - Campos: `user` (1:1 FK User), `balance_points`, `tier` (`bronce`, `plata`, `oro`, `platino`), `total_earned_points`, `total_spent_points`.
- **Modelo:** `LoyaltyTransaction(TimeStampedModel)` (`backend/apps/loyalty/models.py:220`)
  - Campos: `account` (FK LoyaltyAccount), `order` (FK Order opt), `points`, `transaction_type` (`earn`, `redeem`, `adjust`, `expire`), `description`.

#### 1.8. `apps/rewards`
- **Modelo:** `Campaign(TimeStampedModel)` (`backend/apps/rewards/models.py:27`)
  - Campos: `title`, `slug`, `description`, `image`, `status` (`draft`, `active`, `paused`, `finished`, `cancelled`), `start_date`, `end_date`, `price_per_ticket`, `currency`, `total_tickets`, `sold_tickets`.
- **Modelo:** `RewardProduct(TimeStampedModel)` (`backend/apps/rewards/models.py:135`)
  - Campos: `campaign` (FK Campaign), `product` (FK Product opt), `title`, `description`, `image`, `position`.
- **Modelo:** `Entry(TimeStampedModel)` (`backend/apps/rewards/models.py:166`)
  - Campos: `campaign` (FK Campaign), `user` (FK User), `order` (FK Order opt), `ticket_number` (IntegerField), `is_winner`.
- **Modelo:** `Winner(TimeStampedModel)` (`backend/apps/rewards/models.py:207`)
  - Campos: `campaign` (FK Campaign), `entry` (1:1 FK Entry), `user` (FK User), `prize_description`, `draw_date`, `verification_hash`.
- **Modelo:** `StickerPurchase(TimeStampedModel)` (`backend/apps/rewards/models.py:256`)
  - Campos: `user` (FK User), `campaign` (FK Campaign), `order` (FK Order), `sticker_pack_id`, `amount`.

#### 1.9. `apps/academy`
- **Modelo:** `Course(TimeStampedModel)` (`backend/apps/academy/models.py:11`)
  - Campos: `title`, `slug`, `description`, `instructor`, `level` (`beginner`, `intermediate`, `advanced`, `all_levels`), `duration_hours`, `cover_image`, `promo_video_url`, `is_published`, `order`.
- **Modelo:** `Module(TimeStampedModel)` (`backend/apps/academy/models.py:108`)
  - Campos: `course` (FK Course), `title`, `description`, `order`.
- **Modelo:** `Lesson(TimeStampedModel)` (`backend/apps/academy/models.py:124`)
  - Campos: `module` (FK Module), `title`, `description`, `duration_minutes`, `video_file`, `video_url`, `is_free_preview`, `order`.
- **Modelo:** `Enrollment(TimeStampedModel)` (`backend/apps/academy/models.py:159`)
  - Campos: `user` (FK User), `course` (FK Course), `order` (FK Order opt), `completed_at`, `progress_percent`.
- **Modelo:** `LessonProgress(TimeStampedModel)` (`backend/apps/academy/models.py:191`)
  - Campos: `enrollment` (FK Enrollment), `lesson` (FK Lesson), `is_completed`, `completed_at`.
- **Modelo:** `CertificationPath(TimeStampedModel)` (`backend/apps/academy/models.py:206`)
  - Campos: `title`, `slug`, `description`, `badge_image`, `courses` (M2M Course), `is_active`.

#### 1.10. `apps/services`
- **Modelo:** `ServiceCategory(TimeStampedModel)` (`backend/apps/services/models.py:11`)
  - Campos: `name`, `slug`, `description`, `order`.
- **Modelo:** `Service(TimeStampedModel)` (`backend/apps/services/models.py:36`)
  - Campos: `category` (FK ServiceCategory), `name`, `slug`, `short_description`, `full_description`, `price_type` (`fixed`, `starting_at`, `quote_only`), `price`, `currency`, `image`, `is_active`.
- **Modelo:** `Booking(TimeStampedModel)` (`backend/apps/services/models.py:154`)
  - Campos: `service` (FK Service), `user` (FK User), `requested_date`, `status` (`pending`, `confirmed`, `completed`, `cancelled`), `notes`.
- **Modelo:** `ServiceRequest(TimeStampedModel)` (`backend/apps/services/models.py:191`)
  - Campos: `service` (FK Service), `full_name`, `email`, `phone`, `company`, `details`, `status` (`pending`, `contacted`, `quoted`, `in_progress`, `completed`, `cancelled`).

#### 1.11. `apps/site_settings`
- **Modelo:** `SiteSettings(TimeStampedModel)` (`backend/apps/site_settings/models.py:11`)
  - Campos Singleton: `hero_title`, `hero_subtitle`, `hero_button_text`, `hero_button_url`, `hero_image_desktop`, `hero_image_mobile`, `announcement_text`, `announcement_url`, `announcement_is_active`, `usd_to_clp_rate`, `usd_to_ars_rate`, `enable_mercadopago_cl`, `enable_paypal`, `enable_transfers`.

---

### 2. Mapa de Señales (Signals) y Efectos Secundarios

| Archivo Fuente | Línea | Emisor (Sender) | Evento | Efecto Secundario Registrado |
| :--- | :---: | :--- | :--- | :--- |
| `backend/apps/payments/signals.py` | 9 | `Payment` | `post_save` | Si `status == APPROVED` y `Order.status == PENDING`: transiciona orden a `PAID`, fija `paid_at` y envía email de confirmación. |
| `backend/apps/analytics/signals.py` | 7 | `Order` | `post_save` | Crea `IncomeRecord` y distribuye importes en `IncomeDistribution` según porcentajes activos. |
| `backend/apps/analytics/signals.py` | 42 | `Payment` | `post_save` | Asocia `IncomeRecord.payment` al pago aprobado. |
| `backend/apps/loyalty/signals.py` | 7 | `Order` | `post_save` | Si orden pasa a `PAID`, acumula puntos en `LoyaltyAccount` del usuario. |
| `backend/apps/loyalty/signals.py` | 47 | `Order` | `post_save` | Si orden pasa a `CANCELLED`, revierte los puntos otorgados. |
| `backend/apps/rewards/signals.py` | 8 | `Order` | `post_save` | Si orden pasa a `PAID`, genera tickets (`Entry`) en campañas de Rewards activas. |
| `backend/apps/rewards/signals.py` | 26 | `Order` | `post_save` | Si orden pasa a `CANCELLED`, desactiva tickets de sorteo asociados. |
| `backend/apps/academy/signals.py` | 9 | `Order` | `post_save` | Si orden pasa a `PAID` y contiene un producto vinculado a curso, crea `Enrollment`. |
| `backend/apps/orders/signals.py` | 11 | `User` | `post_save` | Crea un carrito activo (`Cart`) para cada nuevo usuario registrado. |

---

### 3. Matriz de Rutas Frontend Verificadas (`frontend/src/App.jsx`)

#### Rutas Públicas de Tienda y Contenido
- `/` → Home (`App.jsx:159`)
- `/shop` → Catálogo (`App.jsx:160`)
- `/shop/:slug` → Detalle de Producto (`App.jsx:161`)
- `/cart` → Carrito de Compras (`App.jsx:162`)
- `/academy` → Academia de Cursos (`App.jsx:163`)
- `/academy/:slug` → Detalle de Curso (`App.jsx:164`)
- `/services` → Servicios de Audio (`App.jsx:165`)
- `/services/:slug` → Detalle de Servicio (`App.jsx:168`)
- `/bajo-pedido` → Solicitud Bajo Pedido (`App.jsx:166`)
- `/b2b` → Cotizaciones Mayoristas (`App.jsx:167`)
- `/rewards` → Campañas de Sorteos (`App.jsx:171`)
- `/terminos`, `/privacidad`, `/bases-sorteo`, `/garantia`, `/envios` → Páginas Legales (`App.jsx:174-178`)

#### Rutas de Checkout y Retorno de Pago
- `/login`, `/register`, `/forgot-password`, `/reset-password` (`App.jsx:215-218`)
- `/dashboard/*` → Panel del Cliente (`App.jsx:221-326`)
- `/payment/success` (`App.jsx:334`)
- `/payment/failure` (`App.jsx:337`)
- `/payment/pending` (`App.jsx:340`)
- `/payment/transfer/:id` (`App.jsx:343`)

#### Rutas Administrativas (`/admin/*`) Protegidas por `AdminRoute`
- `/admin` (index) → `AdminDashboard` (`App.jsx:181`)
- `/admin/finance` → `AdminFinance` (`App.jsx:184`)
- `/admin/billing` → `AdminBilling` (`App.jsx:185`)
- `/admin/loyalty` → `AdminLoyalty` (`App.jsx:186`)
- `/admin/orders` → `AdminOrders` (`App.jsx:187`)
- `/admin/special-orders` → `AdminSpecialOrders` (`App.jsx:188`)
- `/admin/b2b` → `AdminB2BQuotes` (`App.jsx:189`)
- `/admin/products` → `AdminProducts` (`App.jsx:190`)
- `/admin/products/import` → `AdminProductImport` (`App.jsx:191`)
- `/admin/inventory` → `AdminInventory` (`App.jsx:192`)
- `/admin/brands` → `AdminBrands` (`App.jsx:193`)
- `/admin/categories` → `AdminCategories` (`App.jsx:194`)
- `/admin/users` → `AdminUsers` (`App.jsx:195`)
- `/admin/payments` → `AdminPayments` (`App.jsx:196`)
- `/admin/payment-methods` → `AdminPaymentMethods` (`App.jsx:197`)
- `/admin/academy` → `AdminAcademy` (`App.jsx:198`)
- `/admin/academy/certifications` → `AdminCertifications` (`App.jsx:199`)
- `/admin/academy/modules` → `AdminModules` (`App.jsx:200`)
- `/admin/academy/lessons` → `AdminLessons` (`App.jsx:201`)
- `/admin/academy/enrollments` → `AdminEnrollments` (`App.jsx:203`)
- `/admin/services` → `AdminServices` (`App.jsx:202`)
- `/admin/settings` → `AdminSettings` (`App.jsx:204`)
- `/admin/rewards` → `AdminRewards` (`App.jsx:207`)
- `/admin/rewards/campaigns` → `AdminRewardsCampaigns` (`App.jsx:208`)
- `/admin/rewards/campaigns/:id` → `AdminRewardsCampaignDetail` (`App.jsx:209`)
- `/admin/rewards/entries` → `AdminRewardsEntries` (`App.jsx:210`)
- `/admin/rewards/winners` → `AdminRewardsWinners` (`App.jsx:211`)
