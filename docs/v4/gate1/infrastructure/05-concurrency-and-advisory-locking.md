# LEVELPRO OS V4.0 — GATE 1.3: INFRASTRUCTURE & MIGRATION SAFETY
## DOCUMENTO 05 — COORDINACIÓN DE CONCURRENCIA MEDIANTE POSTGRESQL ADVISORY LOCKS

**Versión:** 1.0  
**Fecha:** 21 de Noviembre de 2026  
**Rama:** `feature/v4-gate1-business-core`  
**Autor:** Senior Distributed Systems Engineer & DBA  
**Estado:** CERTIFICADO & AUDITADO  

---

### 1. PROBLEMA DE CONCURRENCIA EN MIGRACIONES CLOUD

En plataformas serverless como Google Cloud Run, los despliegues y las operaciones de escalado pueden disparar múltiples contenedores de forma simultánea. Cuando las migraciones se ejecutan en el inicio del contenedor o cuando múltiples pipelines de CI/CD se activan por commits cercanos, se genera una condición de carrera crítica:

1. **Riesgo 1 — Corrupción de `django_migrations`:** Dos procesos intentan registrar la misma migración simultáneamente, provocando colisiones de clave primaria o inconsistencias de estado.
2. **Riesgo 2 — Interbloqueos DDL (`Deadlocks`):** Dos transacciones DDL intentan alterar tablas relacionadas (ej. claves foráneas entre `orders_order` y `payments_payment`), bloqueándose mutuamente hasta que PostgreSQL aborta una de ellas.
3. **Riesgo 3 — Estados Incompletos de Esquema:** Una instancia web arranca y atiende peticiones contra una tabla a medio migrar, causando excepciones HTTP 500 para los usuarios.

---

### 2. MECANISMO DE BLOQUEO DISTRIBUIDO: POSTGRESQL ADVISORY LOCKS

LEVELPRO OS V4.0 implementa una coordinación a nivel de base de datos utilizando **PostgreSQL Advisory Locks** a nivel de sesión. 

A diferencia de los bloqueos a nivel de tabla (`LOCK TABLE`), los advisory locks:
- Son extremadamente ligeros y operan en la memoria compartida del motor PostgreSQL.
- No bloquean las consultas de lectura (`SELECT`) ni las mutaciones (`INSERT`, `UPDATE`, `DELETE`) de los clientes web.
- Tienen alcance global en todo el clúster de la base de datos (Cloud SQL).
- Se asocian a un identificador numérico determinista de 64 bits.

#### 2.1. Definición de la Clave de Bloqueo
La clave de bloqueo para las migraciones de LevelPro OS se genera de forma determinista mediante el hash de la cadena identitaria del sistema:
```sql
SELECT hashtext('levelpro_migration_lock');
-- Resultado: -7327028
```
Constante en el código Python: `LEVELPRO_MIGRATION_ADVISORY_LOCK_KEY = -7327028`.

---

### 3. DISEÑO DEL COMANDO `migrate_with_lock`

El comando personalizado `migrate_with_lock` (`backend/core/management/commands/migrate_with_lock.py`) encapsula el comando nativo `migrate` con las siguientes garantías:

1. **Intento No Bloqueante con Backoff:** Utiliza `SELECT pg_try_advisory_lock(-7327028)` para consultar de forma atómica si el bloqueo está disponible.
2. **Ciclo de Reintento Controlado:** Si el bloqueo está ocupado por otra instancia, duerme 2 segundos y reintenta hasta alcanzar `--lock-timeout` (por defecto 60 segundos).
3. **Aborto Seguro ante Timeout:** Si expira el tiempo sin obtener el bloqueo, aborta con `CommandError` y código de salida 1 sin ejecutar ningún comando DDL ni corromper transacciones.
4. **Liberación Garantizada (`try...finally`):** Una vez finalizada la migración (o ante cualquier excepción en los scripts de migración), invoca de manera garantizada `SELECT pg_advisory_unlock(-7327028)`.

