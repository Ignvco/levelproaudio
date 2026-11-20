# LEVELPRO OS V4.0 — GATE 1.0 PREFLIGHT
## 02. Inventario Automatizado y Verificable de Modelos, Relaciones y Esquemas

**Documento:** `docs/v4/gate1/preflight/02-automated-models-inventory.md`  
**Versión:** 4.0.0-gate1.0  
**Fecha de Certificación:** Noviembre 2026  
**Método de Obtención:** Introspección programática automática ejecutada en contenedor QA con Django 5.2.16 y PostgreSQL 16 (`apps.get_models()`).  
**Alcance:** 11 aplicaciones Django, **43 modelos reales**, 100% de campos, tipos, llaves foráneas, ManyToMany, constraints e índices.

---

### 1. Resumen de Modelos por Aplicación Django

Se rectifica la cifra anterior (que declaraba 38 modelos): el sistema cuenta con **43 modelos de base de datos** activos en el repositorio:

| Aplicación Django | Cantidad | Modelos Reales Introspeccionados |
| :--- | :---: | :--- |
| `apps.users` | 1 | `User` |
| `apps.products` | 7 | `Category`, `Brand`, `Product`, `BundleItem`, `ProductImage`, `Favorite`, `SpecialOrderRequest` |
| `apps.orders` | 6 | `Cart`, `CartItem`, `Order`, `OrderItem`, `B2BQuote`, `B2BQuoteItem` |
| `apps.payments` | 4 | `Payment`, `PaymentMethodConfig`, `BankAccount`, `PaymentWebhookEvent` |
| `apps.billing` | 1 | `TributaryDocument` |
| `apps.analytics` | 5 | `DistributionCategory`, `IncomeRecord`, `IncomeDistribution`, `Withdrawal`, `WithdrawalDeletionLog` |
| `apps.loyalty` | 3 | `LoyaltyConfig`, `LoyaltyAccount`, `LoyaltyTransaction` |
| `apps.rewards` | 5 | `Campaign`, `RewardProduct`, `Entry`, `Winner`, `StickerPurchase` |
| `apps.academy` | 6 | `Course`, `Module`, `Lesson`, `Enrollment`, `LessonProgress`, `CertificationPath` |
| `apps.services` | 4 | `ServiceCategory`, `Service`, `Booking`, `ServiceRequest` |
| `apps.site_settings`| 1 | `SiteSettings` |
| **TOTAL** | **43** | **43 Modelos Reales Introspeccionados** |

---

### 2. Rectificaciones Críticas de Nombres de Campos Específicos

En concordancia con los hallazgos de la auditoría independiente, se certifican los nombres reales en el código:

1. **`IncomeRecord` (`apps.analytics`):**
   - Campos reales: `id`, `created_at`, `updated_at`, `order` (FK Order), `payment` (FK Payment), `amount` (Decimal), `currency` (Char, def 'CLP'), `description` (Char), `source` (`payment`, `manual`).
   - *Rectificación:* NO existen los campos `gross_amount`, `cost_amount` ni `net_amount`.
2. **`TributaryDocument` (`apps.billing`):**
   - Campos reales: `id`, `created_at`, `updated_at`, `order` (OneToOne Order), `tipo` (`33`, `39`), `numero_externo` (Char), `fecha_emision` (Date), `monto` (Decimal), `estado` (`draft`, `issued`, `cancelled`), `observaciones` (Text), `pdf_externo` (FileField).
   - *Rectificación:* El folio se almacena en `numero_externo`, el importe en `monto` y el archivo en `pdf_externo`.
3. **`LoyaltyAccount` (`apps.loyalty`):**
   - Campos reales: `id`, `created_at`, `updated_at`, `user` (OneToOne User), `puntos_totales` (PositiveInt), `puntos_canjeados` (PositiveInt), `puntos_expirados` (PositiveInt), `nivel` (`bronce`, `plata`, `oro`, `platino`).
   - *Rectificación:* Utiliza nombres en español (`puntos_totales`, `puntos_canjeados`, `puntos_expirados`, `nivel`).
