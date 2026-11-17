import 'server-only';
import { createAccountDeleteHandler } from '@/lib/server/account-privacy-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return createAccountDeleteHandler({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    fetch,
  })(request);
}