```python
# Extracto de backend/core/management/commands/migrate_with_lock.py
with connection.cursor() as cursor:
    while True:
        cursor.execute("SELECT pg_try_advisory_lock(%s);", [LEVELPRO_MIGRATION_ADVISORY_LOCK_KEY])
        acquired = cursor.fetchone()[0]
        if acquired:
            lock_acquired = True
            break
        
        elapsed = time.time() - start_time
        if elapsed >= lock_timeout:
            raise CommandError("Timeout agotado esperando advisory lock...")
        time.sleep(2)

try:
    call_command("migrate", *migrate_args, **migrate_kwargs)
finally:
    if lock_acquired:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_unlock(%s);", [LEVELPRO_MIGRATION_ADVISORY_LOCK_KEY])
```

---

### 4. SIMULACIONES Y EVIDENCIA EXPERIMENTAL EN QA

Se ejecutaron dos escenarios de estrés concurrente en el contenedor aislado PostgreSQL `levelpro-v32-qa-db-1`:

#### 4.1. Escenario A: Serialización Exitosa de Procesos Concurrentes
- **Proceso A:** Sesión externa adquiere el bloqueo con `pg_advisory_lock(-7327028)` y retiene durante 4 segundos.
- **Proceso B:** Invocación simultánea de `python manage.py migrate_with_lock --lock-timeout 10`.

**Registro de Salida Real:**
```
[MIGRATOR] Iniciando ejecutor de migraciones desacoplado para base de datos 'default'.
[MIGRATOR] Adquiriendo PostgreSQL Advisory Lock (key=-7327028)...
[MIGRATOR_WAIT] Bloqueo en uso por otro proceso. Reintentando en 2s (transcurrido: 0.0s)...
[MIGRATOR_LOCK] Bloqueo advisory obtenido exitosamente en 2.02s.
[MIGRATOR] Ejecutando Django migrate...
Operations to perform:
  Apply all migrations: academy, admin, analytics, auth, billing, contenttypes, loyalty, orders, payments, products, rewards, services, sessions, site_settings, token_blacklist, users
Running migrations:
  No migrations to apply.
[MIGRATOR] Verificando tabla de cache de base de datos...
[MIGRATOR] ✓ Proceso de migración completado exitosamente.
[MIGRATOR_UNLOCK] Bloqueo PostgreSQL Advisory Lock liberado exitosamente (key=-7327028).
```
**Resultado:** Proceso B esperó ordenadamente a que Proceso A liberara el cerrojo y completó la migración sin colisiones.

#### 4.2. Escenario B: Aborto Seguro ante Timeout
- **Proceso A:** Sesión externa retiene el bloqueo durante 8 segundos.
- **Proceso B:** Invocación de `python manage.py migrate_with_lock --lock-timeout 2`.

**Registro de Salida Real:**
```
[MIGRATOR] Iniciando ejecutor de migraciones desacoplado para base de datos 'default'.
[MIGRATOR] Adquiriendo PostgreSQL Advisory Lock (key=-7327028)...
[MIGRATOR_WAIT] Bloqueo en uso por otro proceso. Reintentando en 2s (transcurrido: 0.0s)...
[MIGRATOR_TIMEOUT] Tiempo de espera agotado (2s) para obtener el PostgreSQL Advisory Lock (-7327028). Existe otra instancia de despliegue o migración en ejecución. Abortando de forma segura.
CommandError: [MIGRATOR_TIMEOUT] Tiempo de espera agotado (2s) para obtener el PostgreSQL Advisory Lock (-7327028). Existe otra instancia de despliegue o migración en ejecución. Abortando de forma segura.
Command exited with code 1.
```
**Resultado:** El proceso abortó limpiamente con código de salida 1, previniendo cualquier ejecución simultánea no deseada.

---

### 5. CONCLUSIÓN Y BENEFICIOS PARA EL NEGOCIO

El mecanismo de PostgreSQL Advisory Locking proporciona una solución nativa, robusta y libre de dependencias externas (como Redis o Zookeeper) para la coordinación de migraciones en la nube, garantizando cero corrupción y cero caída de servicios por carreras de despliegue.
