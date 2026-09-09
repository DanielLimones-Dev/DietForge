import 'server-only';
import { createSupabaseHealthHandler } from '@/lib/server/supabase-health-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return createSupabaseHealthHandler({
    cronSecret: process.env.CRON_SECRET,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    fetchFn: fetch,
  })(request);
}

