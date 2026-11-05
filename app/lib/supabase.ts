import { createClient } from '@supabase/supabase-js';

// Define strictly typed interfaces
export interface Tenant {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface InventoryLog {
  id: string;
  tenant_id: string;
  barcode: string;
  product_name: string;
  counted_quantity: number;
  location: string;
  counted_by_name: string;
  counted_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  barcode: string;
  name: string;
  category: string | null;
  default_location: string | null;
  system_quantity: number;
  purchase_price: number;
  sale_price: number;
}

export interface AppUser {
  id: string;
  tenant_id: string | null;
  username: string;
  full_name: string;
  password?: string;
  must_set_password: boolean;
  role: 'master' | 'admin' | 'auditor';
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
