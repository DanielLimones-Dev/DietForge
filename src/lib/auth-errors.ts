export function authErrorMessage(error: unknown): string {
 const e=error as {code?:string;status?:number};
 if(e?.code==='over_email_send_rate_limit')return 'Supabase alcanzó el límite de correos. Intenta más tarde; si ya tienes contraseña, entra con ella sin solicitar otro correo.';
 if(e?.status===429||e?.code==='over_request_rate_limit')return 'Demasiados intentos seguidos. Espera unos minutos antes de volver a intentar.';
 if(e?.code==='email_address_not_authorized')return 'El servicio de correo aún no permite enviar a esta dirección. El administrador debe configurar SMTP en Supabase.';
 if(e?.code==='email_not_confirmed')return 'Confirma tu correo desde la invitación enviada por el administrador.';
 if(e?.code==='invalid_credentials')return 'Correo o contraseña incorrectos. Si es tu primer acceso, abre la invitación enviada por el administrador.';
 if(e?.code==='weak_password')return 'Elige una contraseña más segura, de al menos 12 caracteres.';
 if(e?.code==='same_password')return 'La contraseña nueva debe ser distinta de la anterior.';
 if(e?.code==='otp_expired')return 'El enlace venció o ya fue utilizado. Solicita uno nuevo.';
 if(e?.code==='signup_disabled'||e?.code==='user_not_found')return 'El administrador debe dar de alta esta cuenta antes de activar el acceso.';
 return 'No se pudo completar la operación. Revisa tu conexión e intenta de nuevo. Si persiste, contacta al administrador.';
}
