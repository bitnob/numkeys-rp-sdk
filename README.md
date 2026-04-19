# @numkeys/rp-sdk

The Relying-Party SDK for the [Numkeys Protocol](https://github.com/bitnob/numkeys-protocol). Drop this into your web app, make one function call, and get back a cryptographically verified proof that the user holds a Numkeys identity — without integrating with an issuer, exchanging API keys, or learning their real phone number.

```sh
pnpm add github:bitnob/numkeys-rp-sdk#v0.1.0
```

> Always pin to a tag or commit SHA. `main` is mutable.

---

## What you get

After one call to `openVerifyPopup` you have a `result` object containing:

- **`proxyNumber`** — a stable, opaque per-user identifier (e.g. `nk_2qF8…`). Treat it like an account ID. Same wallet → same proxy number, every time.
- **`phoneVerified`** — `true` if the wallet proved the phone number you supplied matches the one the user verified with their issuer. Only meaningful when `scope: "phone"`.
- **`attestationJti`** — the issuer's nonce on the underlying attestation. Useful for replay tracking and audit logs.
- **`issuer`** — which issuer (e.g. `numkeys.com`) signed the attestation, so you know which root of trust applies.

You can use this for:

- **Passwordless sign-in / signup** — `proxyNumber` is your user key. No SMS bills, no carrier lookup.
- **Phone verification at checkout** — user types `+1 555 1234567`, you ask their wallet "did this person verify this number?", get back `true` / `false`.
- **Sybil resistance** — one verified human, one account, without ever knowing who the human is.

---

## Quickstart — popup transport (desktop / most browsers)

```ts
import { openVerifyPopup } from "@numkeys/rp-sdk";

const r = await openVerifyPopup({
  walletUrl: "https://numkeys.com/wallet/verify",
  rpOrigin: window.location.origin,
  rpName: "Acme Login",
  scope: "phone",
  candidatePhoneE164: "+15551234567",
  allowedIssuers: ["numkeys.com"],
  getIssuerPubkey: async (iss) => {
    const r = await fetch(`https://${iss}/.well-known/numkeys/issuer-pubkey.json`);
    if (!r.ok) return null;
    const { public_key } = await r.json();
    return public_key;
  },
});

if (r.ok) {
  console.log("Verified!", r.result.proxyNumber, r.result.phoneVerified);
} else {
  // r is one of: { reason: "declined", error } | { reason: "verification_failed", error }
  //            | { reason: "timeout" } | { reason: "popup_blocked" } | { reason: "popup_closed" }
  console.warn("Verify failed:", r);
}
```

That's the whole integration. The promise **never throws**; every failure mode is a discriminated union you can handle explicitly.

---

## Quickstart — redirect transport (mobile-friendly fallback)

Some mobile browsers block popups. The redirect transport navigates the user away to the wallet, which sends them back with the response in the URL fragment.

```ts
import {
  buildRpVerifyRequest,
  encodeRpVerifyRequest,
  consumeRedirectFragment,
} from "@numkeys/rp-sdk";

// 1. On your "Verify" button:
function startVerify() {
  const request = buildRpVerifyRequest({
    rpOrigin: location.origin,
    rpName: "Acme Login",
    scope: "anonymous",
    returnUrl: `${location.origin}/verify-return`,
  });
  // Persist the request — you need it to verify the response when the user comes back.
  sessionStorage.setItem("numkeys.req", JSON.stringify(request));
  location.assign(`https://numkeys.com/wallet/verify?req=${encodeRpVerifyRequest(request)}`);
}

// 2. On /verify-return page load:
async function onReturn() {
  const stored = sessionStorage.getItem("numkeys.req");
  if (!stored) return; // user landed here without going through the flow
  sessionStorage.removeItem("numkeys.req");

  const r = await consumeRedirectFragment({
    request: JSON.parse(stored),
    allowedIssuers: ["numkeys.com"],
    getIssuerPubkey: /* same resolver as above */,
  });

  if (r === null) return;       // no fragment present (cold reload)
  if (r.ok) onVerified(r.result);
  else showError(r);
}
```

You can use the redirect transport on desktop too — it's the same security guarantees, just a worse UX (full navigation) on devices that can do popups.

---

## Server-side verification

For high-stakes flows (account creation, payments) you should re-verify the response **on your server** so a tampered client can't mint fake successes.

```ts
import { verifyRpVerifyResponse, InMemoryNonceStore } from "@numkeys/rp-sdk";
// In production swap InMemoryNonceStore for a Redis/DB-backed implementation.
const nonceStore = new InMemoryNonceStore();

