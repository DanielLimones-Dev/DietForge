import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openPrintDocument, printDocumentHtml} from '../src/lib/print-document';

test('print documents disconnect the opener and trigger printing once loaded', () => {
  const html = printDocumentHtml('<html><body><p>Plan</p></body></html>');
  assert.match(html, /window\.opener=null/);
  assert.match(html, /window\.print\(\)/);
  assert.equal(html.match(/window\.print\(\)/g)?.length, 1);
});

test('print documents that already trigger printing are left untouched', () => {
  const existing = '<html><body><script>window.addEventListener("load",()=>window.print())</script></body></html>';
  assert.equal(printDocumentHtml(existing), existing);
});

test('openPrintDocument opens a blob window, disconnects the opener and reports blocked popups', () => {
  const descriptors = new Map(['window', 'URL', 'Blob'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const opened = {opener: {} as unknown};
  const urls: string[] = [];
  const revoked: string[] = [];
  Object.defineProperties(globalThis, {
    window: {configurable: true, value: {open: (url: string) => { urls.push(url); return opened; }, setTimeout: () => 0}},
    URL: {configurable: true, value: {createObjectURL: () => 'blob:test', revokeObjectURL: (url: string) => revoked.push(url)}},
    Blob: {configurable: true, value: class {}},
  });
  try {
    assert.equal(openPrintDocument('<html><body>Plan</body></html>'), opened);
    assert.deepEqual(urls, ['blob:test']);
    assert.equal(opened.opener, null);
    (globalThis.window as {open: () => null}).open = () => null;
    assert.throws(() => openPrintDocument('<html><body>Plan</body></html>'), /bloqueó/);
    assert.deepEqual(revoked, ['blob:test']);
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