4. **`LoyaltyTransaction` (`apps.loyalty`):**
   - Campos reales: `id`, `created_at`, `updated_at`, `account` (FK LoyaltyAccount), `tipo` (`compra`, `canje`, `expirado`, `ajuste_admin`), `puntos` (Int), `descripcion` (Char), `orden` (FK Order).
   - *Rectificación:* Utiliza `tipo`, `puntos`, `descripcion` y `orden`.
5. **`Campaign` (`apps.rewards`):**
   - Campos reales: `id`, `created_at`, `updated_at`, `name` (Char), `slug` (Slug), `description` (Text), `image`, `banner`, `main_prize` (Char), `sticker_price` (Decimal), `prize_product` (FK Product), `start_date`, `end_date`, `draw_date`, `status` (`draft`, `active`, `paused`, `finished`, `cancelled`), `legal_terms`, `show_counter`, `backup_winners_count`, `drawn_at`, `drawn_by` (FK User).
   - *Rectificación:* El título es `name` y el costo por ticket es `sticker_price`.
6. **`Entry` (`apps.rewards`):**
   - Campos reales: `id`, `created_at`, `updated_at`, `campaign` (FK Campaign), `user` (FK User), `order` (FK Order), `product` (FK Product), `unique_code` (Char).
   - *Rectificación:* El código unívoco de sorteo es `unique_code`.

---

### 3. Catálogo Detallado de Modelos por Aplicación

#### 3.1. `apps.users`
- **`User` (Tabla: `users_user`):**
  - Campos: `id` (UUID PK), `password`, `last_login`, `is_superuser`, `username` (unique), `first_name`, `last_name`, `is_staff`, `is_active`, `date_joined`, `email` (unique), `phone`, `address_street`, `address_comuna`, `address_city`, `address_province`, `address_zip`.
  - M2M: `groups` -> `Group`, `user_permissions` -> `Permission`.

#### 3.2. `apps.products`
- **`Category` (Tabla: `products_category`):**
  - Campos: `id` (UUID PK), `name`, `slug` (unique), `description`, `image`, `parent` (FK self), `is_active`, `order`.
- **`Brand` (Tabla: `products_brand`):**
  - Campos: `id` (UUID PK), `name`, `slug` (unique), `logo`, `website`, `is_active`.
- **`Product` (Tabla: `products_product`):**
  - Campos: `id` (UUID PK), `name`, `slug` (unique), `sku` (unique, null=True), `category` (FK Category), `brand` (FK Brand), `description`, `short_description`, `price` (Decimal), `compare_price` (Decimal, null=True), `price_usd` (Decimal, null=True), `price_ars` (Decimal, null=True), `cost_price` (Decimal, null=True), `product_type` (`stock`, `preorder`, `on_demand`, `bundle`), `stock` (PositiveIntegerField), `stock_min` (PositiveIntegerField, default 5), `weight`, `is_active`, `is_featured`, `badge`, `seo_title`, `seo_description`, `course` (1:1 Course, null=True).
  - M2M: `related_products` -> `Product`, `bundle_items` -> `Product` (through `BundleItem`).
- **`BundleItem` (Tabla: `products_bundleitem`):**
  - Campos: `id` (UUID PK), `bundle` (FK Product), `component` (FK Product), `quantity` (PositiveInt).
  - Unique Together: `(('bundle', 'component'),)`.
- **`ProductImage` (Tabla: `products_productimage`):**
  - Campos: `id` (UUID PK), `product` (FK Product), `image`, `alt_text`, `order`, `is_primary`.
- **`Favorite` (Tabla: `products_favorite`):**
  - Campos: `id` (UUID PK), `user` (FK User), `product` (FK Product), `price_when_added`, `lowest_notified_price`, `was_in_stock`.
  - Unique Together: `(('user', 'product'),)`.
