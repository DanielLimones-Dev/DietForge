import assert from 'node:assert/strict';
import {test} from 'node:test';
import {authErrorMessage} from '../src/lib/auth-errors';
test('distinguishes email delivery limits, credentials and confirmation',()=>{
 assert.match(authErrorMessage({code:'over_email_send_rate_limit',status:429}),/límite de correos/);
 assert.match(authErrorMessage({code:'invalid_credentials'}),/Correo o contraseña incorrectos/);
 assert.match(authErrorMessage({code:'email_not_confirmed'}),/invitación enviada por el administrador/);
 assert.match(authErrorMessage({code:'email_address_not_authorized'}),/SMTP/);
});
test('unknown auth errors never expose provider messages or credentials',()=>{
 assert.doesNotMatch(authErrorMessage({message:'secret-token-123'}),/secret-token/);
});
