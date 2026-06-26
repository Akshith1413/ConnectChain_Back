-- ============================================================
-- CONNECTCHAIN DATABASE SCHEMA FOR SUPABASE / POSTGRESQL
-- ============================================================

-- 1. Services Catalog Table
CREATE TABLE IF NOT EXISTS services (
  id text PRIMARY KEY,
  name text NOT NULL,
  icon text NOT NULL,
  description text NOT NULL
);

-- 2. Base Users Table (Synchronized with Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text CHECK (role IN ('HOUSEHOLD', 'WORKER', 'VENDOR')) NOT NULL,
  phone text NOT NULL,
  photo_url text,
  theme text DEFAULT 'LIGHT' CHECK (theme IN ('LIGHT', 'DARK')),
  latitude numeric,
  longitude numeric,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Workers Profiles Table
CREATE TABLE IF NOT EXISTS workers (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  skills text[] NOT NULL DEFAULT '{}',
  rating numeric(3,2) DEFAULT 5.00,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0.00
);

-- 4. Vendors Profiles Table
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name text NOT NULL
);

-- 5. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  worker_id uuid REFERENCES workers(id) ON DELETE CASCADE,
  rating integer CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES users(id) ON DELETE SET NULL,
  service_id text REFERENCES services(id) ON DELETE SET NULL,
  worker_id uuid REFERENCES workers(id) ON DELETE SET NULL,
  scheduled_at timestamp with time zone NOT NULL,
  price numeric(10,2) NOT NULL,
  status text CHECK (status IN ('PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED')) DEFAULT 'PENDING',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL,
  reference_id text,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Device Tokens Table (for Push Notification targets)
CREATE TABLE IF NOT EXISTS device_tokens (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL,
  device_type text CHECK (device_type IN ('android', 'ios')) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (RLS) & ACCESS CONTROL RULES
-- ============================================================

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplication
DROP POLICY IF EXISTS "Allow public read access to services" ON services;
DROP POLICY IF EXISTS "Allow service role/admin write access to services" ON services;
DROP POLICY IF EXISTS "Allow authenticated read users" ON users;
DROP POLICY IF EXISTS "Allow users to update own profile" ON users;
DROP POLICY IF EXISTS "Allow admin manage users" ON users;
DROP POLICY IF EXISTS "Allow authenticated read workers" ON workers;
DROP POLICY IF EXISTS "Allow workers to update own profile" ON workers;
DROP POLICY IF EXISTS "Allow admin manage workers" ON workers;
DROP POLICY IF EXISTS "Allow authenticated read vendors" ON vendors;
DROP POLICY IF EXISTS "Allow vendors to update own profile" ON vendors;
DROP POLICY IF EXISTS "Allow admin manage vendors" ON vendors;
DROP POLICY IF EXISTS "Allow authenticated read reviews" ON reviews;
DROP POLICY IF EXISTS "Allow authenticated insert reviews" ON reviews;
DROP POLICY IF EXISTS "Allow admin manage reviews" ON reviews;
DROP POLICY IF EXISTS "Allow users to read own bookings" ON bookings;
DROP POLICY IF EXISTS "Allow households to create bookings" ON bookings;
DROP POLICY IF EXISTS "Allow users to update own bookings" ON bookings;
DROP POLICY IF EXISTS "Allow admin manage bookings" ON bookings;
DROP POLICY IF EXISTS "Allow users to read own notifications" ON notifications;
DROP POLICY IF EXISTS "Allow users to update own notifications" ON notifications;
DROP POLICY IF EXISTS "Allow admin manage notifications" ON notifications;
DROP POLICY IF EXISTS "Allow users to manage own device tokens" ON device_tokens;
DROP POLICY IF EXISTS "Allow admin manage device tokens" ON device_tokens;

-- Policies
CREATE POLICY "Allow public read access to services" ON services FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow service role/admin write access to services" ON services FOR ALL TO service_role USING (true);
CREATE POLICY "Allow authenticated read users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users to update own profile" ON users FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Allow admin manage users" ON users FOR ALL TO service_role USING (true);
CREATE POLICY "Allow authenticated read workers" ON workers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow workers to update own profile" ON workers FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Allow admin manage workers" ON workers FOR ALL TO service_role USING (true);
CREATE POLICY "Allow authenticated read vendors" ON vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow vendors to update own profile" ON vendors FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Allow admin manage vendors" ON vendors FOR ALL TO service_role USING (true);
CREATE POLICY "Allow authenticated read reviews" ON reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Allow admin manage reviews" ON reviews FOR ALL TO service_role USING (true);
CREATE POLICY "Allow users to read own bookings" ON bookings FOR SELECT TO authenticated USING (auth.uid() = household_id OR auth.uid() = worker_id);
CREATE POLICY "Allow households to create bookings" ON bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = household_id);
CREATE POLICY "Allow users to update own bookings" ON bookings FOR UPDATE TO authenticated USING (auth.uid() = household_id OR auth.uid() = worker_id);
CREATE POLICY "Allow admin manage bookings" ON bookings FOR ALL TO service_role USING (true);
CREATE POLICY "Allow users to read own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow users to update own notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow admin manage notifications" ON notifications FOR ALL TO service_role USING (true);
CREATE POLICY "Allow users to manage own device tokens" ON device_tokens FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow admin manage device tokens" ON device_tokens FOR ALL TO service_role USING (true);