- **`SpecialOrderRequest` (Tabla: `products_specialorderrequest`):**
  - Campos: `id` (UUID PK), `user` (FK User, null=True), `full_name`, `email`, `phone`, `product_name`, `brand_preference`, `target_budget`, `currency`, `details`, `status` (`pending`, `contacted`, `quoted`, `ordered`, `rejected`, `completed`), `admin_notes`.

#### 3.3. `apps.orders`
- **`Cart` (Tabla: `orders_cart`):**
  - Campos: `id` (UUID PK), `user` (FK User), `is_active`.
- **`CartItem` (Tabla: `orders_cartitem`):**
  - Campos: `id` (UUID PK), `cart` (FK Cart), `product` (FK Product), `quantity` (PositiveInt).
- **`Order` (Tabla: `orders_order`):**
  - Campos: `id` (UUID PK), `user` (FK User, null=True), `status` (`pending`, `paid`, `shipped`, `completed`, `cancelled`), `total` (Decimal), `currency` (default 'CLP'), `stock_deductions` (JSONField), `loyalty_points_redeemed`, `loyalty_discount`, `email`, `shipping_address`, `shipping_carrier`, `tracking_number`, `notes`.
  - Índices: `order_status_created_idx` (`status`, `-created_at`), `order_currency_status_idx` (`currency`, `status`).
- **`OrderItem` (Tabla: `orders_orderitem`):**
  - Campos: `id` (UUID PK), `order` (FK Order), `product` (FK Product, null=True), `product_name`, `price` (Decimal), `quantity` (PositiveInt).
- **`B2BQuote` (Tabla: `orders_b2bquote`):**
  - Campos: `id` (UUID PK), `user` (FK User, null=True), `company_name`, `tax_id`, `contact_name`, `email`, `phone`, `currency`, `subtotal`, `discount_amount`, `discount_percent`, `tax_amount`, `total`, `valid_until`, `status` (`pending`, `reviewed`, `approved`, `rejected`, `converted`, `expired`), `client_notes`, `admin_notes`, `converted_order` (1:1 Order, null=True).
- **`B2BQuoteItem` (Tabla: `orders_b2bquoteitem`):**
  - Campos: `id` (UUID PK), `quote` (FK B2BQuote), `product` (FK Product, null=True), `product_name`, `unit_price` (Decimal), `quantity` (PositiveInt), `subtotal`.

#### 3.4. `apps.payments`
- **`Payment` (Tabla: `payments_payment`):**
  - Campos: `id` (UUID PK), `order` (FK Order), `provider` (`mercadopago_cl`, `mercadopago_ar`, `uala`, `paypal`, `global66`, `transfer`, `payoneer`, `cash`), `status` (`pending`, `approved`, `rejected`, `cancelled`, `refunded`, `in_review`), `amount`, `currency`, `external_id`, `preference_id`, `provider_reference`, `payment_url`, `paid_at`, `raw_response`.
- **`PaymentMethodConfig` (Tabla: `payments_paymentmethodconfig`):**
  - Campos: `id` (UUID PK), `method` (unique), `is_active`, `label`, `description`, `currencies`, `order`.
- **`BankAccount` (Tabla: `payments_bankaccount`):**
  - Campos: `id` (UUID PK), `payment_method`, `label`, `currency`, `bank_name`, `account_type`, `account_number`, `holder_name`, `holder_id`, `email`, `instructions`, `is_active`, `order`.
- **`PaymentWebhookEvent` (Tabla: `payments_paymentwebhookevent`):**
  - Campos: `id` (UUID PK), `provider`, `event_id`, `resource_id`, `topic`, `status` (`received`, `processing`, `processed`, `ignored`, `error`), `payload_hash`, `raw_payload`, `error_message`, `processed_at`.
  - Unique Together: `(('provider', 'event_id'),)`.
  - Índices: `payments_we_provide_idx` (`provider`, `resource_id`), `payments_we_status_idx` (`status`, `created_at`).

