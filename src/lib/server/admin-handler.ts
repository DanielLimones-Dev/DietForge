type Options = { url: string; publicKey: string; serviceKey?: string; siteUrl?: string; fetch: typeof fetch };
export function createAdminHandler(options: Options) {
 return async (request: Request): Promise<Response> => {
  const fail=(message:string,status:number)=>Response.json({error:message},{status});
  const token=request.headers.get('authorization');
  if(!token?.startsWith('Bearer '))return fail('Inicia sesión como administrador.',401);
  const rpc=async(name:string,body:unknown={})=>options.fetch(new URL('/rest/v1/rpc/'+name,options.url),{method:'POST',headers:{apikey:options.publicKey,Authorization:token,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)});
  try {
   const check=await rpc('dietforge_is_admin');
   if(!check.ok||await check.json()!==true)return fail('Acceso exclusivo del administrador.',403);
   const body=await request.json().catch(()=>null);
   if(!body || typeof body !== 'object' || Array.isArray(body))return fail('La solicitud debe contener datos válidos.',400);
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||![1,3,12].includes(body.months)||typeof body.note!=='string'||body.note.length>500||typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId))return fail('Revisa el correo y el periodo seleccionado.',400);
   const findAccount=async()=>{const response=await rpc('dietforge_admin_list');if(!response.ok)throw Error('list');const data=await response.json();return data.coaches.find((u:{email:string;user_id:string|null;confirmed?:boolean})=>u.email===email&&u.user_id)??null;};
   const existing=await findAccount();let emailSent=false;
   if(!existing){
    if(!options.serviceKey)return fail('Falta configurar el servicio de altas en el servidor.',503);
    const origin=options.siteUrl?.trim()||new URL(request.url).origin;
    const redirect=new URL('/auth/callback?next=password',origin);
    const inviteUrl=new URL('/auth/v1/invite',options.url);inviteUrl.searchParams.set('redirect_to',redirect.toString());
    const invited=await options.fetch(inviteUrl,{method:'POST',headers:{apikey:options.serviceKey,Authorization:'Bearer '+options.serviceKey,'Content-Type':'application/json'},body:JSON.stringify({email,data:{invited_by:'dietforge-admin'}}),signal:AbortSignal.timeout(15000)});
    if(!invited.ok&&!await findAccount())return fail('No se pudo enviar la invitación. Revisa la configuración de correo de Supabase e inténtalo de nuevo.',502);
    emailSent=invited.ok;
   }
   const access=await rpc('dietforge_admin_set_access',{p_email:email,p_action:'renew',p_months:body.months,p_note:body.note,p_request_id:body.requestId});
   if(!access.ok)return fail('No se pudo activar el periodo. Reintenta la misma operación.',502);
   return Response.json({access:await access.json(),emailSent,alreadyRegistered:!!existing});
  }catch{return fail('No se pudo completar el alta. Reintenta para comprobar su estado.',502);}
 };
}