-- ============================================================
-- SEED MOCK DATA
-- ============================================================

-- 1. Seed Services
INSERT INTO services (id, name, icon, description) VALUES
('1', 'Plumber', 'plumbing', 'Fixes pipes, leaks, and drainage issues.'),
('2', 'Electrician', 'bolt', 'Installs wiring, fixes switches, and repairs electrical appliances.'),
('3', 'Carpenter', 'build', 'Repairs furniture, installs shelves, and handles wood craft.'),
('4', 'Painter', 'format_paint', 'Interior and exterior wall painting services.')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;

-- 2. Seed Users (1 Customer + 5 Workers)
INSERT INTO users (id, name, email, role, phone, latitude, longitude) VALUES
('99999999-9999-9999-9999-999999999999', 'Jane Customer', 'customer@example.com', 'HOUSEHOLD', '+1234567890', 12.9716, 77.5946),
('11111111-1111-1111-1111-111111111111', 'Vince Plumber', 'vince@example.com', 'WORKER', '+1111111111', 12.9720, 77.5950),
('22222222-2222-2222-2222-222222222222', 'Alice Electrician', 'alice@example.com', 'WORKER', '+2222222222', 12.9780, 77.5980),
('33333333-3333-3333-3333-333333333333', 'Bob Carpenter', 'bob@example.com', 'WORKER', '+3333333333', 12.9650, 77.5850),
('44444444-4444-4444-4444-444444444444', 'Charlie Painter', 'charlie@example.com', 'WORKER', '+4444444444', 12.9800, 77.6000),
('55555555-5555-5555-5555-555555555555', 'Dave JackOfAll', 'dave@example.com', 'WORKER', '+5555555555', 12.9680, 77.5900)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- 3. Seed Workers details
INSERT INTO workers (id, skills, rating, hourly_rate) VALUES
('11111111-1111-1111-1111-111111111111', ARRAY['plumbing', 'drain clean'], 4.8, 45.00),
('22222222-2222-2222-2222-222222222222', ARRAY['electrical', 'wiring'], 4.5, 55.00),
('33333333-3333-3333-3333-333333333333', ARRAY['carpentry', 'furniture'], 4.2, 40.00),
('44444444-4444-4444-4444-444444444444', ARRAY['painting', 'walls'], 4.9, 50.00),
('55555555-5555-5555-5555-555555555555', ARRAY['plumbing', 'electrical'], 4.7, 60.00)
ON CONFLICT (id) DO UPDATE SET
  skills = EXCLUDED.skills,
  rating = EXCLUDED.rating,
  hourly_rate = EXCLUDED.hourly_rate;

-- 4. Seed Reviews
INSERT INTO reviews (id, customer_id, worker_id, rating, comment) VALUES
('10101010-1010-1010-1010-101010101010', '99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 5, 'Vince did an amazing job fixing our kitchen sink! Highly recommended.'),
('20202020-2020-2020-2020-202020202020', '99999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', 4, 'Alice resolved our short circuit problem quickly. Very professional.')
ON CONFLICT (id) DO UPDATE SET
  customer_id = EXCLUDED.customer_id,
  worker_id = EXCLUDED.worker_id,
  rating = EXCLUDED.rating,
  comment = EXCLUDED.comment;