#### 3.5. `apps.billing`
- **`TributaryDocument` (Tabla: `billing_tributarydocument`):**
  - Campos: `id` (UUID PK), `order` (1:1 Order), `tipo` (`33`, `39`), `numero_externo`, `fecha_emision`, `monto`, `estado`, `observaciones`, `pdf_externo`.

#### 3.6. `apps.analytics`
- **`DistributionCategory` (Tabla: `analytics_distributioncategory`):**
  - Campos: `id` (UUID PK), `name`, `percentage`, `cat_type` (`fixed`, `percent`, `remainder`), `is_active`, `order`.
- **`IncomeRecord` (Tabla: `analytics_incomerecord`):**
  - Campos: `id` (UUID PK), `order` (FK Order, null=True), `payment` (FK Payment, null=True), `amount`, `currency`, `description`, `source`.
- **`IncomeDistribution` (Tabla: `analytics_incomedistribution`):**
  - Campos: `id` (UUID PK), `income_record` (FK IncomeRecord), `category` (FK DistributionCategory), `amount`.
- **`Withdrawal` (Tabla: `analytics_withdrawal`):**
  - Campos: `id` (UUID PK), `category` (FK DistributionCategory), `amount`, `currency`, `notes`, `created_by` (FK User).
- **`WithdrawalDeletionLog` (Tabla: `analytics_withdrawaldeletionlog`):**
  - Campos: `id` (UUID PK), `withdrawal_id`, `category_name`, `amount`, `deleted_by` (FK User), `reason`.

#### 3.7. `apps.loyalty`
- **`LoyaltyConfig` (Tabla: `loyalty_loyaltyconfig`):**
  - Campos: `id` (UUID PK), `points_per_clp`, `clp_per_point`, `min_points_to_redeem`, `max_redeem_percent`, `is_active`.
- **`LoyaltyAccount` (Tabla: `loyalty_loyaltyaccount`):**
  - Campos: `id` (UUID PK), `user` (1:1 User), `puntos_totales`, `puntos_canjeados`, `puntos_expirados`, `nivel`.
- **`LoyaltyTransaction` (Tabla: `loyalty_loyaltytransaction`):**
  - Campos: `id` (UUID PK), `account` (FK LoyaltyAccount), `tipo`, `puntos`, `descripcion`, `orden` (FK Order, null=True).

#### 3.8. `apps.rewards`
- **`Campaign` (Tabla: `rewards_campaign`):**
  - Campos: `id` (UUID PK), `name`, `slug`, `description`, `image`, `banner`, `main_prize`, `sticker_price`, `prize_product` (FK Product, null=True), `start_date`, `end_date`, `draw_date`, `status`, `legal_terms`, `show_counter`, `backup_winners_count`, `drawn_at`, `drawn_by` (FK User, null=True).
- **`RewardProduct` (Tabla: `rewards_rewardproduct`):**
  - Campos: `id` (UUID PK), `campaign` (FK Campaign), `name`, `description`, `image`, `display_order`, `original_product` (FK Product, null=True).
- **`Entry` (Tabla: `rewards_entry`):**
  - Campos: `id` (UUID PK), `campaign` (FK Campaign), `user` (FK User), `order` (FK Order, null=True), `product` (FK Product, null=True), `unique_code`.
- **`Winner` (Tabla: `rewards_winner`):**
  - Campos: `id` (UUID PK), `campaign` (FK Campaign), `entry` (FK Entry), `user` (FK User), `prize_description`, `draw_date`, `is_primary`, `claim_deadline`, `is_claimed`, `claimed_at`.
- **`StickerPurchase` (Tabla: `rewards_stickerpurchase`):**
  - Campos: `id` (UUID PK), `campaign` (FK Campaign), `user` (FK User), `order` (FK Order), `product` (FK Product), `quantity`, `amount`.

