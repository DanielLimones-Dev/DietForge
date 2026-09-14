import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {act,createElement} from 'react';

test('portal onboarding asks email first, validates passwords and confirms inside card; login and recovery remain available',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/portal',pretendToBeVisual:true});
 const keys=['window','self','document','navigator','WebSocket','BroadcastChannel'] as const;
 const originals=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-key';
 const {supabase}=await import('../src/lib/supabase');const originalSignup=supabase.auth.signUp,originalLogin=supabase.auth.signInWithPassword,originalRecovery=supabase.auth.resetPasswordForEmail;
 let session=false,fail=false;const signup:unknown[]=[];const login:unknown[]=[];const recovery:unknown[]=[];
 supabase.auth.signUp=(async(args:unknown)=>{signup.push(args);return {data:{session:session?{}:null,user:null},error:fail?new Error('Network error'):null};}) as typeof supabase.auth.signUp;
 supabase.auth.signInWithPassword=(async(args:unknown)=>{login.push(args);return {data:{session:null,user:null},error:null};}) as unknown as typeof supabase.auth.signInWithPassword;
 supabase.auth.resetPasswordForEmail=async(...args)=>{recovery.push(args);return {data:{},error:null};};
 const {PortalAuth}=await import('../src/components/PortalAuth');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
 const input=async(index:number,value:string)=>{const field=document.querySelectorAll('input')[index];assert.ok(field);await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
 const submit=async()=>{await act(async()=>{document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});};
 const click=async(text:string)=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent===text);assert.ok(button,text);await act(async()=>button.click());};
 try{
  await act(async()=>root.render(createElement(PortalAuth)));
  assert.match(document.body.textContent??'',/correo validado con tu coach/);assert.equal(document.querySelectorAll('input').length,1);
  await input(0,'cliente@example.invalid');await submit();assert.equal(signup.length,0,'email step never sends signup');
  assert.equal(document.querySelectorAll('input[type=password]').length,2);
  await input(0,'short');await input(1,'short');await submit();assert.equal(signup.length,0);assert.match(document.querySelector('[role=alert]')!.textContent!,/12/);
  await input(0,'contraseña-larga');await input(1,'otra-contraseña');await submit();assert.equal(signup.length,0);assert.match(document.querySelector('[role=alert]')!.textContent!,/coinciden/);
  fail=true;await input(1,'contraseña-larga');await submit();assert.equal(signup.length,1);assert.ok(document.querySelector('.care-onboarding [role=alert]'));assert.equal((document.querySelector('input') as HTMLInputElement).value,'','password cleared after request failure');
  fail=false;await input(0,'contraseña-larga');await input(1,'contraseña-larga');await submit();assert.equal(signup.length,2);assert.match(document.querySelector('.care-onboarding [role=status]')!.textContent!,/Confirma tu correo/);
  assert.equal(document.querySelectorAll('input[type=password]').length,0);
  assert.deepEqual(signup[1],{email:'cliente@example.invalid',password:'contraseña-larga',options:{emailRedirectTo:'http://localhost/auth/callback?next=portal'}});
  assert.equal(document.querySelector('a')?.getAttribute('href'),'/');await act(async()=>root.render(createElement(PortalAuth,{key:'recovery'})));assert.equal(Array.from(document.querySelectorAll('a')).find(a=>a.textContent==='Ya tengo cuenta')?.getAttribute('href'),'/');await input(0,'cliente@example.invalid');
  await click('Olvidé mi contraseña');await submit();assert.equal(recovery.length,1);assert.match(document.querySelector('.care-onboarding [role=status]')!.textContent!,/Revisa tu correo/);
  await act(async()=>root.render(createElement(PortalAuth,{key:'automatic-session'})));session=true;await input(0,'otro@example.invalid');await submit();await input(0,'contraseña-larga');await input(1,'contraseña-larga');await submit();assert.match(document.querySelector('[role=status]')!.textContent!,/Tu sesión está lista/);assert.doesNotMatch(document.querySelector('[role=status]')!.textContent!,/mensaje enviado/);
 }finally{await act(async()=>root.unmount());supabase.auth.signUp=originalSignup;supabase.auth.signInWithPassword=originalLogin;supabase.auth.resetPasswordForEmail=originalRecovery;await supabase.auth.stopAutoRefresh();for(const key of keys){const old=originals.get(key);if(old)Object.defineProperty(globalThis,key,old);else Reflect.deleteProperty(globalThis,key);}dom.window.close();}
});
