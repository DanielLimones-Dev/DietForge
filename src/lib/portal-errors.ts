export type PortalFailureKind = 'session' | 'forbidden' | 'transient' | 'validation' | 'unknown';
export class PortalFailure extends Error {
 readonly retryable:boolean;
 constructor(readonly kind:PortalFailureKind, message:string, readonly cause?:unknown) {
  super(message);this.name='PortalFailure';this.retryable=kind==='transient';
 }
}
export function portalFailure(error:unknown, status?:number):PortalFailure {
 if(error instanceof PortalFailure)return error;
 const value=(error&&typeof error==='object'?error:{}) as {code?:string;status?:number;name?:string};
 const code=value.code??'';const http=status??value.status;
 if(value.name==='AuthSessionMissingError'||value.name==='AuthInvalidJwtError'||http===401||['invalid_jwt','PGRST301','PGRST302','PGRST303','session_not_found','refresh_token_not_found'].includes(code))
  return new PortalFailure('session','Tu sesión venció. Vuelve a iniciar sesión para continuar.',error);
 if(http===403||code==='42501')
  return new PortalFailure('forbidden','No tienes acceso a este expediente. Confirma el acceso con tu coach o administrador.',error);
 if(http===0||http===408||http===429||(http!==undefined&&http>=500)||['PGRST000','PGRST001','PGRST002','PGRST003','57014','57P01'].includes(code)||code.startsWith('08')||value.name==='AuthRetryableFetchError'||error instanceof TypeError)
  return new PortalFailure('transient','No pudimos conectar con el expediente. Reintentaremos automáticamente.',error);
 if(http===400||code==='P0001'||code.startsWith('22')||code.startsWith('23'))
  return new PortalFailure('validation','La solicitud no pudo completarse. Revisa los datos; tus cambios siguen en pantalla.',error);
 return new PortalFailure('unknown','No pudimos actualizar el expediente. Inténtalo de nuevo; si persiste, contacta a soporte.',error);
}
