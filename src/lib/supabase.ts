import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Profile = {
  id: string;
  user_id: string;
  username: string | null;
  email: string | null;
  balance: number;
  total_spent: number;
  affiliate_code: string | null;
  referred_by: string | null;
  affiliate_earnings: number;
  affiliate_referrals: number;
  level: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  role?: string;
  api_key?: string | null;
};

export type Service = {
  id: string;
  service_id: number;
  name: string;
  category: string;
  platform: string;
  price: number;
  min_order: number;
  max_order: number;
  rate_per_1000: number;
  type: string;
  description: string | null;
  is_active: boolean;
  avg_time: string | null;
  created_at: string;
  provider_id?: string | null;
  original_id?: string | null;
  source?: 'manual' | 'api';
  service_type?: string;
  refill_enabled?: boolean;
  refill_days?: number;
  cancel_enabled?: boolean;
  provider_rate?: number | null;
  provider_category?: string | null;
  pricing_mode?: 'manual' | 'ratio' | 'percent' | 'fixed_profit';
  pricing_value?: number | null;
  min_profit?: number;
  min_price?: number;
  round_to?: number;
  provider_missing_at?: string | null;
};

export const CUSTOM_TYPES = ['Custom Comments', 'Custom Comments Package'];
export const SERVICE_TYPES = ['Default', 'Package', 'Custom Comments', 'Custom Comments Package', 'Mentions', 'Mentions with Hashtags', 'Mentions Custom List', 'Mentions Hashtag', 'Mentions User Followers', 'Mentions Media Likers', 'Subscriptions', 'Poll', 'Comment Likes', 'Comment Replies', 'Invites from Groups', 'Seo'];

export type Order = {
  id: string;
  user_id: string;
  service_id: string | null;
  service_name: string;
  link: string;
  quantity: number;
  charge: number;
  start_count: number | null;
  remains: number | null;
  status: string;
  order_id: number;
  provider_order_id?: string | null;
  provider_id?: string | null;
  provider_service_id?: string | null;
  service_type?: string;
  comments?: string | null;
  panel_service_id?: number | null;
  refill_allowed?: boolean;
  cancel_allowed?: boolean;
  guarantee_days?: number;
  completed_at?: string | null;
  refunded_total?: number;
  refill_id?: string | null;
  refill_requested_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
};

export type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
};

export type TicketReply = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
};
