import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFailure} from '../src/lib/portal-errors';

test('portal errors distinguish session, access, transport and rejected data without exposing server details',()=>{
 for(const [error,kind,retryable] of [
  [{code:'PGRST301',message:'private details'},'session',false],
  [{code:'42501'},'forbidden',false],
  [{status:401},'session',false],
  [{status:503},'transient',true],
  [new TypeError('Failed to fetch'),'transient',true],
  [{code:'P0001'},'validation',false],
  [{status:400},'validation',false],
  [{code:'PGRST202'},'unknown',false],
 ] as const){
  const result=portalFailure(error);
  assert.equal(result.kind,kind);assert.equal(result.retryable,retryable);
  assert.equal(result.cause,error);assert.ok(!result.message.includes('private details'));
  assert.equal(portalFailure(result),result);
 }
});

test('Supabase missing session and invalid JWT are session errors even with HTTP 400',async()=>{
 const {AuthSessionMissingError,AuthInvalidJwtError}=await import('@supabase/supabase-js');
 for(const cause of [new AuthSessionMissingError(),new AuthInvalidJwtError('Invalid token')]){
  assert.equal(portalFailure(cause).kind,'session');
 }
});
