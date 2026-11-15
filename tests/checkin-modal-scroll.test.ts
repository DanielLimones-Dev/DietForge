import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {act,createElement} from 'react';

test('check-in modal locks background scroll while open and restores it when closed', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url: 'http://localhost', pretendToBeVisual: true});
  const keys = ['window', 'document', 'navigator', 'WebSocket', 'BroadcastChannel'] as const;
  const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, {configurable: true, value: dom.window[key]});
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-key';
  document.documentElement.style.overflow = 'auto';
  document.body.style.overflow = 'visible';
  document.body.style.paddingRight = '4px';
  const {CheckInForm} = await import('../src/components/CheckInForm');
  const {ToastProvider} = await import('../src/components/Toast');
  const {supabase} = await import('../src/lib/supabase');
  const {createRoot} = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(createElement(ToastProvider, null, createElement(CheckInForm, {clientId: 1, onSave: () => {}, onCancel: () => {}}))));
    assert.equal(document.documentElement.style.overflow, 'hidden');
    assert.equal(document.body.style.overflow, 'hidden');
    assert.notEqual(document.body.style.paddingRight, '4px');
    await act(async () => root.unmount());
    assert.equal(document.documentElement.style.overflow, 'auto');
    assert.equal(document.body.style.overflow, 'visible');
    assert.equal(document.body.style.paddingRight, '4px');
  } finally {
    await supabase.auth.stopAutoRefresh();
    for (const key of keys) {
      const previous = originals.get(key);
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
