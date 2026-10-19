import type { AccentKey } from '@/lib/accent';

export type Diet = 'veg' | 'nonveg' | 'egg' | 'jain';

export interface MenuItem {
  id: string;
  name_en: string;
  description_en: string | null;
  price_paise: number;
  diet: Diet;
  spice: number;
  image_path: string | null;
  is_available: boolean;
  is_bestseller: boolean;
  is_chef_pick: boolean;
}

export interface MenuCategory {
  id: string;
  name_en: string;
  items: MenuItem[];
}

export interface MenuData {
  status: 'active' | 'suspended';
  restaurant: {
    name: string; slug?: string; accent?: AccentKey;
    tagline?: string | null; description?: string | null; logo_path?: string | null; banner_path?: string | null;
    address?: string | null; hours_text?: string | null; explore_code?: string | null;
  };
  table_label?: string | null;
  token_valid?: boolean;
  categories?: MenuCategory[];
}

export type OrderStatus = 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type PayMode = 'cash' | 'upi' | 'card';
export type WaiterReason = 'water' | 'cutlery' | 'cleaning' | 'help' | 'other';

export interface StatusOrderItem {
  name_en: string;
  qty: number;
  unit_price_paise: number;
  note: string | null;
}
export interface StatusOrder {
  order_no: number;
  status: OrderStatus;
  note: string | null;
  total_paise: number;
  created_at: string;
  cancel_reason: string | null;
  items: StatusOrderItem[];
}
export interface StatusRequest {
  type: 'waiter' | 'bill';
  reason: WaiterReason | null;
  pay_mode: PayMode | null;
  status: 'open' | 'done';
  created_at: string;
}
export interface StatusData {
  state: 'open' | 'closed' | 'expired';
  restaurant?: { name: string; slug: string; accent: AccentKey; status: string };
  table_label?: string;
  pay_mode?: PayMode | null;
  bill_requested?: boolean;
  total_paise?: number;
  review_available?: boolean;
  orders?: StatusOrder[];
  requests?: StatusRequest[];
}

export interface CartLine {
  id: string;
  qty: number;
  note?: string;
}
