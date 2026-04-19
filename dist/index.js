import { z } from 'zod';
import { sha256 } from '@noble/hashes/sha2.js';
import * as ed from '@noble/ed25519';

// ../numkeys-protocol/src/index.ts
var NUMKEYS_PROTOCOL_VERSION = "1.2";
var WALLET_SDK_CONTRACT_VERSION = "wallet-sdk/v2";
var enc = new TextEncoder();
function bytesToB64Url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64UrlToBytes(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - s.length % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToHex(bytes) {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}
function normalizePhone(e164) {
  return e164.replace(/[^0-9]/g, "");
}
function phoneHash(e164) {
  const digits = normalizePhone(e164);
  const h = sha256(enc.encode(digits));
  return `sha256:${bytesToHex(h)}`;
}
function canonicalBindingString(p) {
  return `numkeys-binding|${p.iss}|${p.sub}|${p.phoneHash}|${p.userPubkey}|${p.nonce}|${p.iat}|${p.jti}`;
}
var AttestationClaimsSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  iat: z.number(),
  jti: z.string(),
  phone_hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  user_pubkey: z.string(),
  binding_proof: z.string().regex(/^sig:/),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  // `mode` is a Numkeys-specific claim added by orchestrators that need to
  // distinguish demo vs live attestations without parsing the iss domain.
  // Optional because the upstream Rust numkeys-node binary doesn't emit it
  // yet — verifiers should treat iss as the authoritative mode signal:
  // `numkeys.com` ⇒ live, `demo.numkeys.com` ⇒ demo.
  mode: z.enum(["demo", "live"]).optional()
});
function parseAttestation(jwt) {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new ProtocolError("invalid_attestation_format", "JWT must have 3 parts");
  }
  const [h, p, s] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64UrlToBytes(h)));
    payload = JSON.parse(new TextDecoder().decode(b64UrlToBytes(p)));
  } catch {
    throw new ProtocolError("invalid_attestation_format", "Invalid base64url JSON");
  }
  if (header.alg !== "EdDSA") {
    throw new ProtocolError("invalid_attestation_format", `Unsupported alg: ${header.alg}`);
  }
  const claims = AttestationClaimsSchema.parse(payload);
  const signature = b64UrlToBytes(s);
  const signingInput = enc.encode(`${h}.${p}`);
  return { raw: jwt, header, claims, signature, signingInput };
}
async function verifyAttestationSignature(parsed, issuerPubkeyB64Url) {
  const pub = b64UrlToBytes(issuerPubkeyB64Url);
  return ed.verifyAsync(parsed.signature, parsed.signingInput, pub);
}
async function verifyBindingProof(parsed, issuerPubkeyB64Url) {
  const c = parsed.claims;
  const sig = b64UrlToBytes(c.binding_proof.replace(/^sig:/, ""));
  const msg = enc.encode(
    canonicalBindingString({
      iss: c.iss,
      sub: c.sub,
      phoneHash: c.phone_hash,
      userPubkey: c.user_pubkey,
      nonce: c.nonce,
      iat: c.iat,
      jti: c.jti
    })
  );
  const pub = b64UrlToBytes(issuerPubkeyB64Url);
  return ed.verifyAsync(sig, msg, pub);
}
z.object({
  proxy_number: z.string(),
  service_id: z.string(),
  challenge_nonce: z.string().regex(/^[0-9a-f]{32}$/),
  verification_id: z.string(),
  expires_at: z.number(),
  callback_url: z.string().url().nullable().optional()
});
z.object({
  service_id: z.string(),
  challenge_nonce: z.string(),
  response_nonce: z.string(),
  verification_id: z.string(),
  timestamp: z.number()
});
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}
var ProtocolError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "ProtocolError";
  }
};
var IssuanceModeSchema = z.enum(["demo", "live"]);
var SessionStateSchema = z.enum([
  "pending",
  "phone_pending",
  "phone_verified",
  "payment_pending",
  "paid",
  // Transient claim state — set atomically when finalize() begins minting,
  // released to "finalized" on success or "failed" on error. Exists solely
  // so concurrent finalize requests can't double-issue.
  "issuing",
  "finalized",
  "failed",
  "expired"
]);
z.object({
  mode: IssuanceModeSchema,
  scope: z.string().regex(/^\d{1,4}$/, "scope must be 1-4 digit country code"),
  user_pubkey: z.string().min(1),
  phone_e164: z.string().regex(/^\+[1-9]\d{6,14}$/, "must be E.164")
});
z.object({
  code: z.string().min(4)
});
z.object({
  id: z.string().uuid(),
  state: SessionStateSchema,
  mode: IssuanceModeSchema,
  scope: z.string(),
  user_pubkey: z.string(),
  proxy_number: z.string().nullable(),
  attestation: z.string().nullable(),
  payment_required: z.boolean(),
  payment_status: z.string().nullable(),
  payment: z.object({
    // Vendor identifier intentionally omitted from the public view —
    // operators may swap providers without leaking the choice to the
    // wallet. The wallet only needs the rails it must render (BOLT11
    // and/or hosted checkout URL) and the price.
    amount_usd: z.string(),
    checkout_url: z.string().nullable(),
    lightning_invoice: z.string().nullable()
  }).nullable().optional(),
  error: z.string().nullable(),
  created_at: z.string()
});
z.object({
  issuer: z.string(),
  /** Allow-list of acceptable `iss` values served by this issuer key
   * (e.g. ["numkeys.com", "demo.numkeys.com"]). Optional for backward
   * compatibility; clients should fall back to [`issuer`]. */
  issuers: z.array(z.string()).optional(),
  public_key: z.string(),
  alg: z.literal("EdDSA")
});
z.object({
  /** The canonical issuer hostname this server is currently signing as. */
  issuer_domain: z.string(),
  /** Whether issuance requires a payment step (live mode only). */
  payments_enabled: z.boolean(),
  /** Whether the manual "I have paid" testing bypass is offered. */
  payment_bypass_available: z.boolean(),
  /** Whether live (real-SMS) issuance is available on this issuer. */
  live_mode_available: z.boolean(),
  /**
   * True when the configured phone verifier is the in-process demo
   * (no real SMS is sent). The wallet uses this to display a hint
   * if a user picks "live" against a demo-only deployment.
   */
  demo_phone_provider: z.boolean()
});
function randomNonce() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
var RpScopeSchema = z.enum(["anonymous", "phone"]);
var E164Regex = /^\+[1-9]\d{6,14}$/;
var NonceRegex = /^[0-9a-f]{32}$/;
var HttpsOriginRegex = /^https:\/\/[^\s/?#]+$/;
var RpVerifyRequestSchema = z.object({
  v: z.literal(WALLET_SDK_CONTRACT_VERSION),
  request_id: z.string().regex(NonceRegex),
  rp_origin: z.string().regex(HttpsOriginRegex, "rp_origin must be https origin"),
  rp_name: z.string().min(1).max(80),
  nonce: z.string().regex(NonceRegex),
  iat: z.number().int(),
  expires_at: z.number().int(),
  scope: RpScopeSchema,
  candidate_phone_e164: z.string().regex(E164Regex).nullable(),
  return_url: z.string().url().nullable()
}).refine((r) => r.expires_at - r.iat <= 300, {
  message: "expires_at - iat MUST be \u2264 300 seconds",
  path: ["expires_at"]
}).refine(
  (r) => r.scope === "phone" ? r.candidate_phone_e164 !== null : r.candidate_phone_e164 === null,
  { message: "candidate_phone_e164 presence MUST match scope", path: ["candidate_phone_e164"] }
);
var RpVerifyResponsePayloadSchema = z.object({
  v: z.literal(WALLET_SDK_CONTRACT_VERSION),
  request_id: z.string().regex(NonceRegex),
  rp_origin: z.string().regex(HttpsOriginRegex),
  nonce: z.string().regex(NonceRegex),
  attestation_jti: z.string().min(1),
  proxy_number: z.string().min(1),
  iat: z.number().int(),
  scope: RpScopeSchema,
  candidate_phone_match: z.boolean().nullable()
}).refine(
  (p) => p.scope === "phone" ? typeof p.candidate_phone_match === "boolean" : p.candidate_phone_match === null,
  { message: "candidate_phone_match shape MUST match scope", path: ["candidate_phone_match"] }
);
var RpVerifyResponseSchema = z.object({
  v: z.literal(WALLET_SDK_CONTRACT_VERSION),
  request_id: z.string().regex(NonceRegex),
  attestation: z.string().min(1),
  issuer: z.string().min(1),
  signed_response: z.object({
    payload: RpVerifyResponsePayloadSchema,
    signature: z.string().regex(/^sig:[A-Za-z0-9_-]+$/)
  })
});
var RpVerifyErrorResponseSchema = z.object({
  v: z.literal(WALLET_SDK_CONTRACT_VERSION),
  request_id: z.string().regex(NonceRegex),
  error: z.string()
});
function buildRpVerifyRequest(params) {
  const ttl = params.ttlSec ?? 120;
  if (ttl <= 0 || ttl > 300) {
    throw new ProtocolError("invalid_response_format", "ttlSec must be in (0, 300]");
  }
  const now = (params.now ?? (() => Math.floor(Date.now() / 1e3)))();
  const candidate = params.candidatePhoneE164 ?? null;
  const req = RpVerifyRequestSchema.parse({
    v: WALLET_SDK_CONTRACT_VERSION,
    request_id: randomNonce(),
    rp_origin: params.rpOrigin,
    rp_name: params.rpName,
    nonce: randomNonce(),
    iat: now,
    expires_at: now + ttl,
    scope: params.scope,
    candidate_phone_e164: params.scope === "phone" ? candidate : null,
    return_url: params.returnUrl ?? null
  });
  return req;
}
function encodeRpVerifyRequest(request) {
  return bytesToB64Url(enc.encode(canonicalJson(request)));
}
async function verifyRpVerifyResponse(args) {
  const { request, response, options, getIssuerPubkey, nonceStore } = args;
  const skew = options.clockSkewSec ?? 60;
  const now = (options.now ?? (() => Math.floor(Date.now() / 1e3)))();
  if (response.v !== WALLET_SDK_CONTRACT_VERSION) {
    throw new ProtocolError("version_mismatch", `response.v != ${WALLET_SDK_CONTRACT_VERSION}`);
  }
  if (response.request_id !== request.request_id) {
    throw new ProtocolError("request_id_mismatch", "response.request_id");
  }
  if (now > request.expires_at) {
    throw new ProtocolError("request_expired", "request.expires_at < now");
  }
  const payloadParsed = RpVerifyResponsePayloadSchema.safeParse(response.signed_response.payload);
  if (!payloadParsed.success) {
    throw new ProtocolError("invalid_response_format", payloadParsed.error.message);
  }
  const payload = payloadParsed.data;
  if (payload.v !== WALLET_SDK_CONTRACT_VERSION) {
    throw new ProtocolError("version_mismatch", "payload.v");
  }
  if (payload.request_id !== request.request_id) {
    throw new ProtocolError("request_id_mismatch", "payload.request_id");
  }
  if (payload.rp_origin !== request.rp_origin) {
    throw new ProtocolError("origin_mismatch", "payload.rp_origin");
  }
  if (payload.nonce !== request.nonce) {
    throw new ProtocolError("nonce_mismatch", "payload.nonce");
  }
  if (payload.iat > now + skew) {
    throw new ProtocolError("response_from_future", "payload.iat too far in future");
  }
  if (payload.iat < now - 300) {
    throw new ProtocolError("response_expired", "payload.iat too old");
  }
  if (payload.scope !== request.scope) {
    throw new ProtocolError("scope_mismatch", "payload.scope != request.scope");
  }
  const attestation = parseAttestation(response.attestation);
  if (!options.allowedIssuers.includes(attestation.claims.iss)) {
    throw new ProtocolError("issuer_not_allowed", attestation.claims.iss);
  }
  const issuerPubkey = await getIssuerPubkey(attestation.claims.iss);
  if (!issuerPubkey) {
    throw new ProtocolError("issuer_key_discovery_failed", attestation.claims.iss);
  }
  if (!await verifyAttestationSignature(attestation, issuerPubkey)) {
    throw new ProtocolError("invalid_attestation_signature", "attestation JWT signature");
  }
  if (!await verifyBindingProof(attestation, issuerPubkey)) {
    throw new ProtocolError("invalid_binding_proof", "binding_proof");
  }
  if (now - attestation.claims.iat > options.maxAttestationAgeSec) {
    throw new ProtocolError("attestation_expired", `attestation older than ${options.maxAttestationAgeSec}s`);
  }
  if (payload.attestation_jti !== attestation.claims.jti) {
    throw new ProtocolError("jti_mismatch", "payload.attestation_jti");
  }
  if (payload.proxy_number !== attestation.claims.sub) {
    throw new ProtocolError("proxy_number_mismatch", "payload.proxy_number");
  }
  const sigB64 = response.signed_response.signature.replace(/^sig:/, "");
  const sig = b64UrlToBytes(sigB64);
  const userPub = b64UrlToBytes(attestation.claims.user_pubkey);
  const msg = enc.encode(canonicalJson(payload));
  if (!await ed.verifyAsync(sig, msg, userPub)) {
    throw new ProtocolError("invalid_holder_signature", "ed25519 verify failed");
  }
  if (request.scope === "phone") {
    if (!request.candidate_phone_e164) {
      throw new ProtocolError("invalid_response_format", "request.candidate_phone_e164 missing");
    }
    const expectedHash = phoneHash(request.candidate_phone_e164);
    const actualMatch = expectedHash === attestation.claims.phone_hash;
    if (payload.candidate_phone_match !== actualMatch) {
      throw new ProtocolError("phone_match_lie", "wallet asserted incorrect candidate_phone_match");
    }
    if (!actualMatch) {
      throw new ProtocolError("phone_does_not_match", "candidate phone hash does not match attestation");
    }
  }
  if (await nonceStore.has(payload.nonce)) {
    throw new ProtocolError("nonce_replay", payload.nonce);
  }
  const ttlSec = Math.max(600, request.expires_at - now + 60);
  await nonceStore.mark(payload.nonce, ttlSec);
  return {
    proxyNumber: payload.proxy_number,
    issuer: attestation.claims.iss,
    attestationJti: attestation.claims.jti,
    phoneVerified: request.scope === "phone"
  };
}
var InMemoryNonceStore = class {
  seen = /* @__PURE__ */ new Map();
  has(nonce) {
    const exp = this.seen.get(nonce);
    if (exp === void 0) return false;
    if (exp < Math.floor(Date.now() / 1e3)) {
      this.seen.delete(nonce);
      return false;
    }
    return true;
  }
  mark(nonce, ttlSec) {
    this.seen.set(nonce, Math.floor(Date.now() / 1e3) + ttlSec);
  }
};

// src/index.ts
async function openVerifyPopup(params) {
  const w = params.windowRef ?? globalThis.window;
  if (!w) throw new Error("openVerifyPopup requires a browser window.");
  const request = buildRpVerifyRequest({
    rpOrigin: params.rpOrigin,
    rpName: params.rpName,
    scope: params.scope,
    candidatePhoneE164: params.candidatePhoneE164 ?? null,
    ttlSec: params.ttlSec
  });
  const encoded = encodeRpVerifyRequest(request);
  const url = new URL(params.walletUrl);
  url.searchParams.set("req", encoded);
  const popup = w.open(
    url.toString(),
    "numkeys-verify",
    params.popupFeatures ?? "popup,width=480,height=720"
  );
  if (!popup) return { ok: false, reason: "popup_blocked" };
  const walletOrigin = new URL(params.walletUrl).origin;
  const nonceStore = params.nonceStore ?? new InMemoryNonceStore();
  return new Promise((resolve) => {
    let settled = false;
    const settle = (r) => {
      if (settled) return;
      settled = true;
      w.removeEventListener("message", onMessage);
      clearInterval(closedPoll);
      clearTimeout(timer);
      resolve(r);
    };
    const onMessage = async (ev) => {
      if (ev.origin !== walletOrigin) return;
      const data = ev.data;
      if (data?.type !== "numkeys/verify-response") return;
      const okParse = RpVerifyResponseSchema.safeParse(data.response);
      const errParse = RpVerifyErrorResponseSchema.safeParse(data.response);
      if (errParse.success) {
        if (errParse.data.request_id !== request.request_id) return;
        settle({ ok: false, reason: "declined", error: errParse.data.error });
        return;
      }
      if (!okParse.success) {
        settle({
          ok: false,
          reason: "verification_failed",
          error: "Malformed message from wallet"
        });
        return;
      }
      if (okParse.data.request_id !== request.request_id) return;
      try {
        const result = await verifyRpVerifyResponse({
          request,
          response: okParse.data,
          options: {
            allowedIssuers: params.allowedIssuers,
            maxAttestationAgeSec: params.maxAttestationAgeSec ?? 60 * 60 * 24 * 365,
            clockSkewSec: params.clockSkewSec ?? 60
          },
          getIssuerPubkey: params.getIssuerPubkey,
          nonceStore
        });
        settle({ ok: true, result, response: okParse.data });
      } catch (e) {
        const msg = e instanceof ProtocolError ? `${e.code}: ${e.message}` : e.message;
        settle({ ok: false, reason: "verification_failed", error: msg });
      }
    };
    w.addEventListener("message", onMessage);
    const closedPoll = setInterval(() => {
      if (popup.closed) settle({ ok: false, reason: "popup_closed" });
    }, 500);
    const timer = setTimeout(
      () => {
        try {
          popup.close();
        } catch {
        }
        settle({ ok: false, reason: "timeout" });
      },
      params.timeoutMs ?? 5 * 60 * 1e3
    );
  });
}
async function consumeRedirectFragment(params) {
  const w = params.windowRef ?? globalThis.window;
  const hash = params.hash ?? w?.location.hash ?? "";
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed) return null;
  const usp = new URLSearchParams(trimmed);
  const encoded = usp.get("numkeys_response");
  if (!encoded) return null;
  if (w && (params.clearHash ?? true)) {
    try {
      const url = new URL(w.location.href);
      url.hash = "";
      w.history.replaceState(null, "", url.toString());
    } catch {
    }
  }
  let raw;
  try {
    raw = JSON.parse(new TextDecoder().decode(b64UrlToBytes(encoded)));
  } catch {
    return {
      ok: false,
      reason: "verification_failed",
      error: "fragment is not valid b64url canonical JSON"
    };
  }
  const okParse = RpVerifyResponseSchema.safeParse(raw);
  const errParse = RpVerifyErrorResponseSchema.safeParse(raw);
  if (errParse.success) {
    if (errParse.data.request_id !== params.request.request_id) {
      return {
        ok: false,
        reason: "verification_failed",
        error: "request_id mismatch on redirect fragment"
      };
    }
    return { ok: false, reason: "declined", error: errParse.data.error };
  }
  if (!okParse.success) {
    return {
      ok: false,
      reason: "verification_failed",
      error: okParse.error.message
    };
  }
  const nonceStore = params.nonceStore ?? new InMemoryNonceStore();
  try {
    const result = await verifyRpVerifyResponse({
      request: params.request,
      response: okParse.data,
      options: {
        allowedIssuers: params.allowedIssuers,
        maxAttestationAgeSec: params.maxAttestationAgeSec ?? 60 * 60 * 24 * 365,
        clockSkewSec: params.clockSkewSec ?? 60
      },
      getIssuerPubkey: params.getIssuerPubkey,
      nonceStore
    });
    return { ok: true, result, response: okParse.data };
  } catch (e) {
    const msg = e instanceof ProtocolError ? `${e.code}: ${e.message}` : e.message;
    return { ok: false, reason: "verification_failed", error: msg };
  }
}

export { InMemoryNonceStore, NUMKEYS_PROTOCOL_VERSION, ProtocolError, WALLET_SDK_CONTRACT_VERSION, b64UrlToBytes, buildRpVerifyRequest, bytesToB64Url, canonicalJson, consumeRedirectFragment, encodeRpVerifyRequest, openVerifyPopup, verifyRpVerifyResponse };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map