import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Public client — for client-side use (read-only, row-level security applies)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service-role client — for server-side use only (bypasses RLS)
export function getServiceSupabase() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
