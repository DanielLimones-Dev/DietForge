import 'server-only';
import { createAdminHandler } from '@/lib/server/admin-handler';
export const runtime='nodejs';
export async function POST(request:Request){
 return createAdminHandler({url:process.env.NEXT_PUBLIC_SUPABASE_URL!,publicKey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,siteUrl:process.env.NEXT_PUBLIC_SITE_URL,fetch:(...args)=>fetch(...args)})(request);
}
