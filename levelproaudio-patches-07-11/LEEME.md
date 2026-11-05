# LevelPro Audio — Paquete de patches 07 a 11

**Base exacta:** `58ee09609cd2b3bfbee5a4b0e97d907331d1f503`, el patch 06 ya
integrado y con Cloud Build exitoso. Este paquete contiene los cinco pendientes.
No incluye ni vuelve a aplicar los patches 01–06.

## Contenido

| Patch | Cambio |
| --- | --- |
| 07 | Instrucciones de transferencia recuperables al recargar, cuentas por método y moneda. |
| 08 | Errores internos seguros y validación del panel. |
| 09 | Escape de JSON-LD conservando los valores originales. |
| 10 | SEO por página en el HTML inicial y metadatos sin duplicados al navegar. |
| 11 | Carga de páginas por ruta, imágenes diferidas y límite de JavaScript inicial. |

`levelproaudio-07-11-completo.patch` aplica todos los cambios de una vez.
La carpeta `patches/` contiene los cinco incrementos en orden. **Elegí una sola
modalidad: acumulado o individuales. No apliques ambas.**

## Opción recomendada — aplicar todo de una vez

1. Abrí una terminal en la raíz de tu repo `levelproaudio`.
2. Descomprimí este ZIP allí. Debe quedar la carpeta `levelproaudio-patches-07-11/`.
3. Ejecutá exactamente:

```bash
bash levelproaudio-patches-07-11/APLICAR.sh comprobar &&
bash levelproaudio-patches-07-11/APLICAR.sh aplicar &&
git commit -m "fix: complete payment, SEO and performance patches 07-11" &&
git push
```

El script comprueba el commit base, que no haya cambios locales preparados o sin
preparar, las sumas SHA-256 y `git apply --check --index`. Luego aplica el patch
acumulado y deja los archivos modificados en el índice. No agrega el ZIP ni esta
carpeta al commit; no usa `git add .`. El script no hace commit, push, despliegue,
llamadas a APIs, cambios de secretos ni migraciones en una base de datos.

Si preferís revisar antes del commit, ejecutá solo `comprobar` y `aplicar`,
revisá `git diff --cached`, y después hacé el commit y push de arriba.

## Alternativa — los cinco archivos, en orden

Esta opción parte también del patch 06 limpio; no la uses si ya aplicaste el
acumulado. Primero se simula toda la serie en un índice temporal:

```bash
bash levelproaudio-patches-07-11/APLICAR.sh comprobar-serie &&
git apply --index levelproaudio-patches-07-11/patches/07-transfer-instructions.patch &&
git apply --index levelproaudio-patches-07-11/patches/08-admin-errors.patch &&
git apply --index levelproaudio-patches-07-11/patches/09-jsonld.patch &&
git apply --index levelproaudio-patches-07-11/patches/10-initial-page-seo.patch &&
git apply --index levelproaudio-patches-07-11/patches/11-performance.patch &&
git commit -m "fix: complete payment, SEO and performance patches 07-11" &&
git push
```

Ambos caminos producen exactamente el mismo árbol de archivos. Conservá el
orden 07 → 08 → 09 → 10 → 11. Si un comando falla, `&&` detiene la secuencia.
No uses `--reject`, no fuerces conflictos y no ejecutes un `reset --hard` para
hacer encajar la entrega. El script se detiene también ante una doble aplicación.

## Migración y configuración después del despliegue

- Se agrega **una migración**: `payments.0006_bankaccount_payment_method`.
  El arranque del backend de producción ya ejecuta las migraciones. Agrega una
  columna; conserva cuentas, monedas y datos existentes como `transfer`.
- **Si usás Payoneer:** Panel → Métodos de pago → Cuentas bancarias → Editar →
  «Método de esta cuenta: Payoneer» para cada cuenta correspondiente, con USD.
  Hasta asignarlas, esos pedidos mostrarán instrucciones no disponibles.
- Las transferencias comunes conservan el método «Transferencia bancaria».
  No se muestra una cuenta de otra moneda como alternativa.
- Global66 usa su alias configurado y CLP. No se inventa un alias cuando falta.
- No requiere secretos nuevos. Conservá el mismo `SITE_URL` del backend y
  `VITE_SITE_URL` del frontend: `https://levelproaudio.com`.

## Comprobación tras el push

1. Esperá que terminen backend-tests, ambos builds y los despliegues de Cloud Build.
2. Entrá a un pedido pendiente de transferencia propio y recargá la página:
   cuenta, método, monto y moneda deben coincidir. No hace falta transferir dinero.
3. Revisá un pedido cancelado/confirmado: no debe ofrecer una transferencia nueva.
4. Abrí directamente un producto publicado y revisá el código fuente de la página:
   título, `og:title`, `og:image` y canonical deben corresponder al producto.
5. Navegá por tienda, academia, carrito y checkout. La sola visita no debe crear
   una orden ni capturar un pago.

Los datos bancarios reales y las previews almacenadas por redes sociales no se
pueden validar con los mocks locales. Esos controles siguen siendo posteriores
al despliegue. No se ejecutaron cobros reales al preparar este paquete.

## Si cambia la base o necesitas revertir

Si tu HEAD no es `58ee096`, el script se detiene. No modifica tu rama, no hace
pull ni elimina cambios. Adaptar el paquete requiere revisar ese nuevo commit.

Si ya hiciste commit/push y necesitás volver atrás, revisá el commit y usá
`git revert <commit-del-paquete>` para producir un cambio revisable. No reviertas
la migración ni borres cuentas automáticamente: la columna adicional puede
permanecer mientras se evalúa el rollback del código.

Detalles y límites técnicos de cada cambio: `docs/patches/07-...md` a `11-...md`
dentro del repo después de aplicar. Resultados de pruebas: `VALIDACION.md`.
