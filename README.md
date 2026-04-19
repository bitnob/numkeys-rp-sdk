# @numkeys/rp-sdk

The Relying-Party SDK for the [Numkeys Protocol](https://github.com/bitnob/numkeys-protocol). Drop this into your web app, ask any Numkeys-supported wallet for an attestation through whatever transport works for the user's device, and get back a cryptographically verified proof that they hold a Numkeys identity.

```sh
pnpm add github:bitnob/numkeys-rp-sdk#v0.2.0
```

> Always pin to a tag or commit SHA. `main` is mutable.

---

## What you get back

After one call to `requestAttestation`, you have a verified `result` object with:

- **`proxyNumber`** — a stable, opaque per-user identifier (e.g. `nk_2qF8…`). Same wallet → same proxy number, every time. Use it as your account key.
- **`phoneVerified`** — `true` if the wallet proved a candidate phone you supplied matches the verified one. Only meaningful in `scope: "phone"`.
- **`attestationJti`** — issuer's nonce on the attestation, useful for audit logs and replay tracking.
- **`issuer`** — which issuer (e.g. `numkeys.com`) signed the attestation. Discovered FROM the attestation, not pre-declared.

What you do **not** get: the user's real phone number, name, email, or any way to contact them outside the protocol. `anonymous` scope reveals only that they're a verified human; `phone` scope additionally proves a specific number matches without revealing it (if you didn't already have it).

---

## How the flow actually works

The RP triggers a generic "ask for an attestation" intent. Whatever wallet the user has — browser extension, web wallet, mobile wallet via QR or deep link — handles it and returns an attestation. The RP **never pre-declares which wallet to use**: it lists transports it supports, the SDK uses the first one that works.

```
                   ┌────────────────────────────────────┐
                   │ User clicks "Sign in with Numkeys" │
                   └────────────────┬───────────────────┘
                                    │
                                    ▼
                   ┌────────────────────────────────────┐
                   │ requestAttestation({ transports }) │
                   └────────────────┬───────────────────┘
                                    │ tries each, in order
                ┌───────────────────┼───────────────────┬─────────────┐
                ▼                   ▼                   ▼             ▼
          ┌─────────┐         ┌─────────┐         ┌─────────┐    ┌────────┐
          │extension│   →     │  popup  │   →     │   qr    │ →  │redirect│
          │ (probe) │         │window.  │         │show QR, │    │mobile  │
          │postMsg  │         │open()   │         │poll for │    │deep    │
          │         │         │         │         │response │    │link    │
          └────┬────┘         └────┬────┘         └────┬────┘    └────┬───┘
               │                   │                   │              │
               │  first transport that returns a response wins        │
               └───────────────────┴───────────┬───────┴──────────────┘
                                               ▼
                          ┌─────────────────────────────────────┐
                          │ Decode attestation → read iss field │
                          │ Check iss against trustPolicy       │
                          │ Fetch issuer pubkey (cached)        │
                          │ Run full SPEC §9.9 verifier         │
                          └─────────────────┬───────────────────┘
                                            ▼
                              ┌─────────────────────────────┐
                              │ { ok: true, result, ... }   │
                              └─────────────────────────────┘
```

The trust check runs **after** the wallet returns — issuer is discovered from the attestation, then matched against your `trustPolicy.allowedIssuers` **before** any pubkey-fetch network call (SSRF defense).

---

## Quickstart

```ts
import { requestAttestation } from "@numkeys/rp-sdk";

async function onSignInClick() {
  const r = await requestAttestation({
    rpOrigin: window.location.origin,
    rpName: "Acme Login",
    scope: "anonymous",

    // Try transports in priority order. SDK uses the first one that works.
    transports: [
      { kind: "extension" },
      { kind: "popup", walletUrl: getUserPreferredWalletUrl() },
    ],

    // What you trust, AFTER seeing the attestation.
    trustPolicy: {
      allowedIssuers: ["numkeys.com"],
    },

    // Resolve issuer pubkeys safely. See "Security" section.
    getIssuerPubkey: async (iss) => {
      const r = await fetch(`https://${iss}/.well-known/numkeys/issuer-pubkey.json`);
      if (!r.ok) return null;
      const { public_key } = await r.json();
      return public_key;
    },
  });

  if (r.ok) {
    // r.transport tells you which transport produced the response.
    console.log(`Verified via ${r.transport}:`, r.result.proxyNumber);
    return signInUser(r.result.proxyNumber);
  }

  switch (r.reason) {
    case "no_transport_available":
      return showError("No supported wallet found. Install one or scan a QR code.");
    case "declined":
      return showError(`User declined: ${r.error}`);
    case "verification_failed":
      return showError(`Wallet returned an invalid response: ${r.error}`);
    case "timeout":
      return showError("Verification timed out.");
    case "navigated":
      // Only happens if you used the redirect transport; control will resume
      // on your return page via consumeRedirectFragment().
      return;
  }
}
```

The promise **never throws**. Every outcome is encoded in the discriminated-union result.

---

## Choosing transports

| Scenario | Recommended transports (in order) |
|---|---|
| **Desktop web app, broad audience** | `extension` → `popup` → `qr` |
| **Mobile web app** | `extension` → `qr` → `redirect` |
| **App embedded in another iframe** (where popups are unreliable) | `extension` → `qr` → `redirect` |
| **Kiosk / TV / shared device** | `qr` only (user authenticates from their personal phone) |
| **Backwards compatibility with v0.1 integrations** | `popup` only (or keep using `openVerifyPopup`) |

Transport selection is just a fall-through: if `extension` reports "no extension installed", the SDK tries `popup`. If popup is blocked by the browser, it tries `qr`. The first one that yields a response (success OR a deliberate user decline) wins. Transports that *did* reach a wallet but got declined or returned a malformed response do **not** fall through — that's an explicit user choice or a wallet bug, and silently retrying with another transport would be the wrong answer.

---

## Transports in detail

### Popup transport

```
┌─────────┐   window.open(walletUrl?req=…)  ┌─────────┐
│ RP page │ ──────────────────────────────▶ │ Wallet  │
│         │                                 │ popup   │
│         │ ◀───────── postMessage ──────── │         │
└─────────┘   { type: "numkeys/verify-      └─────────┘
                response", response: ... }
```

```ts
{
  kind: "popup",
  walletUrl: "https://numkeys.com/wallet/verify",  // user's chosen wallet
  popupFeatures: "popup,width=480,height=720",     // optional
  timeoutMs: 5 * 60 * 1000,                        // optional
}
```

You must call `requestAttestation` synchronously from a user gesture (click handler) — browsers block `window.open` calls that aren't tied to user interaction. **You** decide where `walletUrl` comes from: hardcoded for v1 product, user setting in localStorage, or a registry lookup.

**Reports `unavailable` when:** popup is blocked, or the user closes it before responding.

---

### Extension transport

```
┌──────────────┐   postMessage("numkeys/sign-probe")   ┌──────────────┐
│ RP page      │ ────────────────────────────────────▶ │ Wallet ext.  │
│              │                                       │ content      │
│              │ ◀──── "numkeys/sign-ack" (≤200ms) ─── │ script       │
│              │                                       │              │
│              │ ──── "numkeys/sign-request" ────────▶ │ (shows ext.  │
│              │                                       │  consent UI) │
│              │ ◀───── "numkeys/sign-response" ───── │              │
└──────────────┘                                       └──────────────┘
```

```ts
{
  kind: "extension",
  probeTimeoutMs: 200,            // optional — how long to wait for ack
  responseTimeoutMs: 5 * 60_000,  // optional — how long to wait for sign
}
```

**Reports `unavailable` when:** no extension responds to the probe within `probeTimeoutMs`. This is the most graceful fallback — there's no error UI, the SDK just moves to the next transport.

#### Wire contract for browser-extension wallets

If you're building a Numkeys wallet as a browser extension, here's the message contract you need to implement in your content script. Each handshake includes a per-request `tx_id` that the extension MUST echo back so the SDK can correlate probe→ack→response:

```ts
// 1. Probe handling — reply ASAP (under 200ms), echoing tx_id.
window.addEventListener("message", (ev) => {
  if (ev.source !== window) return;          // only same-page messages
  if (ev.data?.type === "numkeys/sign-probe") {
    window.postMessage(
      { type: "numkeys/sign-ack", tx_id: ev.data.tx_id },
      ev.origin,
    );
  }
});

// 2. Sign request — show your UI, then reply with tx_id + request_id.
window.addEventListener("message", async (ev) => {
  if (ev.source !== window) return;
  if (ev.data?.type !== "numkeys/sign-request") return;

  const { tx_id, request } = ev.data;
  const response = await myExtension.handleSignRequest(request);
  window.postMessage(
    {
      type: "numkeys/sign-response",
      tx_id,
      request_id: request.request_id,
      response,
    },
    ev.origin,
  );
});
```

Always check `ev.source === window` so you only respond to messages from the page itself.

**Threat model note.** The page's `postMessage` channel is shared with every script running in that document — there's no way for the SDK to distinguish a real extension from a same-origin attacker. The `tx_id` echo is a correlation aid, not a security boundary. The actual integrity guarantee is the Ed25519 signature on the attestation, which the verifier checks regardless of transport.

---

### QR transport (cross-device)

```
┌─────────┐   show QR(numkeys://sign?...)   ┌─────────┐
│ RP page │ ──────────────────────────────▶ │ User's  │
│         │                                 │ phone   │
│         │           POST response          │ wallet  │
│   ▲     │ ◀────────── (network) ────────  │         │
│   │     │                                 └─────────┘
│   │poll │
│   │     │
│   ▼     │
│ Server  │
│ session │
└─────────┘
```

```ts
{
  kind: "qr",
  // Your server creates a one-shot session, returns coordination URLs.
  createSession: async () => {
    const r = await fetch("/api/numkeys/sessions", { method: "POST" });
    const { signRequestUrl, pollUrl } = await r.json();
    return { signRequestUrl, pollUrl };
  },
  displayQr: (qrPayload) => {
    // qrPayload is "numkeys://sign?session=…&req=…" — render it as a QR code.
    showModal(<QrCode data={qrPayload} />);
  },
  dismissQr: () => closeModal(),
  pollIntervalMs: 1500,
  timeoutMs: 5 * 60_000,
}
```

QR requires server cooperation. Your backend creates a short-lived session keyed by some random ID. The browser polls `pollUrl` for the wallet's response; the wallet POSTs to `signRequestUrl`. A minimal server contract:

```
POST /api/numkeys/sessions
  → 201 { signRequestUrl: ".../sessions/abc123", pollUrl: ".../sessions/abc123" }

GET /api/numkeys/sessions/abc123
  → 200 null            (no response yet, keep polling)
  → 200 { ...response } (wallet has POSTed the response)
  → 410 Gone            (session expired)

POST /api/numkeys/sessions/abc123
  body: <RpVerifyResponse | RpVerifyErrorResponse>
  → 204 (response stored, session marked complete)
```

Sessions should expire (30 seconds is plenty), be single-use, and rate-limited by IP.

**Reports `unavailable` when:** `createSession` or `displayQr` throws. If polling reaches the timeout without a response, returns `timeout` (not `unavailable`).

---

### Redirect transport

```
┌─────────┐  location.assign(walletUrl?req=…)  ┌─────────┐
│ RP page │ ──────────────────────────────────▶│ Wallet  │
│         │                                    │ page    │
└─────────┘                                    └────┬────┘
                                                    │
                                                    │ user signs
                                                    ▼
                                          location.assign(
                                            returnUrl#numkeys_response=…
                                          )
                                              │
                                              ▼
                                         ┌──────────┐
                                         │ RP /verify-
                                         │  return  │
                                         │ → consume│
                                         │   Redirect
                                         │   Fragment
                                         └──────────┘
```

```ts
{
  kind: "redirect",
  walletUrl: "https://numkeys.com/wallet/verify",
  returnUrl: `${location.origin}/verify-return`,  // MUST be on rpOrigin
  persistRequest: (req) => sessionStorage.setItem("numkeys.req", JSON.stringify(req)),
}
```

When this transport fires, the page navigates away. `requestAttestation` resolves with `{ ok: false, reason: "navigated", request }` — that's not really "false", it's "the answer will arrive on a different page load". Your return page calls [`consumeRedirectFragment`](#consumeredirectfragment) to pick up the response.

```ts
// On /verify-return page load:
import { consumeRedirectFragment } from "@numkeys/rp-sdk";

const stored = sessionStorage.getItem("numkeys.req");
if (stored) {
  sessionStorage.removeItem("numkeys.req");
  const r = await consumeRedirectFragment({
    request: JSON.parse(stored),
    allowedIssuers: ["numkeys.com"],
    getIssuerPubkey: yourResolver,
  });
  if (r?.ok) signInUser(r.result.proxyNumber);
}
```

Use redirect when popups are unreliable (mobile Safari, iframed contexts) and you can't ship QR for some reason.

---

## Server-side verification (high-stakes flows)

Client-side `requestAttestation` is enough to show "verified ✓" in the UI. For account creation, payments, withdrawals — anything financial — re-verify on your server. A tampered browser can fake a successful client result, but it can't forge an Ed25519 signature against the issuer's pubkey.

```ts
import { verifyRpVerifyResponse, InMemoryNonceStore } from "@numkeys/rp-sdk";

// Use a Redis/DB-backed nonce store in production.
const nonceStore = new InMemoryNonceStore();

app.post("/api/numkeys/verify", async (req, res) => {
  const { request, response } = req.body;
  try {
    const result = await verifyRpVerifyResponse({
      request,
      response,
      options: { allowedIssuers: ["numkeys.com"] },
      getIssuerPubkey: yourSafeResolver,
      nonceStore,
    });
    await loginOrCreateAccount(result.proxyNumber);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e) });
  }
});
```

The verifier checks every binding rule from SPEC §9.9: signature validity, attestation chain, request/response binding, nonce replay protection, scope rules, candidate-phone matching, clock skew, and issuer trust. Any failure throws `ProtocolError` with a stable `code`.

---

## API reference

### `requestAttestation(params): Promise<RequestAttestationResult>`

The headline API. See [Quickstart](#quickstart) above for full example.

| param | type | required | what it does |
|---|---|---|---|
| `rpOrigin` | `string` | ✓ | Your origin, bound into the signed response. Almost always `window.location.origin`. |
| `rpName` | `string` | ✓ | Human-readable name shown in the wallet's consent UI. |
| `scope` | `"anonymous" \| "phone"` | ✓ | What you're asking the wallet to prove. |
| `candidatePhoneE164` | `string` | ✓ if `scope === "phone"` | The phone number to verify, in E.164. |
| `transports` | `Transport[]` | ✓ | Transports tried in order. See [Transports in detail](#transports-in-detail). |
| `trustPolicy.allowedIssuers` | `string[]` | ✓ | Issuer `iss` values you trust. Checked AFTER attestation arrives. |
| `trustPolicy.maxAttestationAgeSec` | `number` | — | Reject attestations older than this. Default 365 days. |
| `trustPolicy.clockSkewSec` | `number` | — | Tolerance for `response.iat` in the future. Default 60s. |
| `getIssuerPubkey` | `(iss) => Promise<string \| null>` | ✓ | Resolves an issuer's pubkey. Yours to harden — see [Security](#security). |
| `nonceStore` | `NonceStore` | — | Replay protection. **Replace in production.** |
| `ttlSec` | `number` | — | Request lifetime. Default 120s, max 300s. |

**Result shape:**

```ts
| { ok: true; transport: TransportKind; result: VerifyRpResponseResult; response: RpVerifyResponse }
| { ok: false; transport: TransportKind; reason: "declined";            error: string }
| { ok: false; transport: TransportKind; reason: "verification_failed"; error: string }
| { ok: false; transport: TransportKind; reason: "timeout" }
| { ok: false; transport: "redirect";    reason: "navigated"; request: RpVerifyRequest }
| { ok: false; reason: "no_transport_available"; tried: Array<{transport, reason}> }
```

### `consumeRedirectFragment(params): Promise<ConsumeRedirectResult | null>`

Parses `window.location.hash` for a wallet response, runs the verifier, returns the result. Returns `null` if no response is present (so it's safe to call on cold loads). Use after the `redirect` transport.

### `verifyRpVerifyResponse({ request, response, options, getIssuerPubkey, nonceStore })`

The full SPEC §9.9 verifier. Use this on your server. Throws `ProtocolError` (with a stable `code`) on any failure.

### `openVerifyPopup` *(v0.1, still supported)*

The original popup-only API. Equivalent to `requestAttestation` with a single popup transport. Keep using it if you don't need transport fallback. New code should prefer `requestAttestation`.

### `InMemoryNonceStore`

Development-only nonce store. **Replace in production** — it doesn't survive process restarts and isn't shared across instances.

```ts
class RedisNonceStore implements NonceStore {
  async hasSeen(jti: string) { return (await redis.exists(`nk:jti:${jti}`)) === 1; }
  async markSeen(jti: string, expiresAtSec: number) {
    const ttl = Math.max(1, expiresAtSec - Math.floor(Date.now() / 1000));
    await redis.set(`nk:jti:${jti}`, "1", "EX", ttl);
  }
}
```

### Lower-level exports

- `buildRpVerifyRequest(opts) → RpVerifyRequest`
- `encodeRpVerifyRequest(request) → string`
- `bytesToB64Url`, `b64UrlToBytes`, `canonicalJson`
- `ProtocolError` (with stable `.code`)
- All TypeScript types: `RpVerifyRequest`, `RpVerifyResponse`, `RpScope`, `Transport`, `TrustPolicy`, etc.

---

## Migration from v0.1

`openVerifyPopup` still works exactly as before — you don't have to migrate. If you do want the transport-fallback flexibility:

```ts
// v0.1
const r = await openVerifyPopup({
  walletUrl: "https://numkeys.com/wallet/verify",
  rpOrigin: location.origin,
  rpName: "Acme",
  scope: "anonymous",
  allowedIssuers: ["numkeys.com"],
  getIssuerPubkey,
});