app.post("/api/verify", async (req, res) => {
  // The client sends both the original request and the response it got back.
  const { request, response } = req.body;
  try {
    const result = await verifyRpVerifyResponse({
      request,
      response,
      options: { allowedIssuers: ["numkeys.com"] },
      getIssuerPubkey: yourSafeResolver,
      nonceStore,
    });
    // result.proxyNumber, result.phoneVerified, etc.
    await loginOrCreateAccount(result.proxyNumber);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e) });
  }
});
```

The verifier checks every binding rule from SPEC §9.9: signature validity, attestation chain, request/response binding, nonce replay protection, scope rules, candidate-phone matching, clock skew, and issuer trust. If any check fails, it throws a `ProtocolError` with a stable machine-readable `code`.

---

## API reference

### `openVerifyPopup(params): Promise<OpenVerifyPopupResult>`

Opens the wallet in a popup, sends the request, listens for the postMessage response, runs the full SPEC §9.9 verifier, and resolves with the result. Never throws.

| param | type | required | default | what it does |
|---|---|---|---|---|
| `walletUrl` | `string` | ✓ | — | The wallet's verify URL, e.g. `"https://numkeys.com/wallet/verify"`. |
| `rpOrigin` | `string` | ✓ | — | Your origin, bound into the signed response. Almost always `window.location.origin`. |
| `rpName` | `string` | ✓ | — | Human-readable name shown in the wallet's consent UI ("Acme Login wants to verify…"). |
| `scope` | `"anonymous" \| "phone"` | ✓ | — | `anonymous` = proof of personhood. `phone` = additionally prove a phone match. |
| `candidatePhoneE164` | `string` | ✓ if `scope === "phone"` | — | The phone number you want verified, in E.164 (`"+15551234567"`). |
| `allowedIssuers` | `string[]` | ✓ | — | Issuer `iss` values you trust. **SSRF defense — checked before any network fetch.** |
| `getIssuerPubkey` | `(iss) => Promise<string \| null>` | ✓ | — | Resolves an issuer's Ed25519 public key (b64url). See [security](#security-things-you-must-not-skip). |
| `nonceStore` | `NonceStore` | — | per-call in-memory | Replay protection. **Replace in production** — see below. |
| `ttlSec` | `number` | — | 120 | Request lifetime. Max 300. |
| `maxAttestationAgeSec` | `number` | — | 365 days | Reject attestations older than this. |
| `clockSkewSec` | `number` | — | 60 | Tolerance for `response.iat` being slightly in the future. |
| `popupFeatures` | `string` | — | `"popup,width=480,height=720"` | Passed to `window.open`. |
| `timeoutMs` | `number` | — | 5 min | After this, the popup is closed and the promise resolves with `reason: "timeout"`. |

**Result shape:**

```ts
| { ok: true; result: VerifyRpResponseResult; response: RpVerifyResponse }
| { ok: false; reason: "declined"; error: string }
| { ok: false; reason: "verification_failed"; error: string }
| { ok: false; reason: "timeout" }
| { ok: false; reason: "popup_blocked" }   // window.open returned null
| { ok: false; reason: "popup_closed" }    // user closed the popup before responding
```

### `consumeRedirectFragment(params): Promise<ConsumeRedirectResult | null>`

Parses `window.location.hash` for a wallet response, runs the verifier, returns the result. Returns `null` if no response is present (so it's safe to call on cold loads). Same `request`, `allowedIssuers`, `getIssuerPubkey`, `nonceStore` knobs as above.

By default it also clears the URL fragment via `history.replaceState` so a refresh doesn't replay the response (your nonce store is the real replay guard, but this is good hygiene). Pass `clearHash: false` to disable.

### `buildRpVerifyRequest(opts) → RpVerifyRequest`

Lower-level — build a request object yourself. Used internally by `openVerifyPopup`. Useful for the redirect transport where you need to persist the request between navigations.

### `encodeRpVerifyRequest(request) → string`

Encode a request for the URL `?req=...` parameter (canonical-JSON + b64url).

### `verifyRpVerifyResponse({ request, response, options, getIssuerPubkey, nonceStore })`

The full SPEC §9.9 verifier. Use this on your server. Throws `ProtocolError` (with a stable `code`) on any failure.

### `InMemoryNonceStore`

A development-only nonce store. Replace in production — it doesn't survive process restarts and isn't shared across instances.

```ts
// Sketch of a Redis-backed nonce store
class RedisNonceStore implements NonceStore {
  async hasSeen(jti: string) { return (await redis.exists(`nk:jti:${jti}`)) === 1; }
  async markSeen(jti: string, expiresAtSec: number) {
    const ttl = Math.max(1, expiresAtSec - Math.floor(Date.now() / 1000));
    await redis.set(`nk:jti:${jti}`, "1", "EX", ttl);
  }
}
```

---

## Security: things you must NOT skip

### 1. `allowedIssuers` is your trust root

The verifier checks this **before** doing any network fetch, so it doubles as SSRF defense. Whitelist only issuers whose security practices and proxy-number stability you actually trust.

### 2. `getIssuerPubkey` is your responsibility to harden

The SDK can't safely fetch issuer keys for you because that fetch needs application-specific defenses. Your implementation must:

- **Validate TLS properly** — reject self-signed and expired certs.
- **Refuse private/loopback/link-local IPs** (`10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`, `192.168.0.0/16`, `::1`, etc.) — defense against DNS rebinding to internal services.
- **Cache aggressively** but cap the TTL (e.g. 24h). Returning `null` correctly produces an `issuer_key_discovery_failed` error rather than crashing.

A minimal hardened resolver looks like:

```ts
import dns from "node:dns/promises";
import net from "node:net";
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, string>({ max: 100, ttl: 1000 * 60 * 60 * 12 });

