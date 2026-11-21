-- LEVELPRO OS V4.0 — GATE 1.3: DATABASE PRIVILEGE SEGREGATION
-- Segregación estricta entre operaciones DDL (migraciones) y DML (runtime web)

DO $$
BEGIN
    -- 1. Crear rol para el runtime de la aplicación web si no existe
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'levelpro_app_user') THEN
        CREATE ROLE levelpro_app_user WITH LOGIN PASSWORD 'app_user_secure_qa_pass_123';
    END IF;

    -- 2. Crear rol para el ejecutor de migraciones si no existe
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'levelpro_migrator_user') THEN
        CREATE ROLE levelpro_migrator_user WITH LOGIN PASSWORD 'migrator_user_secure_qa_pass_123';
    END IF;

    -- 3. Crear rol de mantenimiento privilegiado si no existe
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'levelpro_maintenance') THEN
        CREATE ROLE levelpro_maintenance NOLOGIN;
    END IF;
END $$;

-- Otorgar membrecía de mantenimiento a superusuario y migrador si se requiere
GRANT levelpro_maintenance TO levelpro_qa;

-- Configurar permisos para levelpro_migrator_user (DDL)
GRANT CONNECT ON DATABASE levelpro_v32_qa TO levelpro_migrator_user;
GRANT USAGE, CREATE ON SCHEMA public TO levelpro_migrator_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO levelpro_migrator_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO levelpro_migrator_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO levelpro_migrator_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO levelpro_migrator_user;

-- Configurar permisos para levelpro_app_user (DML únicamente)
GRANT CONNECT ON DATABASE levelpro_v32_qa TO levelpro_app_user;
GRANT USAGE ON SCHEMA public TO levelpro_app_user;
-- Revocar explícitamente creación de objetos
REVOKE CREATE ON SCHEMA public FROM levelpro_app_user;

-- Otorgar exclusivamente DML (SELECT, INSERT, UPDATE, DELETE) sobre tablas
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO levelpro_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO levelpro_app_user;

-- Revocar terminantemente TRUNCATE sobre todas las tablas para el usuario web
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM levelpro_app_user;

-- Privilegios por defecto para futuras tablas creadas por levelpro_migrator_user
ALTER DEFAULT PRIVILEGES FOR ROLE levelpro_migrator_user IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO levelpro_app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE levelpro_migrator_user IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO levelpro_app_user;