// v0.2 equivalent
const r = await requestAttestation({
  rpOrigin: location.origin,
  rpName: "Acme",
  scope: "anonymous",
  transports: [{ kind: "popup", walletUrl: "https://numkeys.com/wallet/verify" }],
  trustPolicy: { allowedIssuers: ["numkeys.com"] },
  getIssuerPubkey,
});
```

Two changes: `walletUrl` moves into the popup transport entry, and `allowedIssuers` moves into `trustPolicy`. Now you can add more transports without changing anything else.

---

## Security

### Trust policy: which issuers do you accept?

The `allowedIssuers` list is your trust root. Adding an issuer is like adding a CA to your trust store — if their key leaks, anyone can mint fake users in your system. Default to one issuer (the one your users actually use). Add others only after evaluating:

- **Verification rigour.** SMS OTP minimum, ideally with anti-VoIP and anti-rotation checks.
- **`proxy_number` stability.** Same user → same proxy number, every time. Some issuers might rotate; that breaks your account-key model.
- **Key-rotation policy** and **incident-disclosure channel.**
- **You actually need their userbase.** Each issuer added is trust expanded.

Use **per-flow** allow-lists for high-stakes vs low-stakes operations:

```ts
const COMMENTS_ISSUERS    = ["numkeys.com", "verify.othercorp.com"];
const WITHDRAWAL_ISSUERS  = ["numkeys.com"]; // only audited
```

Never take the allow-list from user input. The SPEC explicitly notes that fetching the well-known doc at an attacker-controlled `iss` *and then* deciding to trust would turn your verifier into an SSRF gadget.

### `getIssuerPubkey` is your responsibility to harden

Your resolver MUST:

- **Validate TLS properly.** No self-signed certs.
- **Refuse private/loopback/link-local IPs** (`10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`, `192.168.0.0/16`, `::1`, etc.) — defense against DNS rebinding.
- **Cache aggressively** but cap the TTL (12-24h is fine).
- **Return `null` on failure** rather than throwing — that yields the cleaner `issuer_key_discovery_failed` error.

A hardened resolver sketch:

```ts
import dns from "node:dns/promises";
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, string>({ max: 100, ttl: 12 * 60 * 60_000 });