const PRIVATE_CIDRS = [/* ...standard private/loopback/link-local ranges... */];
const isPrivateIp = (ip: string) => /* check against PRIVATE_CIDRS */;

async function getIssuerPubkey(iss: string): Promise<string | null> {
  if (!ALLOWED_ISSUERS.has(iss)) return null;
  const cached = cache.get(iss);
  if (cached) return cached;

  const addrs = await dns.resolve(iss);
  if (addrs.some(isPrivateIp)) return null;

  const r = await fetch(`https://${iss}/.well-known/numkeys/issuer-pubkey.json`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!r.ok) return null;
  const { public_key } = await r.json();
  cache.set(iss, public_key);
  return public_key;
}
```

### 3. `nonceStore` must be durable in production

`InMemoryNonceStore` is per-process. If you serve multiple instances, an attacker can replay a response by routing the second attempt to a different instance. Use Redis, your database, or any shared cache.

### 4. Re-verify on the server for high-stakes flows

Client-side verification is enough for "show a green checkmark in the UI". For account creation, payments, anything financial — re-verify on your server with `verifyRpVerifyResponse`. A tampered browser can fake `r.ok === true`.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `popup_blocked` | The browser killed `window.open`. You must call `openVerifyPopup` directly inside a click handler — not after an `await`, not inside a `setTimeout`. |
| `popup_closed` immediately | User dismissed the popup, **or** their browser doesn't support cross-origin postMessage delivery from the popup. Fall back to the redirect transport. |
| `verification_failed: untrusted_issuer` | The wallet's attestation is signed by an issuer not in your `allowedIssuers` list. Either expand the list or refuse the request. |
| `verification_failed: issuer_key_discovery_failed` | Your `getIssuerPubkey` returned `null` or threw. Check it loads the well-known doc and parses `public_key`. |
| `verification_failed: nonce_already_used` | The same response was submitted twice — usually a UX bug (form resubmit) or replay attempt. Show a "verification expired, please try again" message. |
| `verification_failed: response_from_future` / `request_expired` | Clock drift between your server and the wallet/issuer. Bump `clockSkewSec` modestly (≤120) or fix NTP. |
| `declined: phone_mismatch` | The user's verified phone doesn't match `candidatePhoneE164`. Tell them to re-enter the number or use a different wallet. |

---

## License

MIT