#### 3.9. `apps.academy`
- **`Course` (Tabla: `academy_course`):**
  - Campos: `id` (UUID PK), `title`, `slug`, `description`, `short_description`, `thumbnail`, `instructor_name`, `instructor_bio`, `instructor_avatar`, `level`, `duration_hours`, `price`, `price_usd`, `price_ars`, `is_published`, `is_featured`, `order`.
- **`Module` (Tabla: `academy_module`):**
  - Campos: `id` (UUID PK), `course` (FK Course), `title`, `description`, `order`.
- **`Lesson` (Tabla: `academy_lesson`):**
  - Campos: `id` (UUID PK), `module` (FK Module), `title`, `description`, `duration_minutes`, `video_file`, `video_file_path`, `video_url`, `is_free_preview`, `order`, `resources`.
- **`Enrollment` (Tabla: `academy_enrollment`):**
  - Campos: `id` (UUID PK), `user` (FK User), `course` (FK Course), `order` (FK Order, null=True), `enrolled_via`, `progress_percent`, `is_completed`, `completed_at`.
  - Unique Together: `(('user', 'course'),)`.
- **`LessonProgress` (Tabla: `academy_lessonprogress`):**
  - Campos: `id` (UUID PK), `enrollment` (FK Enrollment), `lesson` (FK Lesson), `is_completed`, `completed_at`, `seconds_watched`.
  - Unique Together: `(('enrollment', 'lesson'),)`.
- **`CertificationPath` (Tabla: `academy_certificationpath`):**
  - Campos: `id` (UUID PK), `title`, `slug`, `description`, `short_description`, `badge_image`, `is_published`, `order`.
  - M2M: `courses` -> `Course` (through `CertificationPath_courses`).

#### 3.10. `apps.services`
- **`ServiceCategory` (Tabla: `services_servicecategory`):**
  - Campos: `id` (UUID PK), `name`, `slug`, `description`, `icon`, `is_active`, `order`.
- **`Service` (Tabla: `services_service`):**
  - Campos: `id` (UUID PK), `name`, `slug`, `category` (FK ServiceCategory, null=True), `description`, `short_description`, `thumbnail`, `price`, `price_usd`, `price_ars`, `price_type`, `is_active`, `is_featured`, `order`, `duration_hours`, `deliverables`.
- **`Booking` (Tabla: `services_booking`):**
  - Campos: `id` (UUID PK), `user` (FK User), `service` (FK Service), `scheduled_date`, `notes`, `status`, `confirmed_at`, `cancelled_at`.
- **`ServiceRequest` (Tabla: `services_servicerequest`):**
  - Campos: `id` (UUID PK), `user` (FK User), `service` (FK Service, null=True), `name`, `email`, `phone`, `message`, `budget`, `preferred_date`, `status`, `admin_notes`.

#### 3.11. `apps.site_settings`
- **`SiteSettings` (Tabla: `site_settings_sitesettings`):**
  - Campos: `id` (UUID PK), `hero_title`, `hero_subtitle`, `hero_cta1_text`, `hero_cta1_link`, `hero_cta2_text`, `hero_cta2_link`, `hero_image`, `hero_image_2`, `hero_image_3`, `pillar_shop_image`, `pillar_academy_image`, `pillar_services_image`, `site_name`, `tagline`, `logo`, `accent_color`, `contact_whatsapp`, `contact_instagram`, `contact_email`, `show_trust_strip`, `show_pillars`, `show_products`, `show_courses`, `show_services`, `show_about`, `show_trust_details`, `show_testimonial`, `show_brands`, `show_final_cta`, `seo_title`, `seo_description`, `og_image`, `testimonial_photo`, `testimonial_name`, `testimonial_role`, `testimonial_quote`, `about_title`, `about_body`, `home_bg_type`, `home_bg_color`, `home_bg_image`, `home_bg_image_mode`, `home_bg_image_opacity`, `home_bg_overlay_opacity`, `usd_to_clp`, `usd_to_ars`.