async function getIssuerPubkey(iss: string): Promise<string | null> {
  if (!ALLOWED_ISSUERS.has(iss)) return null;
  const cached = cache.get(iss); if (cached) return cached;

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

### `nonceStore` must be durable in production

`InMemoryNonceStore` is per-process. Replace with Redis or your database, otherwise an attacker can replay a response by routing the second attempt to a different instance.

### Re-verify on the server for high-stakes flows

See [Server-side verification](#server-side-verification-high-stakes-flows). Client-side verification is enough for a green checkmark; it is not enough for account creation or payments.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `no_transport_available` | All transports reported `unavailable`. Common when only `extension` is configured but no extension is installed. Add `popup` or `qr` as a fallback. |
| `popup` transport returns `unavailable` immediately | Browser blocked `window.open`. Make sure you call `requestAttestation` directly inside a click handler — not after an `await`, not inside `setTimeout`. |
| `extension` transport always falls through | No browser extension responding to the probe. Either user has none installed, or the extension's content script isn't running on your origin. |
| `qr` transport returns `unavailable` | `createSession` or `displayQr` threw. Check your server's session-creation endpoint and your QR rendering code. |
| `verification_failed: untrusted_issuer` | Wallet returned an attestation from an issuer not in `trustPolicy.allowedIssuers`. Either expand the list (after vetting) or refuse the request. |
| `verification_failed: issuer_key_discovery_failed` | Your `getIssuerPubkey` returned `null` or threw. Check it loads the well-known doc and parses `public_key`. |
| `verification_failed: nonce_already_used` | Same response submitted twice — usually a UX bug (form resubmit) or replay attempt. Show "verification expired, please try again". |
| `verification_failed: response_from_future` / `request_expired` | Clock drift between server and wallet/issuer. Bump `clockSkewSec` modestly (≤120) or fix NTP. |
| `declined: phone_mismatch` | User's verified phone doesn't match `candidatePhoneE164`. Tell them to re-enter or use a different wallet. |

---

## License

MIT
