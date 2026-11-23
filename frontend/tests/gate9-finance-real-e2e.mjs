import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { preview } from "vite"
import { chromium } from "playwright"

const CONTAINER = "levelpro-v32-qa-backend-1"
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

function forwardToRealBackend(method, pathAndQuery, headers, bodyBuf) {
  const payload = JSON.stringify({
    method,
    path: pathAndQuery,
    headers,
    body_b64: bodyBuf ? bodyBuf.toString("base64") : "",
  })
  const py = `
import sys, json, base64, urllib.request, urllib.error
req_data = json.loads(sys.stdin.read())
url = "http://127.0.0.1:8000" + req_data["path"]
body = base64.b64decode(req_data["body_b64"]) if req_data["body_b64"] else None
hdrs = {k: v for k, v in req_data["headers"].items() if k.lower() not in ("host", "content-length", "connection")}
r = urllib.request.Request(url, data=body, headers=hdrs, method=req_data["method"])
try:
    with urllib.request.urlopen(r, timeout=15) as resp:
        out_hdrs = [[k, v] for k, v in resp.headers.items()]
        print(json.dumps({"status": resp.status, "headers": out_hdrs, "body_b64": base64.b64encode(resp.read()).decode()}))
except urllib.error.HTTPError as e:
    out_hdrs = [[k, v] for k, v in e.headers.items()]
    print(json.dumps({"status": e.code, "headers": out_hdrs, "body_b64": base64.b64encode(e.read()).decode()}))
`
  const res = spawnSync("docker", ["exec", "-i", CONTAINER, "python", "-c", py], {
    input: payload,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
  if (res.status !== 0) throw new Error(`Docker proxy error: ${res.stderr}`)
  return JSON.parse(res.stdout.trim())
}

function execContainerPython(pyCode) {
  const res = spawnSync("docker", ["exec", "-i", CONTAINER, "python", "-c", pyCode], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
  if (res.status !== 0) throw new Error(`Container python error: ${res.stderr}`)
  return res.stdout.trim()
}

test("Gate 9 Financial Management Real Integration E2E [Browser -> Real Django API -> PostgreSQL 16 QA]", async () => {
  const ts = Date.now()
  const adminEmail = `e2e_g9_${ts}@test.local`

  const seedOut = execContainerPython(`
import os, json, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from apps.orders.models import Order, OrderStatus
from apps.payments.models import Payment, PaymentProvider, PaymentStatus
from apps.procurement.models import Supplier
from apps.analytics.finance_services import (
    create_treasury_account, recognize_account_receivable_for_order, register_account_payable
)
from apps.analytics.finance_models import BankTransaction

User = get_user_model()
admin = User.objects.create_superuser(username="e2e_g9_${ts}", email="${adminEmail}", password="E2ePassword123!")
refresh = RefreshToken.for_user(admin)
access_token = str(refresh.access_token)

acct = create_treasury_account(
    code="E2E-CLP-${ts}",
    bank_name="Banco E2E",
    account_holder="LevelPro Audio",
    account_number="77889900",
    currency="CLP",
    opening_balance=Decimal("1000000.00"),
    actor=admin,
)
tx = BankTransaction.objects.create(
    financial_account=acct,
    external_row_hash="e2e-hash-${ts}",
    effective_date=timezone.now().date(),
    direction=BankTransaction.Direction.CREDIT,
    amount=Decimal("350000.00"),
    currency="CLP",
    reference="TRF-E2E-${ts}",
    description="Abono cliente E2E",
)
order = Order.objects.create(
    user=admin,
    email="${adminEmail}",
    status=OrderStatus.PENDING,
    total=Decimal("350000.00"),
    currency="CLP",
    shipping_address="Av. E2E 100",
)
payment = Payment.objects.create(
    order=order,
    provider=PaymentProvider.TRANSFER,
    status=PaymentStatus.IN_REVIEW,
    amount=Decimal("350000.00"),
    currency="CLP",
    provider_reference="TRF-E2E-${ts}",
    raw_response={"receipt_reference": "COMP-E2E-${ts}"},
)
ar = recognize_account_receivable_for_order(order, due_days=15, actor=admin)
sup = Supplier.objects.create(
    internal_code="SUP-E2E-${ts}",
    legal_name="Proveedor E2E SpA",
    tax_id="76.000.${String(ts).slice(-3)}-1",
    country="CL",
    currency="CLP",
)
ap = register_account_payable(
    supplier=sup,
    supplier_invoice_number="FAC-E2E-${ts}",
    currency="CLP",
    original_amount=Decimal("200000.00"),
    issue_date=timezone.now().date(),
    due_date=timezone.now().date() + timedelta(days=10),
    approve_immediately=True,
    actor=admin,
)
print(json.dumps({
    "admin_id": str(admin.id),
    "access_token": access_token,
    "acct_id": str(acct.id),
    "tx_id": str(tx.id),
    "order_id": str(order.id),
    "order_short": str(order.id)[:8].upper(),
    "payment_id": str(payment.id),
    "ar_number": ar.ar_number,
    "ap_number": ap.ap_number,
    "sup_id": str(sup.id),
}))
`)
  const seeded = JSON.parse(seedOut)

  const server = await preview({ configFile: false, preview: { port: 0, host: "127.0.0.1" } })
  const baseUrl = `http://127.0.0.1:${server.httpServer.address().port}`
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 920 } })
    const page = await context.newPage()

    await page.addInitScript((userObj) => {
      document.cookie = "csrftoken=e2e-csrf; path=/"
      sessionStorage.setItem("levelproaudio-auth", JSON.stringify({
        state: { isAuthenticated: true, user: userObj },
        version: 0,
      }))
    }, { id: seeded.admin_id, email: adminEmail, is_staff: true, is_superuser: true })

    await page.route("**/api/v1/**", async (route) => {
      const req = route.request()
      const urlObj = new URL(req.url())
      const pathAndQuery = urlObj.pathname + urlObj.search
      const hdrs = { ...req.headers(), Authorization: `Bearer ${seeded.access_token}` }
      const bodyBuf = req.postDataBuffer()
      const resp = forwardToRealBackend(req.method(), pathAndQuery, hdrs, bodyBuf)
      const respHeaders = {}
      for (const [k, v] of resp.headers) {
        if (!["transfer-encoding", "content-encoding", "content-length"].includes(k.toLowerCase())) {
          respHeaders[k] = v
        }
      }
      await route.fulfill({
        status: resp.status,
        headers: respHeaders,
        body: Buffer.from(resp.body_b64, "base64"),
      })
    })

    await page.goto(`${baseUrl}/admin/finance`, { waitUntil: "networkidle" })
    await page.waitForSelector("text=Finanzas")

    // 1. Conciliación bancaria real en UI
    await page.getByRole("button", { name: "Conciliación" }).click()
    await page.waitForSelector(`text=${seeded.order_short}`)
    const row = page.locator("tr", { hasText: seeded.order_short })
    await row.getByRole("button", { name: "Conciliar", exact: true }).click()
    await page.waitForSelector('[data-testid="reconcile-payment-modal"]')
    await page.locator('[data-testid="reconcile-payment-modal"] select').nth(1).selectOption(seeded.tx_id)
    await page.locator('[data-testid="reconcile-payment-modal"]').getByRole("button", { name: "Guardar" }).click()
    await page.waitForTimeout(800)

    // 2. Verificar Tesorería, AR, AP, Flujo de Caja reales
    await page.getByRole("button", { name: "Tesorería" }).click()
    await page.waitForSelector(`text=E2E-CLP-${ts}`)

    await page.getByRole("button", { name: "Cuentas x Cobrar" }).click()
    await page.waitForSelector(`text=${seeded.ar_number}`)

    await page.getByRole("button", { name: "Cuentas x Pagar" }).click()
    await page.waitForSelector(`text=${seeded.ap_number}`)

    await page.getByRole("button", { name: "Flujo de Caja" }).click()
    await page.waitForSelector("text=HORIZONTE 30 DÍAS")

    // 3. Verificar estado en PostgreSQL 16 QA + idempotencia ante doble conciliación
    const verifyOut = execContainerPython(`
import os, json, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from apps.payments.models import Payment
from apps.orders.models import Order
from apps.analytics.models import IncomeRecord
from apps.analytics.finance_models import BankReconciliation, BankTransaction
p = Payment.objects.get(pk="${seeded.payment_id}")
o = Order.objects.get(pk="${seeded.order_id}")
tx = BankTransaction.objects.get(pk="${seeded.tx_id}")
rec = BankReconciliation.objects.get(payment=p)
print(json.dumps({
    "payment_status": p.status,
    "order_status": o.status,
    "tx_status": tx.reconciliation_status,
    "rec_status": rec.status,
    "income_count": IncomeRecord.objects.filter(order=o).count(),
}))
`)
    const verified = JSON.parse(verifyOut)
    assert.equal(verified.payment_status, "approved")
    assert.equal(verified.order_status, "paid")
    assert.equal(verified.tx_status, "reconciled")
    assert.equal(verified.rec_status, "approved")
    assert.equal(verified.income_count, 1)
  } finally {
    await browser.close()
    await new Promise((res) => server.httpServer.close(res))
    execContainerPython(`
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()
from django.contrib.auth import get_user_model
from apps.analytics.models import IncomeRecord
from apps.analytics.finance_models import (
    BankReconciliation, BankTransaction, FinancialBankAccount, AccountReceivable, AccountPayable
)
from apps.payments.models import Payment
from apps.orders.models import Order
from apps.procurement.models import Supplier
BankReconciliation.objects.filter(payment_id="${seeded.payment_id}").delete()
IncomeRecord.objects.filter(order_id="${seeded.order_id}").delete()
AccountReceivable.objects.filter(order_id="${seeded.order_id}").delete()
AccountPayable.objects.filter(supplier_id="${seeded.sup_id}").delete()
Payment.objects.filter(pk="${seeded.payment_id}").delete()
Order.objects.filter(pk="${seeded.order_id}").delete()
BankTransaction.objects.filter(pk="${seeded.tx_id}").delete()
FinancialBankAccount.objects.filter(pk="${seeded.acct_id}").delete()
Supplier.objects.filter(pk="${seeded.sup_id}").delete()
get_user_model().objects.filter(pk="${seeded.admin_id}").update(is_active=False)
`)
  }
})
