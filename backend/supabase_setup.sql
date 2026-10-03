-- ============================================================
-- MEDORA Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.medora_users (
    id              TEXT PRIMARY KEY,
    full_name       TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'patient',
    email           TEXT NOT NULL UNIQUE,
    phone           TEXT DEFAULT '',
    username        TEXT NOT NULL UNIQUE,
    password        TEXT NOT NULL,
    status          TEXT DEFAULT 'active',
    must_change_password INTEGER DEFAULT 0,
    address         TEXT DEFAULT '',
    pharmacy_license TEXT DEFAULT '',
    vehicle_type    TEXT DEFAULT '',
    driving_license TEXT DEFAULT '',
    allergies       TEXT DEFAULT '',
    chronic_conditions TEXT DEFAULT '',
    rider_upi_id    TEXT DEFAULT '',
    rider_upi_qr    TEXT DEFAULT '',
    shop_upi_id     TEXT DEFAULT '',
    shop_upi_qr     TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medora_users_email    ON public.medora_users(email);
CREATE INDEX IF NOT EXISTS idx_medora_users_role     ON public.medora_users(role);
CREATE INDEX IF NOT EXISTS idx_medora_users_status   ON public.medora_users(status);

-- 2. PARTNER REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.medora_partner_requests (
    id              TEXT PRIMARY KEY,
    partner_type    TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL,
    phone           TEXT DEFAULT '',
    status          TEXT DEFAULT 'pending',
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    store_name      TEXT DEFAULT '',
    license_no      TEXT DEFAULT '',
    store_address   TEXT DEFAULT '',
    latitude        DOUBLE PRECISION DEFAULT 19.0760,
    longitude       DOUBLE PRECISION DEFAULT 72.8777,
    vehicle_type    TEXT DEFAULT '',
    driving_license TEXT DEFAULT '',
    vehicle_number  TEXT DEFAULT '',
    delivery_zone   TEXT DEFAULT '',
    shift_preference TEXT DEFAULT '',
    rider_upi_id    TEXT DEFAULT '',
    rider_upi_qr    TEXT DEFAULT '',
    shop_upi_id     TEXT DEFAULT '',
    shop_upi_qr     TEXT DEFAULT '',
    approved_at     TIMESTAMPTZ,
    rejected_at     TIMESTAMPTZ,
    rejection_reason TEXT DEFAULT '',
    temp_password   TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_requests_status ON public.medora_partner_requests(status);
CREATE INDEX IF NOT EXISTS idx_partner_requests_email  ON public.medora_partner_requests(email);

-- 3. DELETED USERS TOMBSTONE TABLE
CREATE TABLE IF NOT EXISTS public.medora_deleted_users (
    identifier  TEXT PRIMARY KEY,
    id          TEXT,
    email       TEXT,
    username    TEXT,
    role        TEXT,
    deleted_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DELETED PARTNER REQUESTS TOMBSTONE TABLE
CREATE TABLE IF NOT EXISTS public.medora_deleted_partner_requests (
    id          TEXT PRIMARY KEY,
    action      TEXT NOT NULL,
    reason      TEXT DEFAULT '',
    email       TEXT,
    timestamp   TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.medora_orders (
    id              TEXT PRIMARY KEY,
    user_email      TEXT NOT NULL,
    user_name       TEXT DEFAULT '',
    pharmacy_id     TEXT DEFAULT '',
    pharmacy_name   TEXT DEFAULT '',
    items           JSONB DEFAULT '[]',
    total_amount    DOUBLE PRECISION DEFAULT 0,
    payment_method  TEXT DEFAULT '',
    payment_status  TEXT DEFAULT 'pending',
    order_status    TEXT DEFAULT 'placed',
    delivery_address TEXT DEFAULT '',
    rider_id        TEXT DEFAULT '',
    rider_name      TEXT DEFAULT '',
    notes           TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_email  ON public.medora_orders(user_email);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON public.medora_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_pharmacy    ON public.medora_orders(pharmacy_id);

-- 6. PRESCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email          TEXT DEFAULT '',
    image_url           TEXT DEFAULT '',
    extracted_data      JSONB,
    ai_validation_status TEXT DEFAULT 'pending',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Disable Row Level Security (backend service_role key bypasses RLS anyway, but be explicit)
ALTER TABLE public.medora_users                    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medora_partner_requests         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medora_deleted_users            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medora_deleted_partner_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medora_orders                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions                   DISABLE ROW LEVEL SECURITY;

-- 8. Seed Default System Users
INSERT INTO public.medora_users (id, full_name, role, email, phone, username, password, status, must_change_password, address)
VALUES
    ('usr_admin_1',    'MEDORA System Administrator', 'admin',    'admin@medora.com',    '+919000000000', 'admin',    'admin',       'active', 0, ''),
    ('usr_patient_1',  'Adhwaith (Patient)',           'patient',  'patient@medora.com',  '+919999999999', 'patient',  'patient123',  'active', 0, ''),
    ('usr_pharmacy_1', 'Vamanjoor Pharmacy Admin',     'pharmacy', 'pharmacy@medora.com', '+918888888888', 'pharmacy', 'pharmacy123', 'active', 0, 'Airport Road, Vamanjoor'),
    ('usr_rider_1',    'Rider AGT-591',                'delivery', 'rider@medora.com',    '+917777777777', 'rider',    'rider123',    'active', 0, 'Kodialbail, Mangalore')
ON CONFLICT (id) DO NOTHING;

-- Your existing registered users (from CSV):
INSERT INTO public.medora_users (id, full_name, role, email, phone, username, password, status, must_change_password)
VALUES
    ('usr_a2ecb766', 'Raju',          'pharmacy', 'adhwaithkr2005@gmail.com',    '9809803257', 'adhwaithkr2005',     'password123', 'active', 0),
    ('usr_73a07761', 'Adhwaith K R',  'patient',  '23g02.adhwaith@sjec.ac.in',   '5424774854', '23g02.adhwaith',     'medora123',   'active', 0)
ON CONFLICT (id) DO NOTHING;

-- Done! Schema ready. Copy your anon + service_role keys into backend/.env
