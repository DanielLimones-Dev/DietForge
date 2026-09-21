import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { act } from "react";
import { JSDOM } from "jsdom";

test("browser auto refresh keeps the Window receiver for native timers", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"] as const;
  const originals = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let scheduled = 0;
  let cancelled = 0;
  let nextId = 0;

  Object.defineProperty(dom.window, "setTimeout", { configurable: true, value: function (this: Window) {
    assert.equal(this, dom.window); scheduled += 1; return ++nextId;
  }});
  Object.defineProperty(dom.window, "clearTimeout", { configurable: true, value: function (this: Window) {
    assert.equal(this, dom.window); cancelled += 1;
  }});
  Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

  const { createRoot } = await import("react-dom/client");
  const { useAutoRefresh } = await import("../src/lib/use-auto-refresh");
  const root = createRoot(document.getElementById("root")!);
  function Harness() { useAutoRefresh(async () => 1, () => {}); return null; }

  try {
    await act(async () => root.render(createElement(Harness)));
    assert.equal(scheduled, 1);
    await act(async () => root.unmount());
    assert.equal(cancelled, 1);
  } finally {
    for (const key of keys) {
      const original = originals.get(key);
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
