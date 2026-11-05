import { createClient } from '@supabase/supabase-js';

// Define strictly typed interfaces
export interface InventoryLog {
  id: string;
  barcode: string;
  product_name: string;
  counted_quantity: number;
  location: string;
  counted_by_name: string;
  counted_at: string;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  default_location: string;
  system_quantity: number;
}

export interface AppUser {
  id: string;
  username: string;
  full_name: string;
  password?: string;
  must_set_password: boolean;
  role: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
