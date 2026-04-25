-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For nearest pharmacy lookups

-- 1. USERS TABLE
CREATE TABLE public.users (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    role VARCHAR(50) CHECK (role IN ('customer', 'pharmacist', 'delivery_agent', 'admin')) NOT NULL,
    full_name TEXT NOT NULL,
    phone VARCHAR(20) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PHARMACIES TABLE
CREATE TABLE public.pharmacies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES public.users(id),
    name TEXT NOT NULL,
    license_number TEXT UNIQUE NOT NULL,
    location GEOGRAPHY(POINT) NOT NULL, -- using postgis for Quick-Commerce scaling
    address TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. MEDICINES REFERENCE
CREATE TABLE public.medicines (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    brand_name TEXT NOT NULL,
    generic_name TEXT NOT NULL,
    category VARCHAR(50) CHECK (category IN ('otc', 'prescription', 'restricted')) NOT NULL,
    avg_price DECIMAL(10,2),
    manufacturer TEXT,
    high_risk BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. PHARMACY INVENTORY
CREATE TABLE public.inventory (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
    medicine_id UUID REFERENCES public.medicines(id),
    quantity INT NOT NULL DEFAULT 0,
    price DECIMAL(10,2) NOT NULL,
    expiry_date DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(pharmacy_id, medicine_id)
);

-- 5. PRESCRIPTIONS
CREATE TABLE public.prescriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    image_url TEXT NOT NULL, -- Supabase Storage URL
    ai_validation_status VARCHAR(50) DEFAULT 'pending', -- pending, verified, flagged
    pharmacist_verified BOOLEAN DEFAULT false,
    extracted_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. ORDERS
CREATE TABLE public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    pharmacy_id UUID REFERENCES public.pharmacies(id),
    prescription_id UUID REFERENCES public.prescriptions(id), -- Nullable for OTC
    status VARCHAR(50) CHECK (status IN ('pending', 'accepted', 'rejected', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered')) DEFAULT 'pending',
    delivery_type VARCHAR(50) CHECK (delivery_type IN ('pickup', 'delivery')) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. ORDER ITEMS
CREATE TABLE public.order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    medicine_id UUID REFERENCES public.medicines(id),
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL
);

-- 8. DELIVERIES
CREATE TABLE public.deliveries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) UNIQUE,
    agent_id UUID REFERENCES public.users(id),
    status VARCHAR(50) CHECK (status IN ('assigning', 'accepted', 'picked_up', 'delivered')) DEFAULT 'assigning',
    current_location GEOGRAPHY(POINT),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS Policies (Row Level Security for Supabase)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- Further RLS rules omitted for brevity, but should restrict users to their own data, pharmacists to their pharmacy's data, etc.
