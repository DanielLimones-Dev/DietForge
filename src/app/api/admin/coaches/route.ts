import 'server-only';
import { createAdminDeleteHandler, createAdminHandler } from '@/lib/server/admin-handler';
export const runtime='nodejs';
const options=()=>({url:process.env.NEXT_PUBLIC_SUPABASE_URL!,publicKey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,siteUrl:process.env.NEXT_PUBLIC_SITE_URL,fetch});
export async function POST(request:Request){
 return createAdminHandler(options())(request);
}
export async function DELETE(request:Request){return createAdminDeleteHandler(options())(request);}
