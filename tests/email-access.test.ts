import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEmailAccess } from "../src/lib/email-access";

const host = "https://example.supabase.co";
const origin = "http://localhost:3000";
test("accepts email OTPs and normalizes the account email", () => {
  assert.deepEqual(parseEmailAccess(" 123456 ", " Coach@Example.invalid ", host, origin), {
    email: "coach@example.invalid", token: "123456", type: "email",
  });
});
test("accepts Supabase's standard magic link token parameter", () => {
  assert.deepEqual(parseEmailAccess(`${host}/auth/v1/verify?token=test-hash&type=magiclink`, "", host, origin), {
    token_hash: "test-hash", type: "magiclink",
  });
});
test("accepts a token hash from this app's callback", () => {
  assert.deepEqual(parseEmailAccess(`${origin}/auth/callback?token_hash=test-hash&type=email`, "", host, origin), {
    token_hash: "test-hash", type: "email",
  });
});
test("accepts an invitation token sent by the administrator", () => {
  assert.deepEqual(parseEmailAccess(`${origin}/auth/callback?token_hash=test-hash&type=invite`, "", host, origin), {
    token_hash: "test-hash", type: "invite",
  });
});
test("rejects another project, lookalike hosts, missing tokens and recovery links", () => {
  for (const link of [
    "https://attacker.invalid/auth/v1/verify?token=secret",
    "https://example.supabase.co.attacker.invalid/auth/v1/verify?token=secret",
    `${host}/auth/v1/verify?token=secret&type=recovery`,
    `${host}/auth/v1/verify`,
    `${host}/other?token=secret`,
    "not-a-code",
  ]) assert.throws(() => parseEmailAccess(link, "", host, origin));
});
