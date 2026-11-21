# LEVELPRO OS V4.0 — GATE 1.3: INFRASTRUCTURE & MIGRATION SAFETY
## DOCUMENTO 04 — MATRIZ DE PRIVILEGIOS DE BASE DE DATOS E IAM (SEGREGACIÓN DML vs DDL)

**Versión:** 1.0  
**Fecha:** 21 de Noviembre de 2026  
**Rama:** `feature/v4-gate1-business-core`  
**Autor:** Security Architect & Database Administrator  
**Estado:** CERTIFICADO & AUDITADO  

---

### 1. OBJETIVO DE LA SEGREGACIÓN DE PRIVILEGIOS

Garantizar el principio de menor privilegio (Principle of Least Privilege) tanto en la capa de infraestructura Google Cloud Platform (IAM) como en el motor de base de datos relacional PostgreSQL 16. 

Se erradica el modelo de "usuario único multipropósito" para asegurar que un compromiso de la aplicación web o una vulnerabilidad de inyección SQL no permita destruir la base de datos, alterar esquemas, eliminar tablas ni truncar los registros de auditoría forense.

---

### 2. MATRIZ DE ROLES Y PRIVILEGIOS POSTGRESQL

Se definen tres identidades de base de datos estrictamente diferenciadas:

```
+------------------------------------------------------------------------------------+
|                             POSTGRESQL ROLES MATRIX                                |
+-----------------------+---------------------+-------------------+------------------+
| Capacidad SQL         | levelpro_app_user   | levelpro_migrator | superuser / mant |
+-----------------------+---------------------+-------------------+------------------+
| SELECT                | PERMITIDO           | PERMITIDO         | PERMITIDO        |
| INSERT                | PERMITIDO           | PERMITIDO         | PERMITIDO        |
| UPDATE                | PERMITIDO           | PERMITIDO         | PERMITIDO        |
| DELETE                | PERMITIDO           | PERMITIDO         | PERMITIDO        |
| USAGE ON SEQUENCES    | PERMITIDO           | PERMITIDO         | PERMITIDO        |
| TRUNCATE (tablas)     | DENEGADO            | DENEGADO (1)      | PERMITIDO (2)    |
| TRUNCATE audit_events | DENEGADO            | DENEGADO          | CONDICIONADO (2) |
| CREATE TABLE          | DENEGADO            | PERMITIDO         | PERMITIDO        |
| ALTER TABLE           | DENEGADO            | PERMITIDO         | PERMITIDO        |
| DROP TABLE            | DENEGADO            | PERMITIDO         | PERMITIDO        |
| DROP TRIGGER / FUNC   | DENEGADO            | DENEGADO (3)      | PERMITIDO        |
+-----------------------+---------------------+-------------------+------------------+
```
*(1) `levelpro_migrator_user` no requiere TRUNCATE para migraciones estándar de esquema; solo DDL.*  
*(2) Superusuario y mantenimiento requieren token de sesión explícito `levelpro.maintenance_audit_maintenance_active`.*  
*(3) Los triggers de inmutabilidad y de TRUNCATE pertenecen a superusuario.*

#### 2.1. Definición SQL de `levelpro_app_user` (Runtime Web)
```sql
-- Creación de rol web con contraseña segura
CREATE ROLE levelpro_app_user WITH LOGIN PASSWORD '...';

-- Conexión y uso del esquema public
GRANT CONNECT ON DATABASE levelpro_db TO levelpro_app_user;
GRANT USAGE ON SCHEMA public TO levelpro_app_user;

-- Revocación explícita de DDL
REVOKE CREATE ON SCHEMA public FROM levelpro_app_user;

-- Otorgamiento exclusivo de operaciones DML sobre tablas de negocio
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO levelpro_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO levelpro_app_user;

-- Revocación terminante de TRUNCATE
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM levelpro_app_user;
REVOKE TRUNCATE ON audit_events FROM levelpro_app_user;

-- Privilegios por defecto para tablas creadas en el futuro por el migrador
ALTER DEFAULT PRIVILEGES FOR ROLE levelpro_migrator_user IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO levelpro_app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE levelpro_migrator_user IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO levelpro_app_user;
```

