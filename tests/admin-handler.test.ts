import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdminHandler } from '../src/lib/server/admin-handler';
const body={email:' Coach@Example.com ',months:3,note:'Pago',requestId:'11111111-1111-4111-8111-111111111111'};
const request=(payload=body)=>new Request('http://localhost/api/admin/coaches',{method:'POST',headers:{Authorization:'Bearer caller','Content-Type':'application/json'},body:JSON.stringify(payload)});
test('admin provisioning refuses non-admins before using privileged credentials',async()=>{
 const calls:string[]=[];
 const handler=createAdminHandler({url:'https://fixture.invalid',publicKey:'public',serviceKey:'secret',fetch:async(input)=>{calls.push(String(input));return Response.json(false);}});
 assert.equal((await handler(request())).status,403);assert.equal(calls.length,1);assert.match(calls[0],/dietforge_is_admin$/);
});
test('admin provisioning emails an invitation and grants exact period with caller audit identity',async()=>{
 let calls=0;
 const handler=createAdminHandler({url:'https://fixture.invalid',publicKey:'public',serviceKey:'secret',fetch:async(input,init)=>{
  calls++;const path=new URL(String(input)).pathname;const headers=new Headers(init?.headers);
  if(path.endsWith('dietforge_is_admin'))return Response.json(true);
  if(path.endsWith('dietforge_admin_list'))return Response.json({coaches:[]});
  const data=JSON.parse(init!.body as string);
  if(path.endsWith('/invite')){assert.deepEqual(data,{email:'coach@example.com',data:{invited_by:'dietforge-admin'}});assert.equal(headers.get('authorization'),'Bearer secret');assert.equal(new URL(String(input)).searchParams.get('redirect_to'),'http://localhost/auth/callback?next=password');return Response.json({id:'fixture'});}
  assert.equal(headers.get('authorization'),'Bearer caller');assert.equal(data.p_months,3);assert.equal(data.p_request_id,body.requestId);return Response.json({expires_at:'fixture-date'});
 }});
 const response=await handler(request());assert.equal(response.status,200);assert.equal(calls,4);const result=await response.json();assert.equal(result.emailSent,true);assert.doesNotMatch(JSON.stringify(result),/secret/);
});
test('retry finds existing account, skips creation, and reuses renewal ID',async()=>{
 const handler=createAdminHandler({url:'https://fixture.invalid',publicKey:'public',fetch:async(input,init)=>{
  const path=String(input);if(path.endsWith('dietforge_is_admin'))return Response.json(true);
  if(path.endsWith('dietforge_admin_list'))return Response.json({coaches:[{email:'coach@example.com',user_id:'fixture'}]});
  assert.ok(path.endsWith('dietforge_admin_set_access'));assert.equal(JSON.parse(init!.body as string).p_request_id,body.requestId);return Response.json({});
 }});assert.equal((await handler(request())).status,200);
});
test('unsupported period never creates a coach',async()=>{
 let calls=0;const handler=createAdminHandler({url:'https://fixture.invalid',publicKey:'public',fetch:async()=>{calls++;return Response.json(true);}});
 assert.equal((await handler(request({...body,months:2}))).status,400);assert.equal(calls,1);
});
test('malformed admin requests fail as validation errors before creating users',async()=>{
 let calls=0;const handler=createAdminHandler({url:'https://fixture.invalid',publicKey:'public',fetch:async()=>{calls++;return Response.json(true);}});
 for(const body of ['null','{broken','[]']){
  const response=await handler(new Request('http://localhost/api/admin/coaches',{method:'POST',headers:{Authorization:'Bearer caller','Content-Type':'application/json'},body}));
  assert.equal(response.status,400);
 }
 assert.equal(calls,3);
});
