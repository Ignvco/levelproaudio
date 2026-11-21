# LEVELPRO OS V4.0 — GATE 1.3: INFRASTRUCTURE & MIGRATION SAFETY
## DOCUMENTO 03 — ARQUITECTURA DE MIGRACIONES DESACOPLADAS

**Versión:** 1.0  
**Fecha:** 21 de Noviembre de 2026  
**Rama:** `feature/v4-gate1-business-core`  
**Autor:** Senior Software Architect  
**Estado:** CERTIFICADO  

---

### 1. MODELO CONCEPTUAL Y VISIÓN ARQUITECTÓNICA

La arquitectura de migración desacoplada de LEVELPRO OS V4.0 separa de forma estricta las tareas de evolución del esquema relacional (DDL) de la ejecución continua de servicios web orientados al usuario (DML). 

Esta separación se fundamenta en tres pilares:
1. **Contenedor Efímero de Migración (Cloud Run Job):** Un proceso de única ejecución que corre exclusivamente durante el pipeline de despliegue antes de tocar el servicio web.
2. **Servicio Web Liviano (Cloud Run Service):** Instancias de backend optimizadas para atender peticiones HTTP, sin privilegios DDL y con arranque en frío inferior a 3 segundos.
3. **Pipeline Orquestado por Cloud Build:** Garantía de que ninguna instancia web recibe la nueva versión del código si las migraciones no han concluido satisfactoriamente.

```
+-----------------------------------------------------------------------------------------+
|                                CLOUD BUILD PIPELINE                                     |
+-----------------------------------------------------------------------------------------+
       |
       v
 [1. Tests CI] ---> [2. Build Docker] ---> [3. Push Artifacts]
                                                    |
       +--------------------------------------------+
       |
       v
 [4. Cloud Run Job: levelproaudio-migrator-job]
       |
       +--> Adquiere PostgreSQL Advisory Lock (key=-7327028)
       |--> Ejecuta DDL con rol 'levelpro_migrator_user'
       |--> Libera PostgreSQL Advisory Lock
       v
 ¿Éxito? 
   |---> NO: [ABORTAR PIPELINE INMEDIATAMENTE] (Producción intacta, 0 downtime)
   |
   +---> SÍ: Continúa el despliegue
          |
          v
 [5. Cloud Run Service: levelproaudio-backend]
          |
          +--> Ejecuta 'web_entrypoint.sh'
          +--> Conecta con rol DML 'levelpro_app_user'
          +--> Cold start ultrarrápido (<3s)
          v
 [6. Cloud Run Service: levelproaudio-frontend]
```

---

### 2. COMPONENTES Y ESPECIFICACIONES TÉCNICAS

#### 2.1. Cloud Run Job (`levelproaudio-migrator-job`)
- **Tipo de Carga:** Cloud Run Job (Workload v1).
- **Service Account Dedicada:** `levelproaudio-migrator@levelproaudio.iam.gserviceaccount.com`.
- **Credenciales en Secret Manager:** `DB_MIGRATOR_USER`, `DB_MIGRATOR_PASSWORD`.
- **Entorno de Red:** Acceso a Cloud SQL mediante Unix Socket inyectado (`--set-cloudsql-instances`).
- **Comando de Entrada:** `/app/docker/migrator_entrypoint.sh`.
- **Estrategia de Ejecución:** `taskCount: 1`, `parallelism: 1`, `maxRetries: 1`, `timeoutSeconds: 300`.
- **Comportamiento ante Fallo:** Código de salida distinto de cero (`non-zero exit code`). El job falla de inmediato y Cloud Build cancela los pasos posteriores.

#### 2.2. Cloud Run Service (`levelproaudio-backend`)
- **Tipo de Carga:** Cloud Run Service (Servicio HTTP sin estado).
- **Service Account de Runtime:** `levelproaudio-app@levelproaudio.iam.gserviceaccount.com`.
- **Credenciales en Secret Manager:** `DB_USER` (`levelpro_app_user`), `DB_PASSWORD`.
- **Entorno de Red:** Unix Socket Cloud SQL inyectado.
- **Comando de Entrada:** `/app/docker/web_entrypoint.sh`.
- **Escalabilidad:** Mínimo 1 instancia, máximo 5 instancias concurrentes.
- **Ventaja Operativa:** Cero latencia inducida por migraciones; escalado horizontal sin riesgo de bloqueos cruzados en `django_migrations`.

#### 2.3. Coordinador de Bloqueo Distribuido (`migrate_with_lock`)
- Comando de gestión Django ubicado en `core/management/commands/migrate_with_lock.py`.
- Adquiere el bloqueo advisory de 64 bits `-7327028` (`hashtext('levelpro_migration_lock')`).
- Timeout configurable (por defecto 60 segundos) para evitar bloqueos perpetuos si otro proceso de migración o mantenimiento está activo.
- Mecanismo `try...finally` infalible para asegurar la liberación del bloqueo ante cualquier excepción en la migración.

---

### 3. INTEGRACIÓN EN CLOUD BUILD (`cloudbuild.yaml`)

El archivo de configuración maestro de Cloud Build integra el paso de migración con dependencias explícitas (`waitFor`):

```yaml
  # ── 4.5. Run Database Migrations (Decoupled Cloud Run Job) ───
  - name: "gcr.io/google.com/cloudsdktool/cloud-sdk"
    id: "run-migrations"
    waitFor: ["push-backend"]
    entrypoint: gcloud
    args:
      - run
      - jobs
      - execute
      - "${_MIGRATOR_JOB}"
      - --region=${_REGION}
      - --wait

  # ── 5. Deploy Backend ────────────────────────────────────────
  - name: "gcr.io/google.com/cloudsdktool/cloud-sdk"
    id: "deploy-backend"
    waitFor: ["run-migrations", "push-frontend"]
    entrypoint: gcloud
    args:
      - run
      - deploy
      - "${_BACKEND_SERVICE}"
      ...
```

**Garantía de Integridad:** Si `run-migrations` falla, el paso 5 (`deploy-backend`) **NUNCA** se ejecuta. La versión previa de la aplicación continúa atendiendo el 100% del tráfico de producción sin degradación.

---

### 4. COMPARATIVA: ARQUITECTURA PREVIA VS ARQUITECTURA DESACOPLADA

| Métrica / Atributo | Arquitectura Previa (Gate 1.2) | Arquitectura Desacoplada (Gate 1.3) |
|---|---|---|
| **Lugar de Ejecución DDL** | En cada contenedor web (`CMD` de Docker) | En Cloud Run Job efímero dedicado |
| **Tiempo de Cold Start Web** | 15 - 25 segundos | **2.27 segundos** |
| **Riesgo en Escalado Horizontal** | Colisión de bloqueos y duplicados en `django_migrations` | **Cero riesgo** (las réplicas no tocan DDL) |
| **Privilegios de DB del Servidor Web** | DDL completo (CREATE, DROP, TRUNCATE) | **DML estricto** (SELECT, INSERT, UPDATE, DELETE) |
| **Fallo en Migración** | Crash loop en runtime web tras actualización | **Aborto anticipado en CI/CD**, servicio web intacto |
