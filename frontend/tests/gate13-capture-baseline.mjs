import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { preview } from "vite"
import { chromium } from "playwright"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, "..")
const BASE_OUT = "/Users/levelproaudio/.gemini/antigravity/brain/11ba077a-d7d1-492e-b2b9-3bee19137a13"
const MODE = process.argv[2] || "after" // "before" | "after"
const TARGET_ROOT = process.argv[3] ? path.resolve(process.argv[3]) : FRONTEND_DIR
const OUT_DIR = path.join(BASE_OUT, `gate13_${MODE}`)
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

export const SYNTHETIC_API_MOCKS = (url) => {
  if (url.includes("/users/me/") || url.includes("/auth/me/permissions") || url.includes("/auth/me/") || url.includes("/auth/profile/")) {
    return {
      id: "u1",
      email: "admin@levelpro.cl",
      first_name: "Ignacio",
      last_name: "LevelPro",
      is_staff: true,
      is_superuser: true,
      roles: ["Super Admin"],
      modules: ["dashboard", "catalog", "orders", "inventory", "purchases", "logistics", "finances", "marketing", "academy", "services", "roles", "settings", "audit"],
      effective_modules: ["dashboard", "catalog", "orders", "inventory", "purchases", "logistics", "finances", "marketing", "academy", "services", "roles", "settings", "audit"],
      capabilities: {
        view_costs: true, edit_costs: true, view_margins: true,
        view_finances: true, manage_finances: true, approve_payments: true,
        edit_prices: true, apply_discounts: true, adjust_inventory: true,
        export_data: true, manage_roles: true, manage_settings: true,
        view_audit: true, view_security_audit: true, view_financial_audit: true, export_audit: true,
      },
    }
  }
  if (url.includes("/admin/rbac/me")) {
    return {
      roles: ["Super Admin"],
      is_superuser: true,
      modules: ["dashboard", "catalog", "orders", "inventory", "purchases", "logistics", "finances", "marketing", "academy", "services", "roles", "settings", "audit"],
      capabilities: { view_costs: true, view_margins: true, view_finances: true, manage_finances: true, manage_settings: true, manage_roles: true, view_audit: true },
    }
  }
  if (url.includes("/site-settings/")) {
    return {
      site_name: "LevelPro Audio",
      tagline: "Equipamiento & Ingeniería de Audio Profesional",
      usd_to_clp: "950.00",
      usd_to_ars: "1000.00",
      contact_whatsapp: "+56991234567",
      contact_email: "estudio@levelpro.cl",
      hero_title: "Sonido de Precisión para Estudios Exigentes",
      hero_subtitle: "Interfaces, monitores y conversión AD/DA con soporte técnico certificado.",
      hero_cta1_text: "Explorar Catálogo",
      hero_cta1_link: "/shop",
    }
  }
  if (url.includes("/admin/search/global/")) {
    return {
      query: "RME",
      min_length_met: true,
      allowed_categories: ["products", "variants", "serials", "orders", "customers"],
      results: {
        products: [{ id: "p-1", name: "RME Babyface Pro FS", sku: "RME-BF-FS", brand_name: "RME", category_name: "Interfaces", currency: "CLP", price: "990000.00", stock: 6, is_active: true, target_route: "/admin/products?highlight=p-1" }],
        variants: [{ id: "v-1", sku: "RME-BF-FS-BLK", name: "Edición Black", product_id: "p-1", product_name: "RME Babyface Pro FS", currency: "CLP", price: "1050000.00", stock: 3, is_active: true, target_route: "/admin/products?highlight=p-1" }],
        serials: [{ id: "sn-1", serial_number: "SN-RME-2026-0091", sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", status: "available", warehouse_code: "SCL-CENTRAL", target_route: "/admin/inventory" }],
        orders: [{ id: "ord-1", short_id: "ORD-901A", email: "contacto@estudiomaster.cl", status: "paid", currency: "CLP", total: "990000.00", tracking_code: "TRK-901A", target_route: "/admin/orders?id=ord-1" }],
        customers: [{ id: "c-1", full_name: "Estudio Master CL", email: "contacto@estudiomaster.cl", role: "customer", is_active: true, target_route: "/admin/users" }],
      },
      total_count: 5,
    }
  }
  if (url.includes("/admin/notifications/")) {
    return {
      unread_count: 4,
      total_count: 4,
      polling_interval_seconds: 60,
      delivery_mode: "controlled_polling",
      delivery_disclosure: "Actualización por polling controlado (60s) y refresco manual.",
      notifications: [
        { key: "notif:order:ord-1", category: "orders", priority: "high", title: "Pedido #ORD-901A pendiente de confirmación", description: "Estudio Master CL · CLP 990.000", target_route: "/admin/orders?id=ord-1", created_at: "2026-11-24T15:00:00Z", is_read: false },
        { key: "notif:stock_out:p-2", category: "inventory", priority: "critical", title: "Stock agotado: Neumann TLM 103", description: "SKU NEU-TLM103 · 0 unidades disponibles", target_route: "/admin/inventory", created_at: "2026-11-24T14:40:00Z", is_read: false },
        { key: "notif:stock_low:p-3", category: "inventory", priority: "warning", title: "Stock bajo: Focusrite Scarlett 2i2 Gen 4", description: "SKU FOC-2I2-G4 · 2 unidades", target_route: "/admin/inventory", created_at: "2026-11-24T14:20:00Z", is_read: false },
        { key: "notif:service:srv-1", category: "services", priority: "medium", title: "Solicitud de servicio pendiente: Calibración Estudio", description: "Cliente: diegoproductor@estudio.cl", target_route: "/admin/services", created_at: "2026-11-24T13:50:00Z", is_read: false },
      ],
    }
  }
  if (url.includes("/admin/dashboard")) {
    return {
      currency: "CLP",
      revenue: { total: 18450000, this_month: 6420000, last_month: 5180000, growth_pct: 23.9 },
      orders: { total: 42, pending: 3, paid: 28, shipped: 7, completed: 35 },
      users: { total: 318, new_this_month: 29 },
      products: { total: 64, active: 58, out_of_stock: 2, low_stock: 4 },
      academy: { courses: 8, enrollments: 142 },
      actions: {
        unread_service_requests: 2,
        pending_orders: [
          { id: "ord-1", short_id: "ORD-901A", user_name: "Estudio Master CL", email: "contacto@estudiomaster.cl", total: 990000, currency: "CLP", status: "pending", created_at: "2026-11-24T14:00:00Z" },
        ],
        low_stock: [
          { id: "p-2", name: "Neumann TLM 103", stock: 0 },
          { id: "p-3", name: "Focusrite Scarlett 2i2 Gen 4", stock: 2 },
        ],
      },
      recent_orders: [
        { id: "ord-1", short_id: "ORD-901A", user_name: "Estudio Master CL", email: "contacto@estudiomaster.cl", total: 990000, currency: "CLP", status: "paid", created_at: "2026-11-24T14:00:00Z" },
        { id: "ord-2", short_id: "ORD-902B", user_name: "Sala Mastering Sur", email: "sur@audio.cl", total: 1490000, currency: "CLP", status: "shipped", created_at: "2026-11-23T11:30:00Z" },
        { id: "ord-3", short_id: "ORD-903C", user_name: "Diego Productor", email: "diego@estudio.cl", total: 680000, currency: "CLP", status: "completed", created_at: "2026-11-22T17:15:00Z" },
      ],
      sales_chart: [
        { date: "2026-11-19", total: 890000 },
        { date: "2026-11-20", total: 1250000 },
        { date: "2026-11-21", total: 740000 },
        { date: "2026-11-22", total: 1580000 },
        { date: "2026-11-23", total: 970000 },
        { date: "2026-11-24", total: 1990000 },
      ],
    }
  }
  if (url.includes("/admin/analytics")) {
    return {
      currency: "CLP",
      kpis: { avg_order_value: 1120000, conversion_rate: 3.8 },
      orders_by_status: [
        { status: "paid", count: 7 },
        { status: "shipped", count: 8 },
        { status: "completed", count: 24 },
        { status: "pending", count: 3 },
      ],
      revenue_by_category: [
        { category: "Interfaces de Audio", count: 18, total: 9200000 },
        { category: "Micrófonos de Estudio", count: 14, total: 5800000 },
        { category: "Monitores Activos", count: 10, total: 3450000 },
      ],
      sales_by_month: [
        { month: "Ago", total: 4200000 },
        { month: "Sep", total: 4850000 },
        { month: "Oct", total: 5180000 },
        { month: "Nov", total: 6420000 },
      ],
    }
  }
  if (url.includes("/admin/products/p-1/variants")) {
    return {
      results: [
        { id: "v-1", sku: "RME-BF-FS-STD", name: "Edición Silver", price: "990000.00", price_usd: "1050.00", stock: 4, stock_min: 2, is_active: true },
        { id: "v-2", sku: "RME-BF-FS-BLK", name: "Edición Black", price: "1050000.00", price_usd: "1100.00", stock: 2, stock_min: 2, is_active: true },
      ],
    }
  }
  if (url.includes("/admin/products/p-1/technical-specs")) {
    return { specs: [{ key: "canales_ad_da", label: "Canales AD/DA", value: "24 canales @ 192 kHz" }, { key: "conectividad", label: "Conectividad", value: "USB 2.0 / TotalMix FX" }] }
  }
  if (url.includes("/admin/products/p-1/suppliers")) {
    return { results: [{ id: "ps-1", supplier_id: "sup-1", supplier_name: "Synthax GmbH Audio", supplier_sku: "SYN-RME-BFFS", currency: "USD", unit_cost: "720.00", is_preferred: true, lead_time_days: 7 }] }
  }
  if (url.includes("/admin/products/technical-attributes")) {
    return { attributes: [{ key: "canales_ad_da", label: "Canales AD/DA" }, { key: "conectividad", label: "Conectividad" }], recommended_keys: ["canales_ad_da", "conectividad"] }
  }
  if (url.includes("/admin/products/p-1")) {
    return {
      id: "p-1",
      name: "RME Babyface Pro FS",
      slug: "rme-babyface-pro-fs",
      sku: "RME-BF-FS",
      price: "990000.00",
      compare_price: "1150000.00",
      price_usd: "1050.00",
      price_ars: "1100000.00",
      stock: 6,
      stock_min: 3,
      is_active: true,
      category: { id: "cat-1", name: "Interfaces de Audio" },
      brand: { id: "br-1", name: "RME Audio" },
      short_description: "Interfaz profesional USB de 24 canales con reloj SteadyClock FS.",
    }
  }
  if (url.includes("/admin/products")) {
    return {
      count: 3,
      results: [
        { id: "p-1", name: "RME Babyface Pro FS", sku: "RME-BF-FS", category_name: "Interfaces de Audio", brand_name: "RME Audio", price: "990000.00", price_usd: "1050.00", stock: 6, is_active: true, product_type: "stock" },
        { id: "p-2", name: "Neumann TLM 103 Studio Set", sku: "NEU-TLM103", category_name: "Micrófonos", brand_name: "Neumann", price: "1250000.00", price_usd: "1320.00", stock: 0, is_active: true, product_type: "stock" },
        { id: "p-3", name: "Genelec 8030C Par Monitores", sku: "GEN-8030C", category_name: "Monitores de Estudio", brand_name: "Genelec", price: "1490000.00", price_usd: "1560.00", stock: 4, is_active: true, product_type: "stock" },
      ],
    }
  }
  if (url.includes("/admin/brands")) {
    return {
      count: 3,
      results: [
        { id: "br-1", name: "RME Audio", slug: "rme-audio", website: "https://rme-audio.de", is_active: true, products_count: 12 },
        { id: "br-2", name: "Neumann Berlin", slug: "neumann", website: "https://neumann.com", is_active: true, products_count: 9 },
        { id: "br-3", name: "Genelec Oy", slug: "genelec", website: "https://genelec.com", is_active: true, products_count: 14 },
      ],
    }
  }
  if (url.includes("/admin/categories")) {
    return {
      count: 3,
      results: [
        { id: "cat-1", name: "Interfaces de Audio", slug: "interfaces-de-audio", description: "Conversión AD/DA profesional", is_active: true, order: 1, parent: null, products_count: 18 },
        { id: "cat-2", name: "Micrófonos de Estudio", slug: "microfonos-de-estudio", description: "Condensador, cinta y dinámicos", is_active: true, order: 2, parent: null, products_count: 15 },
        { id: "cat-3", name: "Monitores Activos", slug: "monitores-activos", description: "Monitoreo cercano y midfield", is_active: true, order: 3, parent: null, products_count: 11 },
      ],
    }
  }
  if (url.includes("/admin/suppliers/sup-1/products")) {
    return { results: [{ id: "sp-1", product_id: "p-1", product_name: "RME Babyface Pro FS", sku: "RME-BF-FS", supplier_sku: "SYN-RME-01", currency: "USD", unit_cost: "720.00", min_order_qty: 2, lead_time_days: 7, is_preferred: true }] }
  }
  if (url.includes("/admin/suppliers/sup-1/price-history")) {
    return { results: [{ id: "ph-1", product_name: "RME Babyface Pro FS", old_cost: "700.00", new_cost: "720.00", currency: "USD", changed_at: "2026-11-15T10:00:00Z", changed_by_email: "compras@levelpro.cl" }] }
  }
  if (url.includes("/admin/suppliers/sup-1")) {
    return {
      id: "sup-1",
      internal_code: "SUP-RME-DE",
      legal_name: "Synthax GmbH Audio Distribution",
      trade_name: "Synthax Europe",
      tax_id: "DE-81293011",
      country: "Alemania",
      supplier_type: "distributor",
      currency: "USD",
      payment_terms: "30 días neto",
      default_min_order_qty: 2,
      default_lead_time_days: 10,
      primary_email: "export@synthax.de",
      primary_phone: "+49 8131 39188",
      is_active: true,
      contacts: [{ id: "sc-1", full_name: "Markus Weber", role_title: "Export Manager", email: "m.weber@synthax.de", phone: "+49 8131 39190" }],
      brands_detail: [{ id: "br-1", name: "RME Audio" }],
    }
  }
  if (url.includes("/admin/suppliers")) {
    return {
      summary: { active: 4, national: 2, international: 2, linked_skus: 38, expired_lists: 0 },
      results: [
        { id: "sup-1", internal_code: "SUP-RME-DE", legal_name: "Synthax GmbH Audio Distribution", trade_name: "Synthax Europe", tax_id: "DE-81293011", country: "Alemania", supplier_type: "distributor", currency: "USD", is_active: true, linked_products_count: 14, default_lead_time_days: 10 },
        { id: "sup-2", internal_code: "SUP-PRO-CL", legal_name: "Importadora ProSound Chile SpA", trade_name: "ProSound CL", tax_id: "76.543.210-K", country: "Chile", supplier_type: "importer", currency: "CLP", is_active: true, linked_products_count: 24, default_lead_time_days: 3 },
      ],
    }
  }
  if (url.includes("/admin/purchase-orders")) {
    return {
      count: 2,
      results: [
        { id: "po-1", po_number: "OC-2026-0041", supplier_name: "Synthax GmbH Audio", warehouse_name: "Bodega Central Santiago", status: "issued", currency: "USD", total_amount: "7200.00", expected_date: "2026-12-02", created_at: "2026-11-20T10:00:00Z" },
        { id: "po-2", po_number: "OC-2026-0042", supplier_name: "Importadora ProSound Chile SpA", warehouse_name: "Bodega Central Santiago", status: "received", currency: "CLP", total_amount: "4850000.00", expected_date: "2026-11-22", created_at: "2026-11-18T09:30:00Z" },
      ],
    }
  }
  if (url.includes("/admin/goods-receipts")) {
    return {
      results: [
        { id: "gr-1", receipt_number: "GR-2026-0019", po_number: "OC-2026-0042", warehouse_name: "Bodega Central Santiago", status: "confirmed", received_at: "2026-11-22T15:00:00Z" },
      ],
    }
  }
  if (url.includes("/admin/costing/landed-cost")) {
    return {
      results: [
        { id: "lc-1", allocation_number: "LC-2026-0011", goods_receipt_number: "GR-2026-0019", proration_method: "by_cif_value", status: "finalized", base_currency: "CLP", total_fob_clp: "4100000.00", total_expenses_clp: "750000.00", total_landed_clp: "4850000.00", created_at: "2026-11-22T16:30:00Z" },
      ],
    }
  }
  if (url.includes("/admin/costing/layers")) {
    return {
      summary: { active_skus: 24, total_units: 142, total_valuation_clp: "64800000.00" },
      results: [
        { id: "cl-1", sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", warehouse_code: "SCL-CENTRAL", remaining_qty: 6, wac_unit_cost_clp: "684000.00", sale_price_clp: "990000.00", gross_margin_pct: "30.91" },
        { id: "cl-2", sku: "GEN-8030C", product_name: "Genelec 8030C Par Monitores", warehouse_code: "SCL-CENTRAL", remaining_qty: 4, wac_unit_cost_clp: "1020000.00", sale_price_clp: "1490000.00", gross_margin_pct: "31.54" },
      ],
    }
  }
  if (url.includes("/admin/costing/margins") || url.includes("/admin/costing/proposals")) {
    return {
      results: [
        { id: "mp-1", sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", current_price_clp: "990000.00", wac_cost_clp: "684000.00", margin_pct: "30.91", target_min_margin_pct: "25.00", status: "healthy" },
      ],
    }
  }
  if (url.includes("/admin/inventory/summary")) {
    return {
      valor_inventario: 64800000,
      valor_venta: 94200000,
      ganancia_potencial: 29400000,
      total_productos: 64,
      sin_stock: 2,
      stock_critico: 4,
      stock_ok: 58,
    }
  }
  if (url.includes("/admin/inventory/alerts")) {
    return {
      sin_stock: [{ id: "p-2", name: "Neumann TLM 103 Studio Set", sku: "NEU-TLM103", stock: 0, stock_min: 2 }],
      stock_critico: [{ id: "p-3", name: "Focusrite Scarlett 2i2 Gen 4", sku: "FOC-2I2-G4", stock: 2, stock_min: 3 }],
    }
  }
  if (url.includes("/admin/inventory/rotation")) {
    return {
      currency: "CLP",
      results: [
        { product_id: "p-1", name: "RME Babyface Pro FS", sku: "RME-BF-FS", units_sold: 14, current_stock: 6, revenue: "13860000.00" },
      ],
    }
  }
  if (url.includes("/admin/inventory/warehouses")) {
    return {
      results: [
        { id: "wh-1", code: "SCL-CENTRAL", name: "Bodega Central Santiago", warehouse_type: "central", is_default: true, is_active: true, can_dispatch: true, can_receive: true },
        { id: "wh-2", code: "SCL-LAB", name: "Laboratorio Técnico & RMA", warehouse_type: "technical", is_default: false, is_active: true, can_dispatch: false, can_receive: true },
      ],
    }
  }
  if (url.includes("/admin/inventory/stocks") || url.includes("/admin/inventory/kardex") || url.includes("/admin/inventory/transfers") || url.includes("/admin/inventory/reservations") || url.includes("/admin/serials")) {
    return {
      count: 2,
      results: [
        { id: "st-1", sku: "RME-BF-FS", product_name: "RME Babyface Pro FS", warehouse_code: "SCL-CENTRAL", warehouse_name: "Bodega Central Santiago", on_hand: 6, reserved: 1, available: 5, in_transit: 0, damaged: 0, serial_number: "SN-RME-2026-0091", status: "available" },
      ],
    }
  }
  if (url.includes("/admin/orders/manual") || url.includes("/admin/orders/fulfillment-queue") || url.includes("/admin/orders/rmas")) {
    return { count: 1, results: [] }
  }
  if (url.includes("/admin/orders")) {
    return {
      count: 2,
      results: [
        { id: "ord-1", short_id: "ORD-901A", user_name: "Estudio Master CL", email: "contacto@estudiomaster.cl", status: "paid", commercial_status: "confirmed", financial_status: "paid", fulfillment_status: "allocated", order_origin: "online", currency: "CLP", total: "990000.00", created_at: "2026-11-24T14:00:00Z" },
        { id: "ord-2", short_id: "ORD-902B", user_name: "Acoustic Lab BA", email: "compras@acousticlab.ar", status: "pending", commercial_status: "confirmed", financial_status: "pending", fulfillment_status: "unfulfilled", order_origin: "b2b", currency: "USD", total: "1050.00", created_at: "2026-11-24T15:00:00Z" },
      ],
    }
  }
  if (url.includes("/admin/special-orders")) {
    return {
      results: [
        { id: "so-1", name: "Estudio Cordillera", email: "ingenieria@cordillera.cl", phone: "+56988776655", equipment: " Rupert Neve Designs MBP Master Buss Processor", brand_model: "RND Portico II", quantity: 1, budget: "4200000.00", status: "quoted", created_at: "2026-11-23T12:00:00Z" },
      ],
    }
  }
  if (url.includes("/admin/b2b/quotes")) {
    return {
      count: 2,
      results: [
        { id: "b2b-1", quote_number: "COT-B2B-2026-018", company_name: " Universidad de las Artes Sonoras", contact_name: "Dr. Roberto Silva", email: "compras@uartes.cl", tax_id: "60.911.000-1", status: "approved", currency: "CLP", total_amount: "8450000.00", discount_percent: 12, created_at: "2026-11-21T11:00:00Z" },
      ],
    }
  }
  if (url.includes("/admin/b2b/price-lists") || url.includes("/admin/b2b/credit-accounts") || url.includes("/admin/crm/")) {
    return {
      count: 1,
      results: [
        { id: "org-1", name: "Universidad de las Artes Sonoras", tax_id: "60.911.000-1", org_type: "institution", status: "active", credit_limit: "15000000.00", currency: "CLP" },
      ],
    }
  }
  if (url.includes("/admin/payments")) {
    return {
      count: 2,
      results: [
        { id: "pay-1", order_id: "ord-1-901a-uuid", order_email: "contacto@estudiomaster.cl", provider: "mercadopago_cl", amount: "990000.00", currency: "CLP", status: "approved", created_at: "2026-11-24T14:02:00Z" },
        { id: "pay-2", order_id: "ord-2-902b-uuid", order_email: "compras@acousticlab.ar", provider: "transfer", amount: "1050.00", currency: "USD", status: "pending", created_at: "2026-11-24T15:05:00Z" },
      ],
    }
  }
  if (url.includes("/payments/admin/payment-methods")) {
    return {
      results: [
        { id: "pm-1", method: "mercadopago_cl", label: "MercadoPago Chile (Webpay / Tarjetas)", currencies: "CLP", is_active: true, order: 1 },
        { id: "pm-2", method: "transfer", label: "Transferencia Bancaria Conciliada", currencies: "CLP", is_active: true, order: 2 },
        { id: "pm-3", method: "paypal", label: "PayPal Internacional", currencies: "USD", is_active: true, order: 3 },
      ],
    }
  }
  if (url.includes("/payments/admin/bank-accounts")) {
    return {
      results: [
        { id: "ba-1", bank_name: "Banco de Chile", account_type: "Cuenta Corriente", account_number: "00-192-88412-09", holder_name: "LevelPro Audio SpA", tax_id: "77.123.456-7", email: "tesoreria@levelpro.cl", currency: "CLP", is_active: true },
      ],
    }
  }
  if (url.includes("/billing/dashboard")) {
    return {
      summary: { total_paid_orders: 28, emitidos: 25, pendientes: 3 },
      results: [
        { order_id: "ord-1", order_short: "ORD-901A", cliente: "Estudio Master CL", email: "contacto@estudiomaster.cl", total: "990000.00", currency: "CLP", fecha_orden: "2026-11-24T14:00:00Z", documento: { id: "doc-1", tipo: "factura", numero_externo: "F-004918", estado: "emitido", monto: "990000.00", fecha_emision: "2026-11-24" } },
      ],
    }
  }
  if (url.includes("/admin/finance/summary")) {
    return {
      currency: "CLP",
      ingresos_brutos: 18450000,
      ingresos_conciliados: 16900000,
      retiros_totales: 4200000,
      saldo_disponible: 12700000,
      por_conciliar: 1550000,
      categories: [
        { id: "fc-1", name: "Reposición Inventario", icon: "📦", color: "#1AFF6E", percentage: 50, balance: 6350000, is_active: true },
        { id: "fc-2", name: "Operación & Logística", icon: "⚡", color: "#38BDF8", percentage: 30, balance: 3810000, is_active: true },
        { id: "fc-3", name: "Reserva Tributaria", icon: "🏛️", color: "#F59E0B", percentage: 20, balance: 2540000, is_active: true },
      ],
    }
  }
  if (url.includes("/admin/finance/")) {
    return { count: 0, results: [], summary: {} }
  }
  if (url.includes("/admin/logistics/overview/")) {
    return {
      kpis: { ready_orders_count: 2, active_shipments_count: 3, open_manifests_count: 1, open_warranties_count: 2, active_repairs_count: 2 },
      ready_orders: [{ id: "ord-1", order_short: "ORD-901A", customer_email: "contacto@estudiomaster.cl", fulfillment_status: "allocated", currency: "CLP", total: "990000.00", shipping_address: "Av. Providencia 1200, Santiago" }],
    }
  }
  if (url.includes("/admin/logistics/")) {
    return { count: 1, results: [{ id: "shp-1", shipment_number: "SHP-2026-0081", tracking_number: "CLX-998811", status: "in_transit", carrier_name: "Chilexpress", destination_city: "Santiago" }] }
  }
  if (url.includes("/admin/marketing/dashboard/")) {
    return {
      kpis: { active_coupons: 3, active_promotions: 1, scheduled_promotions: 2, abandoned_eligible: 2, abandoned_recovered: 1, abandoned_suppressed: 1, outbox_messages: 3, consented_contacts: 14, suppressed_contacts: 1 },
      redemptions_by_currency: [
        { currency: "CLP", count: 8, total_discount: "160000.00" },
        { currency: "USD", count: 3, total_discount: "75.00" },
        { currency: "ARS", count: 2, total_discount: "45000.00" },
      ],
      loyalty_summary: { accounts_count: 18, total_points_balance: 42500 },
      rewards_summary: { campaigns_count: 2, active_campaigns: 1, stickers_count: 15, winners_count: 1 },
    }
  }
  if (url.includes("/admin/marketing/coupons/")) {
    return {
      results: [
        { id: "c-1", code: "STUDIO10CLP", name: "Estudios 10% CLP", currency: "CLP", discount_type: "percentage", discount_value: "10.00", used_count: 4, max_total_uses: 50, accumulation_rule: "blocked", min_eligible_amount: "50000.00", min_margin_percent: "15.00", status: "active" },
        { id: "c-2", code: "PROAUDIO25USD", name: "25 USD Off", currency: "USD", discount_type: "fixed_amount", discount_value: "25.00", used_count: 2, max_total_uses: 20, accumulation_rule: "allow_with_promotion", min_eligible_amount: "150.00", min_margin_percent: "12.00", status: "active" },
      ],
    }
  }
  if (url.includes("/admin/marketing/")) {
    return { results: [] }
  }
  if (url.includes("/admin/cms/versions/ver-") && url.includes("/preview/")) {
    return {
      version_id: "ver-2",
      version_number: 2,
      status: "draft",
      checksum_sha256: "b1c2d3e4f5a678901234567890abcdef",
      payload: {
        site_name: "LevelPro Audio",
        hero_title: "Sonido de Precisión para Estudios Exigentes",
        hero_subtitle: "Interfaces, monitores y conversión AD/DA con soporte técnico certificado.",
        hero_cta1_text: "Explorar Catálogo",
        hero_cta1_link: "/shop",
        seo_title: "LevelPro Audio · Ingeniería & Equipamiento Pro",
      },
    }
  }
  if (url.includes("/admin/cms/versions/ver-")) {
    return {
      id: "ver-2",
      version_id: "ver-2",
      version_number: 2,
      status: "draft",
      change_summary: "Campaña Estudio Mastering Q4",
      checksum_sha256: "b1c2d3e4f5a678901234567890abcdef",
      created_by_email: "marketing@levelpro.cl",
      created_at: "2026-11-24T03:00:00Z",
      payload: {
        site_name: "LevelPro Audio",
        hero_title: "Sonido de Precisión para Estudios Exigentes",
        hero_subtitle: "Interfaces, monitores y conversión AD/DA con soporte técnico certificado.",
        hero_cta1_text: "Explorar Catálogo",
        hero_cta1_link: "/shop",
        seo_title: "LevelPro Audio · Ingeniería & Equipamiento Pro",
        show_trust_strip: true,
        show_pillars: true,
        show_products: true,
        show_courses: true,
        show_services: true,
        show_about: true,
        show_testimonial: true,
        show_brands: true,
        show_final_cta: true,
      },
      hero_slides: [
        { id: "sl-1", order: 1, title: "Mastering Grade AD/DA", subtitle: "RME & Neumann en stock inmediato", cta1_text: "Ver Interfaces", cta1_link: "/shop", desktop_image: { title: "Hero Studio Desk" }, mobile_image: { title: "Hero Studio Mob" } },
      ],
      announcements: [
        { id: "ann-1", text: "Despacho asegurado a todo Chile y Latinoamérica", currency: "ALL", link_url: "/shop", status: "active" },
      ],
    }
  }
  if (url.includes("/admin/cms/versions/")) {
    return {
      results: [
        { id: "ver-2", version_id: "ver-2", version_number: 2, status: "draft", change_summary: "Campaña Estudio Mastering Q4", checksum_sha256: "b1c2d3e4f5a67890", is_rollback: false, created_by_email: "marketing@levelpro.cl", created_at: "2026-11-24T03:00:00Z" },
        { id: "ver-1", version_id: "ver-1", version_number: 1, status: "published", change_summary: "Baseline Oficial Gate 12", checksum_sha256: "a1b2c3d4e5f60987", is_rollback: false, published_by_email: "gerencia@levelpro.cl", published_at: "2026-11-24T02:00:00Z", created_at: "2026-11-24T01:50:00Z" },
      ],
    }
  }
  if (url.includes("/admin/cms/assets/")) {
    return {
      results: [
        { id: "ast-1", title: "Hero Studio Master Desktop", device_target: "desktop", width: 1920, height: 820, file_format: "WEBP", sha256: "9f8e7d6c5b4a32109f8e7d6c5b4a3210" },
        { id: "ast-2", title: "Hero Studio Master Mobile", device_target: "mobile", width: 780, height: 1100, file_format: "WEBP", sha256: "1a2b3c4d5e6f78901a2b3c4d5e6f7890" },
      ],
    }
  }
  if (url.includes("/admin/cms/banners/")) {
    return {
      results: [
        { id: "bn-1", code: "HOME-MID-RME", name: "Banner Interfaces RME", title: "Conversión SteadyClock FS", cta_link: "/shop", target_page: "home", status: "active" },
      ],
    }
  }
  if (url.includes("/admin/cms/events/")) {
    return {
      results: [
        { id: "ev-1", version_number: 1, event_type: "PUBLISHED", actor_email: "gerencia@levelpro.cl", checksum_sha256: "a1b2c3d4e5f60987", occurred_at: "2026-11-24T02:00:00Z" },
      ],
    }
  }
  if (url.includes("/admin/academy/courses")) {
    return {
      count: 2,
      results: [
        { id: "crs-1", title: "Mastering Híbrido Analógico & Digital", slug: "mastering-hibrido", level: "advanced", price: "180000.00", price_usd: "190.00", is_published: true, is_free: false, modules_count: 4, enrollments_count: 58 },
        { id: "crs-2", title: "Acústica y Calibración de Salas de Control", slug: "acustica-salas", level: "intermediate", price: "140000.00", price_usd: "150.00", is_published: true, is_free: false, modules_count: 3, enrollments_count: 84 },
      ],
    }
  }
  if (url.includes("/admin/academy/modules")) {
    return {
      count: 2,
      results: [
        { id: "mod-1", title: "1. Cadena de Ganancia y Headroom", order: 1, course: "crs-1", course_title: "Mastering Híbrido Analógico & Digital", lessons_count: 5 },
        { id: "mod-2", title: "2. Compresión Paralela y Limitación True Peak", order: 2, course: "crs-1", course_title: "Mastering Híbrido Analógico & Digital", lessons_count: 6 },
      ],
    }
  }
  if (url.includes("/admin/academy/lessons")) {
    return {
      count: 2,
      results: [
        { id: "les-1", title: "Calibración de Conversores AD/DA a -18 dBFS", order: 1, module: "mod-1", module_title: "1. Cadena de Ganancia y Headroom", course_title: "Mastering Híbrido Analógico & Digital", duration_minutes: 28, is_free: true },
        { id: "les-2", title: "Inserción de Hardware Externo en Cadena", order: 2, module: "mod-1", module_title: "1. Cadena de Ganancia y Headroom", course_title: "Mastering Híbrido Analógico & Digital", duration_minutes: 34, is_free: false },
      ],
    }
  }
  if (url.includes("/admin/academy/enrollments")) {
    return {
      count: 2,
      results: [
        { id: "enr-1", user_name: "Diego Productor", user_email: "diego@estudio.cl", course_title: "Mastering Híbrido Analógico & Digital", progress: 85, completed: false, enrolled_at: "2026-11-10T12:00:00Z" },
        { id: "enr-2", user_name: "Valentina Ingeniera", user_email: "val@mastering.cl", course_title: "Acústica y Calibración de Salas de Control", progress: 100, completed: true, enrolled_at: "2026-11-01T15:00:00Z" },
      ],
    }
  }
  if (url.includes("/admin/academy/certifications")) {
    return {
      count: 1,
      results: [
        { id: "cert-1", title: "Certificación Profesional en Ingeniería de Mastering", description: "Acredita dominio de flujo híbrido y calibración electroacústica.", seal_label: "Ingeniero Certificado LevelPro", is_published: true, order: 1, courses: [{ id: "crs-1", title: "Mastering Híbrido Analógico & Digital" }] },
      ],
    }
  }
  if (url.includes("/admin/services/list") || url.includes("/services/")) {
    return {
      results: [
        { id: "srv-1", name: "Calibración Electroacústica de Estudio", slug: "calibracion-estudio", price: "250000.00", price_usd: "265.00", price_type: "fixed", is_active: true, is_featured: true, duration_hours: 4 },
      ],
    }
  }
  if (url.includes("/admin/service-requests")) {
    return {
      results: [
        { id: "sr-1", service_name: "Calibración Electroacústica de Estudio", name: "Sala Mastering Sur", email: "sur@audio.cl", phone: "+56988771122", status: "pending", message: "Solicitamos medición RTA y ajuste de monitores Genelec.", created_at: "2026-11-24T11:00:00Z" },
      ],
    }
  }
  if (url.includes("/admin/bookings")) {
    return { results: [] }
  }
  if (url.includes("/loyalty/admin/summary")) {
    return {
      total_accounts: 148,
      total_points_circulating: 84500,
      points_redeemed_month: 12400,
      top_accounts: [
        { id: "la-1", user_id: "c-1", user_name: "Estudio Master CL", user_email: "contacto@estudiomaster.cl", tier: "gold", puntos_disponibles: 14500, puntos_historicos: 28000 },
      ],
    }
  }
  if (url.includes("/loyalty/admin/config")) {
    return { points_per_thousand_clp: 10, clp_per_point_redeemed: 1, min_points_to_redeem: 1000, max_discount_percent: 25, is_active: true }
  }
  if (url.includes("/admin/rewards/dashboard")) {
    return {
      currency: "CLP",
      totals: { campaigns: 3, entries: 412, participants: 129, related_revenue: 9450000 },
      current_campaign: { id: "rc-1", name: "Sorteo Aniversario RME Babyface Pro FS", main_prize: "RME Babyface Pro FS", status: "active", total_entries: 284, total_participants: 96, products_count: 14, conversion_rate: 18.4, seconds_remaining: 432000, draw_date: "2026-12-15T20:00:00Z" },
      recent_campaigns: [
        { id: "rc-1", name: "Sorteo Aniversario RME Babyface Pro FS", main_prize: "RME Babyface Pro FS", status: "active", entries: 284, draw_date: "2026-12-15T20:00:00Z" },
        { id: "rc-2", name: "Sorteo Monitores Genelec 8030C", main_prize: "Par Genelec 8030C", status: "finished", entries: 128, draw_date: "2026-10-30T20:00:00Z" },
      ],
    }
  }
  if (url.includes("/admin/rewards/campaigns/rc-1")) {
    return {
      id: "rc-1",
      name: "Sorteo Aniversario RME Babyface Pro FS",
      slug: "sorteo-aniversario-rme",
      main_prize: "RME Babyface Pro FS",
      description: "Participa comprando equipamiento seleccionado o stickers oficiales.",
      status: "active",
      draw_date: "2026-12-15T20:00:00Z",
      total_entries: 284,
      total_participants: 96,
      reward_products: [{ id: "rp-1", product_id: "p-1", product_name: "RME Babyface Pro FS", multiplier: 3 }],
    }
  }
  if (url.includes("/admin/rewards/campaigns")) {
    return {
      results: [
        { id: "rc-1", name: "Sorteo Aniversario RME Babyface Pro FS", main_prize: "RME Babyface Pro FS", status: "active", draw_date: "2026-12-15T20:00:00Z", total_entries: 284, total_participants: 96 },
      ],
    }
  }
  if (url.includes("/admin/rewards/entries")) {
    return [
      { id: "re-1", unique_code: "LP-2026-8841", user_email: "contacto@estudiomaster.cl", campaign_name: "Sorteo Aniversario RME Babyface Pro FS", source: "order", created_at: "2026-11-24T14:05:00Z" },
    ]
  }
  if (url.includes("/admin/rewards/winners")) {
    return [
      { id: "rw-1", unique_code: "LP-2026-1042", user_name: "Estudio Cordillera", user_email: "ingenieria@cordillera.cl", campaign_name: "Sorteo Monitores Genelec", is_backup: false, notes: "Premio entregado con acta firmada." },
    ]
  }
  if (url.includes("/admin/users")) {
    return {
      count: 2,
      results: [
        { id: "u-1", email: "admin@levelpro.cl", first_name: "Ignacio", last_name: "LevelPro", is_staff: true, is_superuser: true, is_active: true, roles: ["Super Admin"], date_joined: "2026-01-10T10:00:00Z" },
        { id: "c-1", email: "contacto@estudiomaster.cl", first_name: "Estudio", last_name: "Master CL", is_staff: false, is_superuser: false, is_active: true, roles: [], date_joined: "2026-03-14T15:00:00Z" },
      ],
    }
  }
  if (url.includes("/admin/roles/")) {
    return {
      roles: [
        { name: "Super Admin", description: "Autoridad total sobre todos los módulos y capacidades críticas.", users_count: 1, modules: ["dashboard", "catalog", "orders", "inventory", "purchases", "logistics", "finances", "marketing", "academy", "services", "roles", "settings", "audit"], capabilities: ["view_costs", "edit_costs", "view_margins", "view_finances", "manage_finances", "manage_roles", "manage_settings"] },
        { name: "Gerencia / Administración", description: "Supervisión ejecutiva, finanzas, aprobaciones B2B y publicación CMS.", users_count: 2, modules: ["dashboard", "catalog", "orders", "inventory", "purchases", "logistics", "finances", "marketing", "settings", "audit"], capabilities: ["view_costs", "view_margins", "view_finances", "manage_settings"] },
        { name: "Bodega", description: "Operación WMS, Kardex, recepciones y despacho físico.", users_count: 3, modules: ["inventory", "logistics"], capabilities: ["adjust_inventory"] },
      ],
    }
  }
  if (url.includes("/admin/permissions/catalog")) {
    return { modules: ["dashboard", "catalog", "orders", "inventory", "purchases", "logistics", "finances", "marketing", "academy", "services", "roles", "settings", "audit"], capabilities: ["view_costs", "edit_costs", "view_margins", "view_finances", "manage_finances", "manage_roles", "manage_settings"] }
  }
  if (url.includes("/admin/audit/summary")) {
    return { total_events: 1284, high_severity_count: 14, denied_count: 3, financial_ops_count: 96 }
  }
  if (url.includes("/admin/audit/catalog")) {
    return { modules: ["catalog", "orders", "inventory", "finances", "settings"], severities: ["info", "warning", "high"] }
  }
  if (url.includes("/admin/audit/events")) {
    return {
      count: 2,
      results: [
        { id: "aud-1", action: "CMS_VERSION_PUBLISHED", category: "modification", module: "settings", severity: "info", result: "success", actor_email: "gerencia@levelpro.cl", target_repr: "CMSVersion v1", timestamp: "2026-11-24T02:00:00Z" },
        { id: "aud-2", action: "PRICE_CHANGED", category: "price_change", module: "catalog", severity: "warning", result: "success", actor_email: "admin@levelpro.cl", target_repr: "RME Babyface Pro FS", timestamp: "2026-11-23T18:10:00Z" },
      ],
    }
  }
  return { count: 0, results: [] }
}

export const ROUTES_TO_CAPTURE = [
  { path: "/admin", file: "01-dashboard.png", label: "Dashboard Ejecutivo" },
  { path: "/admin/products", file: "04-pim-products.png", label: "Catálogo PIM" },
  { path: "/admin/orders", file: "05-orders-oms.png", label: "Pedidos OMS" },
  { path: "/admin/inventory", file: "06-wms-inventory.png", label: "Inventario WMS" },
  { path: "/admin/procurement", file: "07-procurement.png", label: "Compras & OC" },
  { path: "/admin/finance", file: "08-finance.png", label: "Finanzas & Tesorería" },
  { path: "/admin/b2b", file: "09-crm-b2b.png", label: "CRM & Cotizaciones B2B" },
  { path: "/admin/logistics", file: "10-logistics.png", label: "Logística & Posventa" },
  { path: "/admin/marketing", file: "11-marketing.png", label: "Marketing & Growth" },
  { path: "/admin/settings", file: "12-cms-settings.png", label: "Editorial Bento CMS" },
  { path: "/admin/academy", file: "13-academy.png", label: "Academia" },
  { path: "/admin/services", file: "14-services.png", label: "Servicios" },
  { path: "/admin/loyalty", file: "15-loyalty.png", label: "Loyalty" },
  { path: "/admin/rewards", file: "16-rewards.png", label: "Rewards" },
]

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath)
  return crypto.createHash("sha256").update(buf).digest("hex")
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const commitSha = execSync("git rev-parse HEAD", { cwd: TARGET_ROOT, encoding: "utf8" }).trim()
  const port = MODE === "before" ? 4191 : 4192

  const server = await preview({ root: TARGET_ROOT, preview: { port, host: "127.0.0.1" } })
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
  const manifestEntries = []

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    await page.route("**/api/v1/**", async (route) => {
      const data = SYNTHETIC_API_MOCKS(route.request().url())
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) })
    })

    await page.addInitScript(() => {
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: { id: "u1", email: "admin@levelpro.cl", first_name: "Ignacio", last_name: "LevelPro", is_staff: true, is_superuser: true, roles: ["Super Admin"] } },
        version: 0,
      }))
      document.cookie = "csrftoken=mockcsrftoken; path=/"
    })

    for (const r of ROUTES_TO_CAPTURE) {
      await page.goto(`http://127.0.0.1:${port}${r.path}`, { waitUntil: "networkidle" })
      await page.waitForTimeout(350)
      const bodyText = await page.locator("body").innerText()
      if (bodyText.includes("Algo salió mal")) {
        throw new Error(`CRITICAL_RENDER_ERROR: 'Algo salió mal' detected on ${r.path} in mode=${MODE}`)
      }
      const outPath = path.join(OUT_DIR, r.file)
      await page.screenshot({ path: outPath, fullPage: true })
      manifestEntries.push({
        file: r.file,
        route: r.path,
        label: r.label,
        mode: MODE,
        commit_sha: commitSha,
        viewport: "1440x900",
        user_role: "Super Admin (admin@levelpro.cl)",
        fixture: "SYNTHETIC_API_MOCKS_V2",
        captured_at: new Date().toISOString(),
        sha256: sha256File(outPath),
      })
    }

    // Capture 02-command-palette.png and 03-notifications.png on /admin
    await page.goto(`http://127.0.0.1:${port}/admin`, { waitUntil: "networkidle" })
    await page.waitForTimeout(250)
    const searchBtn = page.locator('[data-testid="admin-search-btn"], [data-testid="admin-command-palette-trigger"]').first()
    if (await searchBtn.count()) {
      await searchBtn.click()
      await page.waitForTimeout(200)
      const inp = page.locator('[data-testid="admin-command-palette-input"], input[placeholder*="Buscar"]').first()
      if (await inp.count()) {
        await inp.fill("RME")
        await page.waitForTimeout(350)
      }
      const cpPath = path.join(OUT_DIR, "02-command-palette.png")
      await page.screenshot({ path: cpPath, fullPage: false })
      manifestEntries.push({
        file: "02-command-palette.png",
        route: "/admin (Command Palette Modal)",
        label: "Command Palette (Cmd+K)",
        mode: MODE,
        commit_sha: commitSha,
        viewport: "1440x900",
        user_role: "Super Admin (admin@levelpro.cl)",
        fixture: "SYNTHETIC_API_MOCKS_V2",
        captured_at: new Date().toISOString(),
        sha256: sha256File(cpPath),
      })
      await page.keyboard.press("Escape")
      await page.waitForTimeout(150)
    }

    const bellBtn = page.locator('[data-testid="admin-notifications-btn"]').first()
    if (await bellBtn.count()) {
      await bellBtn.click()
      await page.waitForTimeout(250)
      const notifPath = path.join(OUT_DIR, "03-notifications.png")
      await page.screenshot({ path: notifPath, fullPage: false })
      manifestEntries.push({
        file: "03-notifications.png",
        route: "/admin (Notification Center)",
        label: "Notification Center (BF-32)",
        mode: MODE,
        commit_sha: commitSha,
        viewport: "1440x900",
        user_role: "Super Admin (admin@levelpro.cl)",
        fixture: "SYNTHETIC_API_MOCKS_V2",
        captured_at: new Date().toISOString(),
        sha256: sha256File(notifPath),
      })
    }

    manifestEntries.sort((a, b) => a.file.localeCompare(b.file))
    fs.writeFileSync(path.join(OUT_DIR, `manifest_${MODE}.json`), JSON.stringify(manifestEntries, null, 2))
    console.log(`GATE13_${MODE.toUpperCase()}_SCREENSHOTS_OK: ${manifestEntries.length} (SHA: ${commitSha})`)
  } finally {
    await browser.close()
    await server.httpServer.close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
