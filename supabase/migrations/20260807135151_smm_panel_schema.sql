/*
# SMM Panel - Core Schema

1. Overview
This migration creates the full data model for a professional SMM panel:
- user profiles (linked to auth.users) with balance, spending, affiliate data
- services catalog (the products users order)
- orders (a user requesting a service for a link/quantity)
- transactions (balance movements: deposit, spend, refund, affiliate credit)
- support tickets and ticket replies
- affiliate referrals

2. New Tables
- profiles: extends auth.users with balance, affiliate code, referral stats
- services: the SMM service catalog (category, platform, price per 1000, min/max, etc.)
- orders: a placed order linking a user, a service, a link, quantity, charge, status
- transactions: ledger of every balance movement per user
- tickets: support tickets opened by users
- ticket_replies: messages inside a ticket

3. Security
- RLS enabled on every table.
- profiles: owner-scoped SELECT/UPDATE; INSERT via trigger only (no direct client insert needed).
- services: world-readable (anon + authenticated) so the catalog shows before login; only authenticated admins could write (no admin role assumed here, so writes are denied to anon/authenticated by omitting policies).
- orders: owner-scoped CRUD (insert defaults owner to auth.uid()).
- transactions: owner-scoped SELECT only; inserts happen server-side (edge function / rpc) so no client INSERT policy.
- tickets + ticket_replies: owner-scoped CRUD.
- All policies use auth.uid(), never current_user.

4. Notes
- profiles.user_id has DEFAULT auth.uid() and a trigger auto-creates a profile row on signup.
- orders.user_id has DEFAULT auth.uid() so client inserts omitting it still satisfy WITH CHECK.
- transactions and order charge/refund logic is intentionally kept in application/edge-function land; this migration only establishes storage and access control.
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  email text,
  balance numeric(18,4) NOT NULL DEFAULT 0,
  total_spent numeric(18,4) NOT NULL DEFAULT 0,
  affiliate_code text UNIQUE,
  referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  affiliate_earnings numeric(18,4) NOT NULL DEFAULT 0,
  affiliate_referrals integer NOT NULL DEFAULT 0,
  level text NOT NULL DEFAULT 'Standard',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
BEGIN
  code := 'REF' || upper(substr(md5(random()::text), 1, 6));
  INSERT INTO public.profiles (user_id, email, affiliate_code)
  VALUES (NEW.id, NEW.email, code)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- services ----------
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id integer NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  platform text NOT NULL,
  price numeric(18,4) NOT NULL,
  min_order integer NOT NULL DEFAULT 10,
  max_order integer NOT NULL DEFAULT 100000,
  rate_per_1000 numeric(18,4) NOT NULL,
  type text NOT NULL DEFAULT 'Default',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  avg_time text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_services" ON services;
CREATE POLICY "read_services" ON services FOR SELECT
  TO anon, authenticated USING (true);

-- ---------- orders ----------
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  service_name text NOT NULL,
  link text NOT NULL,
  quantity integer NOT NULL,
  charge numeric(18,4) NOT NULL DEFAULT 0,
  start_count integer NOT NULL DEFAULT 0,
  remains integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending',
  order_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_orders" ON orders;
CREATE POLICY "delete_own_orders" ON orders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- transactions ----------
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric(18,4) NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'Completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ---------- tickets ----------
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  status text NOT NULL DEFAULT 'Open',
  priority text NOT NULL DEFAULT 'Normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tickets" ON tickets;
CREATE POLICY "select_own_tickets" ON tickets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tickets" ON tickets;
CREATE POLICY "insert_own_tickets" ON tickets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tickets" ON tickets;
CREATE POLICY "update_own_tickets" ON tickets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- ticket_replies ----------
CREATE TABLE IF NOT EXISTS ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_staff boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ticket_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ticket_replies" ON ticket_replies;
CREATE POLICY "select_own_ticket_replies" ON ticket_replies FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM tickets WHERE tickets.id = ticket_replies.ticket_id AND tickets.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_ticket_replies" ON ticket_replies;
CREATE POLICY "insert_own_ticket_replies" ON ticket_replies FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM tickets WHERE tickets.id = ticket_replies.ticket_id AND tickets.user_id = auth.uid())
  );

-- ---------- indexes ----------
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_platform ON services(platform);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_id ON ticket_replies(ticket_id);

-- ---------- place_order RPC (atomic balance + order + transaction) ----------
CREATE OR REPLACE FUNCTION public.place_order(
  p_service_id uuid,
  p_link text,
  p_quantity integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service services%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_balance numeric(18,4);
  v_charge numeric(18,4);
  v_order_id integer;
  v_new_order_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_service FROM services WHERE id = p_service_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Service not found');
  END IF;

  IF p_quantity < v_service.min_order OR p_quantity > v_service.max_order THEN
    RETURN json_build_object('success', false, 'error', 'Quantity out of range');
  END IF;

  v_charge := round((p_quantity / 1000.0) * v_service.rate_per_1000, 4);

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF v_balance < v_charge THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  SELECT COALESCE(max(order_id), 0) + 1 INTO v_order_id FROM orders;

  INSERT INTO orders (user_id, service_id, service_name, link, quantity, charge, order_id, status)
  VALUES (v_user_id, p_service_id, v_service.name, p_link, p_quantity, v_charge, v_order_id, 'Processing')
  RETURNING id INTO v_new_order_id;

  UPDATE profiles
  SET balance = balance - v_charge,
      total_spent = total_spent + v_charge,
      updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO transactions (user_id, type, amount, description, status)
  VALUES (v_user_id, 'Order', v_charge, 'Order #' || v_order_id || ' - ' || v_service.name, 'Completed');

  RETURN json_build_object('success', true, 'order_id', v_order_id, 'charge', v_charge);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(uuid, text, integer) TO authenticated;

-- ---------- add_funds RPC ----------
CREATE OR REPLACE FUNCTION public.add_funds(
  p_amount numeric,
  p_method text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  UPDATE profiles SET balance = balance + p_amount, updated_at = now() WHERE user_id = v_user_id;

  INSERT INTO transactions (user_id, type, amount, description, status)
  VALUES (v_user_id, 'Deposit', p_amount, 'Deposit via ' || p_method, 'Completed');

  RETURN json_build_object('success', true, 'new_balance', (SELECT balance FROM profiles WHERE user_id = v_user_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_funds(numeric, text) TO authenticated;