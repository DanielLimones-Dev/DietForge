import assert from "node:assert/strict";
import { test } from "node:test";
import { SaveQueue } from "../src/lib/cloud/engine";
import { emptySnapshot } from "../src/lib/cloud/model";

test("retries an ambiguous cloud save with the same mutation ID and revision", async () => {
  const calls: { id: string; revision: number }[] = [];
  const queue = new SaveQueue(7, async (_snapshot, revision, id) => {
    calls.push({ id, revision });
    if (calls.length === 1) throw new Error("connection lost after commit");
    return 8;
  }, () => {}, () => {});
  queue.enqueue(emptySnapshot());
  await queue.flush();
  assert.equal(queue.state.phase, "error");
  await queue.flush();
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(queue.revision, 8);
  assert.equal(queue.pending, false);
});

test("keeps the most recent edit while an earlier save is in flight", async () => {
  const calls: number[] = [];
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const queue = new SaveQueue(0, async (snapshot, revision) => {
    calls.push(Number(snapshot.preferences.edit));
    if (calls.length === 1) await wait;
    return revision + 1;
  }, () => {}, () => {});
  for (const edit of [1, 2, 3]) { const snapshot = emptySnapshot(); snapshot.preferences.edit = String(edit); queue.enqueue(snapshot); }
  release();
  await queue.flush();
  assert.deepEqual(calls, [1, 3]);
  assert.equal(queue.pending, false);
});
