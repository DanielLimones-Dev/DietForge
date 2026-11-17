import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { act, createElement } from 'react';

test('the account panel reports consent, exports the caller data and requires a double confirmation before deletion', async () => {
  const virtualConsole = new VirtualConsole();
  // jsdom no implementa navegación ni descargas; el panel sí debe dispararlas.
  virtualConsole.on('jsdomError', error => {
    if (!/Not implemented: navigation/.test(String(error?.message))) console.error(error);
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/cuenta', pretendToBeVisual: true, virtualConsole });
  const keys = ['window', 'self', 'document', 'navigator', 'WebSocket', 'BroadcastChannel'] as const;
  const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-key';
  const { supabase } = await import('../src/lib/supabase');
  const original = {
    getUser: supabase.auth.getUser, getSession: supabase.auth.getSession,
    signOut: supabase.auth.signOut, rpc: supabase.rpc,
  };
  const rpcCalls: { name: string; args: unknown }[] = [];
  const exported = { cuenta: { email: 'coach@example.invalid' }, datos: { database: { clients: [] } } };
  supabase.auth.getUser = (async () => ({ data: { user: { id: 'owner', email: 'coach@example.invalid' } }, error: null })) as typeof supabase.auth.getUser;
  supabase.auth.getSession = (async () => ({ data: { session: { access_token: 'session-token' } }, error: null })) as unknown as typeof supabase.auth.getSession;
  supabase.auth.signOut = (async () => ({ error: null })) as typeof supabase.auth.signOut;
  supabase.rpc = (async (name: string, args: unknown) => {
    rpcCalls.push({ name, args });
    if (name === 'dietforge_privacy_read_consent') return { data: { current_version: '1.0', consent: { version: '1.0', accepted_at: '2026-11-16T18:05:00.000Z' } }, error: null };
    if (name === 'dietforge_privacy_export') return { data: exported, error: null };
    return { data: null, error: null };
  }) as unknown as typeof supabase.rpc;
  const fetchCalls: { url: string; init: RequestInit | undefined }[] = [];
  const originalFetch = globalThis.fetch;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:fixture';
  URL.revokeObjectURL = () => {};
  let signOuts = 0;
  supabase.auth.signOut = (async () => { signOuts += 1; return { error: null }; }) as typeof supabase.auth.signOut;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return Response.json({ deleted: true });
  }) as typeof fetch;

  const { AccountPrivacy } = await import('../src/components/AccountPrivacy');
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  const click = async (label: string) => {
    const button = Array.from(document.querySelectorAll('button')).find(node => node.textContent?.includes(label));
    assert.ok(button, `botón ${label}`);
    await act(async () => button.click());
  };
  const type = async (label: string, value: string) => {
    const field = Array.from(document.querySelectorAll('label')).find(node => node.textContent?.startsWith(label))?.querySelector('input');
    assert.ok(field, `campo ${label}`);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(field, value);
      field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };
  try {
    await act(async () => root.render(createElement(AccountPrivacy)));
    assert.match(document.body.textContent ?? '', /Versión 1\.0/);
    assert.match(document.body.textContent ?? '', /16\/11\/2026 18:05 UTC/);

    await click('Exportar mis datos');
    const exportCall = rpcCalls.find(call => call.name === 'dietforge_privacy_export');
    assert.ok(exportCall, 'exporta por RPC');
    assert.match(String((exportCall!.args as { p_request_id: string }).p_request_id), /^[0-9a-f-]{36}$/);
    assert.match(document.body.textContent ?? '', /Descarga lista/);

    await click('Eliminar mi cuenta');
    await type('Correo de la cuenta', 'otro@example.invalid');
    await type('Escribe ELIMINAR', 'ELIMINAR');
    await click('Eliminar definitivamente');
    assert.match(document.body.textContent ?? '', /correo no coincide/);
    assert.equal(fetchCalls.length, 0, 'la confirmación inválida no llama al servidor');

    await type('Correo de la cuenta', 'coach@example.invalid');
    await click('Eliminar definitivamente');
    assert.equal(fetchCalls.length, 1, 'la confirmación válida llama al endpoint');
    assert.match(fetchCalls[0].url, /\/api\/account\/delete$/);
    assert.equal(new Headers(fetchCalls[0].init?.headers).get('authorization'), 'Bearer session-token');
    assert.equal(signOuts, 1, 'cierra la sesión después de eliminar');
  } finally {
    await act(async () => root.unmount());
    supabase.auth.getUser = original.getUser; supabase.auth.getSession = original.getSession;
    supabase.auth.signOut = original.signOut; supabase.rpc = original.rpc;
    await supabase.auth.stopAutoRefresh();
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
    for (const key of keys) {
      const prior = originals.get(key);
      if (prior) Object.defineProperty(globalThis, key, prior); else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