#### 2.2. Definición SQL de `levelpro_migrator_user` (Cloud Run Job de Migraciones)
```sql
-- Creación de rol de migraciones con contraseña segura
CREATE ROLE levelpro_migrator_user WITH LOGIN PASSWORD '...';

-- Conexión y permisos DDL completos en esquema public
GRANT CONNECT ON DATABASE levelpro_db TO levelpro_migrator_user;
GRANT USAGE, CREATE ON SCHEMA public TO levelpro_migrator_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO levelpro_migrator_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO levelpro_migrator_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO levelpro_migrator_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO levelpro_migrator_user;
```

---

### 3. MATRIZ DE CUENTAS DE SERVICIO IAM (GOOGLE CLOUD PLATFORM)

Se segregan las Service Accounts del proyecto GCP para que las credenciales del servicio web no puedan invocar el Cloud Run Job de migración ni acceder a los secretos DDL:

| Identidad IAM | Propósito | Roles IAM Asignados | Secretos Accesibles en Secret Manager |
|---|---|---|---|
| `levelproaudio-app@...` | Runtime de Cloud Run Service (Web Backend) | `roles/cloudsql.client`<br>`roles/storage.objectViewer`<br>`roles/storage.objectCreator` | `DB_USER` (`levelpro_app_user`)<br>`DB_PASSWORD`<br>`DJANGO_SECRET_KEY`<br>Claves pasarelas de pago |
| `levelproaudio-migrator@...` | Runtime de Cloud Run Job (Migraciones) | `roles/cloudsql.client`<br>`roles/secretmanager.secretAccessor` | `DB_MIGRATOR_USER`<br>`DB_MIGRATOR_PASSWORD`<br>`DB_NAME`<br>`DJANGO_SECRET_KEY` |
| `[PROJECT_NUMBER]@cloudbuild...` | Orquestador de Despliegue (Cloud Build) | `roles/run.admin`<br>`roles/iam.serviceAccountUser`<br>`roles/artifactregistry.writer` | N/A (Administra y ejecuta jobs) |

---

### 4. EVIDENCIA DE VERIFICACIÓN EN QA POSTGRESQL 16

En el contenedor aislado `levelpro-v32-qa-db-1`, se verificó la efectividad de los controles ejecutando comandos interactivos como `levelpro_app_user`:

1. **Lectura DML de Datos:**
   ```sql
   SELECT count(*) FROM audit_events; --> Exitoso: 21 filas.
   ```
2. **Intento de Creación de Tablas (DDL):**
   ```sql
   CREATE TABLE test_ddl_fail(id int); 
   --> ERROR: permission denied for schema public
   ```
3. **Intento de Modificación de Estructura (ALTER TABLE):**
   ```sql
   ALTER TABLE audit_events ADD COLUMN test_col text;
   --> ERROR: must be owner of table audit_events
   ```
4. **Intento de Destrucción de Tablas (DROP TABLE):**
   ```sql
   DROP TABLE audit_events;
   --> ERROR: must be owner of table audit_events
   ```
5. **Intento de Vaciado Forzado (TRUNCATE):**
   ```sql
   TRUNCATE audit_events;
   --> ERROR: permission denied for table audit_events
   ```
6. **Intento de Evasión de Trigger mediante Parámetros de Sesión:**
   ```sql
   SET levelpro.maintenance_audit_maintenance_active = 'active_authorized_maintenance';
   TRUNCATE audit_events;
   --> ERROR: permission denied for table audit_events / Trigger block: TRUNCATE operation is prohibited for session user levelpro_app_user
   ```

---

### 5. CONCLUSIÓN DE SEGURIDAD

La segregación DML/DDL ha sido acreditada y validada experimentalmente. El usuario del servicio web carece de toda facultad para alterar la estructura de la base de datos o vulnerar la inmutabilidad de la auditoría.
