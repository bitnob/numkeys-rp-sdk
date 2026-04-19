import { z } from 'zod';

declare const NUMKEYS_PROTOCOL_VERSION = "1.2";
/**
 * Identifies the wire contract between an embedding application (RP or
 * first-party site) and the wallet PWA. v2 adds the third-party RP
 * verification flow defined in SPEC.md §9. v1 (challenge/response with
 * `service_id` + `callback_url`) is deprecated but still parseable.
 */
declare const WALLET_SDK_CONTRACT_VERSION = "wallet-sdk/v2";
declare function bytesToB64Url(bytes: Uint8Array): string;
declare function b64UrlToBytes(s: string): Uint8Array;
/**
 * Deterministic JSON canonicalizer: keys sorted lexicographically, no whitespace.
 * Used for signing challenge responses.
 */
declare function canonicalJson(value: unknown): string;
type ProtocolErrorCode = "invalid_attestation_format" | "invalid_attestation_signature" | "invalid_binding_proof" | "issuer_key_discovery_failed" | "challenge_parse_failed" | "challenge_validation_failed" | "signing_failed" | "verification_failed" | "version_mismatch" | "request_expired" | "invalid_response_format" | "request_id_mismatch" | "origin_mismatch" | "nonce_mismatch" | "nonce_replay" | "response_expired" | "response_from_future" | "invalid_holder_signature" | "jti_mismatch" | "proxy_number_mismatch" | "scope_mismatch" | "phone_match_lie" | "phone_does_not_match" | "attestation_expired" | "issuer_not_allowed" | "user_declined";
declare class ProtocolError extends Error {
    code: ProtocolErrorCode;
    constructor(code: ProtocolErrorCode, message: string);
}
declare const RpScopeSchema: z.ZodEnum<["anonymous", "phone"]>;
type RpScope = z.infer<typeof RpScopeSchema>;
/** SPEC.md §9.3 — VerifyRequest wire schema (RP → Wallet). */
declare const RpVerifyRequestSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    v: z.ZodLiteral<"wallet-sdk/v2">;
    request_id: z.ZodString;
    rp_origin: z.ZodString;
    rp_name: z.ZodString;
    nonce: z.ZodString;
    iat: z.ZodNumber;
    expires_at: z.ZodNumber;
    scope: z.ZodEnum<["anonymous", "phone"]>;
    candidate_phone_e164: z.ZodNullable<z.ZodString>;
    return_url: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    nonce: string;
    iat: number;
    scope: "anonymous" | "phone";
    rp_name: string;
    expires_at: number;
    candidate_phone_e164: string | null;
    return_url: string | null;
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    nonce: string;
    iat: number;
    scope: "anonymous" | "phone";
    rp_name: string;
    expires_at: number;
    candidate_phone_e164: string | null;
    return_url: string | null;
}>, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    nonce: string;
    iat: number;
    scope: "anonymous" | "phone";
    rp_name: string;
    expires_at: number;
    candidate_phone_e164: string | null;
    return_url: string | null;
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    nonce: string;
    iat: number;
    scope: "anonymous" | "phone";
    rp_name: string;
    expires_at: number;
    candidate_phone_e164: string | null;
    return_url: string | null;
}>, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    nonce: string;
    iat: number;
    scope: "anonymous" | "phone";
    rp_name: string;
    expires_at: number;
    candidate_phone_e164: string | null;
    return_url: string | null;
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    rp_origin: string;
    nonce: string;
    iat: number;
    scope: "anonymous" | "phone";
    rp_name: string;
    expires_at: number;
    candidate_phone_e164: string | null;
    return_url: string | null;
}>;
type RpVerifyRequest = z.infer<typeof RpVerifyRequestSchema>;
/** SPEC.md §9.4 — successful VerifyResponse wire schema (Wallet → RP). */
declare const RpVerifyResponseSchema: z.ZodObject<{
    v: z.ZodLiteral<"wallet-sdk/v2">;
    request_id: z.ZodString;
    attestation: z.ZodString;
    issuer: z.ZodString;
    signed_response: z.ZodObject<{
        payload: z.ZodEffects<z.ZodObject<{
            v: z.ZodLiteral<"wallet-sdk/v2">;
            request_id: z.ZodString;
            rp_origin: z.ZodString;
            nonce: z.ZodString;
            attestation_jti: z.ZodString;
            proxy_number: z.ZodString;
            iat: z.ZodNumber;
            scope: z.ZodEnum<["anonymous", "phone"]>;
            candidate_phone_match: z.ZodNullable<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            attestation_jti: string;
            proxy_number: string;
            iat: number;
            scope: "anonymous" | "phone";
            candidate_phone_match: boolean | null;
        }, {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            attestation_jti: string;
            proxy_number: string;
            iat: number;
            scope: "anonymous" | "phone";
            candidate_phone_match: boolean | null;
        }>, {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            attestation_jti: string;
            proxy_number: string;
            iat: number;
            scope: "anonymous" | "phone";
            candidate_phone_match: boolean | null;
        }, {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            attestation_jti: string;
            proxy_number: string;
            iat: number;
            scope: "anonymous" | "phone";
            candidate_phone_match: boolean | null;
        }>;
        signature: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        payload: {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            attestation_jti: string;
            proxy_number: string;
            iat: number;
            scope: "anonymous" | "phone";
            candidate_phone_match: boolean | null;
        };
        signature: string;
    }, {
        payload: {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            attestation_jti: string;
            proxy_number: string;
            iat: number;
            scope: "anonymous" | "phone";
            candidate_phone_match: boolean | null;
        };
        signature: string;
    }>;
}, "strip", z.ZodTypeAny, {
    v: "wallet-sdk/v2";
    request_id: string;
    attestation: string;
    issuer: string;
    signed_response: {
        payload: {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            attestation_jti: string;
            proxy_number: string;
            iat: number;
            scope: "anonymous" | "phone";
            candidate_phone_match: boolean | null;
        };
        signature: string;
    };
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    attestation: string;
    issuer: string;
    signed_response: {
        payload: {
            v: "wallet-sdk/v2";
            request_id: string;
            rp_origin: string;
            nonce: string;
            attestation_jti: string;
            proxy_number: string;
            iat: number;
            scope: "anonymous" | "phone";
            candidate_phone_match: boolean | null;
        };
        signature: string;
    };
}>;
type RpVerifyResponse = z.infer<typeof RpVerifyResponseSchema>;
/** SPEC.md §9.4 — declined / error response. */
declare const RpVerifyErrorResponseSchema: z.ZodObject<{
    v: z.ZodLiteral<"wallet-sdk/v2">;
    request_id: z.ZodString;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    v: "wallet-sdk/v2";
    request_id: string;
    error: string;
}, {
    v: "wallet-sdk/v2";
    request_id: string;
    error: string;
}>;
type RpVerifyErrorResponse = z.infer<typeof RpVerifyErrorResponseSchema>;
interface BuildRpVerifyRequestParams {
    rpOrigin: string;
    rpName: string;
    scope: RpScope;
    candidatePhoneE164?: string | null;
    returnUrl?: string | null;
    /** Seconds until expiry. Default 120, MUST be ≤ 300 per SPEC.md §9.3. */
    ttlSec?: number;
    now?: () => number;
}
/**
 * RP-side helper that produces a syntactically valid VerifyRequest with a
 * fresh `request_id`, fresh `nonce`, and consistent timing fields. The
 * caller MUST persist the returned object until the response is verified
 * (the verifier needs `request_id`, `nonce`, `rp_origin`, `expires_at`,
 * and the original `scope` / `candidate_phone_e164` to enforce binding).
 */
declare function buildRpVerifyRequest(params: BuildRpVerifyRequestParams): RpVerifyRequest;
/**
 * Encode a VerifyRequest for the wallet popup URL `?req=` query parameter
 * (SPEC.md §9.5.1). The encoding is b64url(canonical_json(request)).
 */
declare function encodeRpVerifyRequest(request: RpVerifyRequest): string;
/**
 * Pluggable nonce store. The verifier consumes the nonce only after every
 * crypto check has passed (SPEC.md §9.9 Step 9), so an attacker who
 * submits invalid responses cannot burn legitimate nonces.
 */
interface NonceStore {
    /** Returns true iff the nonce has previously been marked. */
    has(nonce: string): Promise<boolean> | boolean;
    /** Mark `nonce` as consumed for at least `ttlSec` seconds. */
    mark(nonce: string, ttlSec: number): Promise<void> | void;
}
/**
 * Pluggable issuer-pubkey resolver. Implementations are responsible for:
 *  - HTTPS + valid TLS to `https://{iss}/.well-known/numkeys/issuer-pubkey.json`
 *  - SSRF protection: refuse to fetch hosts that resolve to private,
 *    loopback, link-local, or IPv6 unique-local addresses (SPEC.md §9.9
 *    Step 4 normative requirement).
 *  - Caching policy (SPEC.md §6: at least 1 hour, refresh on verify failure).
 *
 * Returning `null` indicates discovery failure and triggers
 * `issuer_key_discovery_failed`.
 */
type IssuerPubkeyResolver = (iss: string) => Promise<string | null>;
interface VerifyRpResponseOptions {
    /** Allow-list checked BEFORE any network fetch (SPEC.md §9.9 Step 3). */
    allowedIssuers: string[];
    /** Reject attestations older than this. */
    maxAttestationAgeSec: number;
    /** Tolerance for response.iat in the future (default 60). */
    clockSkewSec?: number;
    now?: () => number;
}
interface VerifyRpResponseResult {
    proxyNumber: string;
    issuer: string;
    attestationJti: string;
    phoneVerified: boolean;
}
/**
 * RP-side verifier. Implements SPEC.md §9.9 verbatim.
 *
 * Throws ProtocolError with the spec's error code on any failed check.
 * Returns the verified facts (proxy_number, issuer, jti, phoneVerified)
 * on success.
 */
declare function verifyRpVerifyResponse(args: {
    request: RpVerifyRequest;
    response: RpVerifyResponse;
    options: VerifyRpResponseOptions;
    getIssuerPubkey: IssuerPubkeyResolver;
    nonceStore: NonceStore;
}): Promise<VerifyRpResponseResult>;
/**
 * Convenience in-memory NonceStore. Suitable for development and tests;
 * production RPs SHOULD back this with a shared store (Redis, DB) so that
 * replay protection survives process restarts and works across replicas.
 */
declare class InMemoryNonceStore implements NonceStore {
    private readonly seen;
    has(nonce: string): boolean;
    mark(nonce: string, ttlSec: number): void;
}

/**
 * Transport implementations for `requestAttestation`.
 *
 * Each transport has the same job: get a signed VerifyResponse (or a
 * structured error response) back from a wallet. They differ only in HOW
 * they reach the wallet — popup window, browser extension, mobile deep
 * link, or QR-code-mediated cross-device flow.
 *
 * The dispatcher (request-attestation.ts) tries transports in order and
 * stops at the first one that produces a response (success OR a
 * deliberate user decline). Transports that can't even start — popup
 * blocked, no extension installed — return `{ kind: "unavailable" }` so
 * the dispatcher can fall through to the next one.
 *
 * NB: All transports share one strict invariant — the response they
 * yield is unverified. The dispatcher runs the SPEC §9.9 verifier on
 * whatever they hand back, regardless of transport.
 */

/**
 * A transport tells the SDK HOW to deliver the request to a wallet and
 * receive a response. The dispatcher walks an array of these in order.
 */
type Transport = PopupTransport | ExtensionTransport | RedirectTransport | QrTransport;
interface PopupTransport {
    kind: "popup";
    /**
     * The wallet's verify URL, e.g. "https://numkeys.com/wallet/verify".
     * In a wallet-discovery world this might come from user settings; the
     * SDK doesn't take a position on where you get it.
     */
    walletUrl: string;
    /** window.open features. Default `popup,width=480,height=720`. */
    popupFeatures?: string;
    /** Total wait before resolving with `timeout`. Default 5 minutes. */
    timeoutMs?: number;
}
interface ExtensionTransport {
    kind: "extension";
    /**
     * Probe budget — how long to wait for a `numkeys/sign-ack` from a
     * browser extension before declaring it `unavailable` and falling
     * through to the next transport. Default 200ms.
     */
    probeTimeoutMs?: number;
    /**
     * Total wait for the extension's actual response after it has acked.
     * Default 5 minutes (extensions may pop their own UI).
     */
    responseTimeoutMs?: number;
}
interface RedirectTransport {
    kind: "redirect";
    walletUrl: string;
    /** Where the wallet should send the user back to. MUST be on rpOrigin. */
    returnUrl: string;
    /**
     * Redirect transport's "response" arrives on a NEXT page load via
     * `consumeRedirectFragment`, not on the current page. When this
     * transport runs, it persists the request via this storage callback
     * and navigates the top-level window. The dispatcher then resolves
     * with a special `kind: "navigated"` outcome that the caller is
     * expected to handle by calling `consumeRedirectFragment` on the
     * return page. Most apps prefer popup or QR for this reason.
     */
    persistRequest?: (request: RpVerifyRequest) => void;
}
interface QrTransport {
    kind: "qr";
    /**
     * Called once when QR transport starts. Your server creates a
     * one-shot session and returns the URLs needed to coordinate.
     */
    createSession: () => Promise<QrSession>;
    /**
     * Called with the QR payload (a deep-link URL containing the encoded
     * request and session ID) so you can render it in your UI. Whatever
     * you return is invoked when the transport finishes (success, error,
     * timeout) so you can dismiss the QR modal.
     */
    displayQr: (qrPayload: string) => Promise<void> | void;
    /** Called on settle — for cleaning up the QR UI. */
    dismissQr?: () => void;
    /** How often to poll the session for a response. Default 1500ms. */
    pollIntervalMs?: number;
    /** Total wait before timing out. Default 5 minutes. */
    timeoutMs?: number;
}
/**
 * Server-provided rendezvous URLs for QR transport. The wallet POSTs
 * the response to `signResponseUrl`; the browser polls `pollUrl` for it.
 */
interface QrSession {
    /**
     * URL embedded in the QR code. Wallets dereference this to get the
     * encoded request (and to know where to POST their response).
     * Typically `https://your-rp.com/numkeys/sessions/<sid>`.
     */
    signRequestUrl: string;
    /** The browser polls this until a response arrives. */
    pollUrl: string;
}
/**
 * Result of running one transport.
 *
 *  - `got_response`  — wallet returned something (still unverified)
 *  - `unavailable`   — transport couldn't start (extension absent,
 *                      popup blocked, etc.); dispatcher tries next
 *  - `navigated`     — redirect transport handed off to top-level nav
 *  - `timeout`       — transport reached but no response in time
 */
type TransportOutcome = {
    kind: "got_response";
    response: RpVerifyResponse | RpVerifyErrorResponse;
} | {
    kind: "unavailable";
    reason: string;
} | {
    kind: "navigated";
} | {
    kind: "timeout";
};
interface TransportContext {
    request: RpVerifyRequest;
    rpOrigin: string;
    windowRef?: Window;
}

/**
 * `requestAttestation` — transport-agnostic entry point for RPs.
 *
 * This is the v0.2 headline API. It walks a list of `Transport`s in
 * order, hands the first response that arrives to the SPEC §9.9
 * verifier, and returns a single discriminated-union result.
 *
 * Compared to the v0.1 `openVerifyPopup`:
 *   - The RP doesn't pre-commit to ONE wallet URL — they describe a
 *     menu of ways to reach a wallet (extension, popup, QR, deep link)
 *     and the SDK picks the first one that works.
 *   - The trust check moves from "validate iss against allowedIssuers
 *     after a popup-only flow" to "validate iss against allowedIssuers
 *     against whatever transport returned the attestation". Same rule,
 *     uniformly applied.
 */

interface TrustPolicy {
    /**
     * Issuer `iss` values your application accepts attestations from.
     * **Checked AFTER the wallet returns a response and BEFORE any
     * issuer-pubkey network fetch** (SSRF defense).
     */
    allowedIssuers: string[];
    /** Reject attestations older than this. Default 365 days. */
    maxAttestationAgeSec?: number;
    /** Tolerance for response.iat in the future. Default 60s. */
    clockSkewSec?: number;
}
interface RequestAttestationParams {
    rpOrigin: string;
    rpName: string;
    scope: RpScope;
    /** REQUIRED if `scope === "phone"`. E.164 format. */
    candidatePhoneE164?: string;
    /** Request lifetime. Default 120s. Max 300s. */
    ttlSec?: number;
    /**
     * Transports tried in order. The dispatcher uses the first one that
     * yields a response. Transports that can't even start (popup blocked,
     * no extension installed) are skipped silently.
     *
     * Recommended order: extension → popup → qr (desktop), or
     * extension → deepLink → qr (mobile).
     */
    transports: Transport[];
    trustPolicy: TrustPolicy;
    getIssuerPubkey: IssuerPubkeyResolver;
    /** Defaults to a per-call InMemoryNonceStore. NOT safe in production. */
    nonceStore?: NonceStore;
    windowRef?: Window;
}
type RequestAttestationResult = {
    ok: true;
    transport: Transport["kind"];
    result: VerifyRpResponseResult;
    response: RpVerifyResponse;
} | {
    ok: false;
    reason: "declined";
    transport: Transport["kind"];
    error: string;
} | {
    ok: false;
    reason: "verification_failed";
    transport: Transport["kind"];
    error: string;
} | {
    ok: false;
    reason: "timeout";
    transport: Transport["kind"];
} | {
    ok: false;
    reason: "navigated";
    transport: "redirect";
    /**
     * The request that was sent, so the caller can persist it for
     * `consumeRedirectFragment` on the return page. (The redirect
     * transport may also receive a `persistRequest` callback and do
     * this for you.)
     */
    request: RpVerifyRequest;
} | {
    ok: false;
    reason: "no_transport_available";
    tried: Array<{
        transport: Transport["kind"];
        reason: string;
    }>;
};
/**
 * Build a request and dispatch it. **Never throws** — every outcome,
 * including invalid configuration, is encoded in the result union.
 */
declare function requestAttestation(params: RequestAttestationParams): Promise<RequestAttestationResult>;

/**
 * @numkeys/rp-sdk — Relying-Party SDK for Numkeys Protocol v1.2.
 *
 * This package wraps the Numkeys protocol primitives with one-call ergonomic
 * helpers for the two browser transports defined in SPEC.md §9.5:
 *
 *   - `openVerifyPopup`        — popup + postMessage round-trip
 *   - `consumeRedirectFragment` — parse the location.hash response on
 *                                  page load after a redirect-transport
 *                                  return.
 *
 * Both helpers run the full SPEC §9.9 verifier on the response before
 * returning, so a successful resolution is always a verified result.
 *
 * The SDK does not bundle any opinionated transport defaults that would
 * compromise SPEC compliance. In particular, RPs must always supply:
 *
 *   - `allowedIssuers`   — the issuer iss values you trust (SSRF defense
 *                           runs before any network fetch).
 *   - `getIssuerPubkey`  — your TLS+caching+SSRF-safe pubkey resolver.
 *   - `nonceStore`       — defaults to the protocol's `InMemoryNonceStore`
 *                           which is process-local and NOT safe for
 *                           multi-instance deployments.
 *
 * For server-side verification (e.g. Node express handler) call
 * `verifyRpVerifyResponse` directly — re-exported below — and pair it
 * with a Redis- or DB-backed `NonceStore`.
 */

interface OpenVerifyPopupParams {
    /**
     * The wallet's verify URL, e.g. "https://numkeys.com/wallet/verify".
     * The SDK appends `?req=<encoded>` itself.
     */
    walletUrl: string;
    /** RP origin shown to the user and bound into the signed response. */
    rpOrigin: string;
    /** Human-readable name shown prominently in the consent UI. */
    rpName: string;
    scope: RpScope;
    /** REQUIRED if `scope === "phone"`. E.164 format ("+15551234567"). */
    candidatePhoneE164?: string;
    /** Request lifetime in seconds (default 120, max 300). */
    ttlSec?: number;
    /** Issuer iss values your application trusts. SSRF allow-list. */
    allowedIssuers: string[];
    /**
     * Resolves an issuer's Ed25519 public key (b64url). Implementations
     * MUST do their own SSRF protection, TLS validation, and caching.
     * Returning null triggers `issuer_key_discovery_failed`.
     */
    getIssuerPubkey: IssuerPubkeyResolver;
    /** Defaults to a per-call InMemoryNonceStore. Not safe across instances. */
    nonceStore?: NonceStore;
    /** Reject attestations older than this. Default 365 days. */
    maxAttestationAgeSec?: number;
    /** Tolerance for response.iat in the future (default 60). */
    clockSkewSec?: number;
    /** window.open features. Default "popup,width=480,height=720". */
    popupFeatures?: string;
    /** Total timeout in ms before rejecting with "timeout". Default 5min. */
    timeoutMs?: number;
    /** Window object override (for tests). Defaults to `window`. */
    windowRef?: Window;
}
/** Result type for `openVerifyPopup` — popup-transport reasons included. */
type OpenVerifyPopupResult = {
    ok: true;
    result: VerifyRpResponseResult;
    response: RpVerifyResponse;
} | {
    ok: false;
    reason: "declined";
    error: string;
} | {
    ok: false;
    reason: "verification_failed";
    error: string;
} | {
    ok: false;
    reason: "timeout";
} | {
    ok: false;
    reason: "popup_blocked";
} | {
    ok: false;
    reason: "popup_closed";
};
/**
 * Result type for `consumeRedirectFragment` — strictly the reasons
 * reachable on a fragment-return page load. Excludes popup-only
 * conditions (popup_blocked / popup_closed / timeout) for typing clarity.
 */
type ConsumeRedirectResult = {
    ok: true;
    result: VerifyRpResponseResult;
    response: RpVerifyResponse;
} | {
    ok: false;
    reason: "declined";
    error: string;
} | {
    ok: false;
    reason: "verification_failed";
    error: string;
};
/**
 * Open the wallet popup, build a signed request, await the postMessage
 * response, run the full SPEC §9.9 verifier, and resolve with the result.
 *
 * The promise NEVER rejects with a thrown error in normal flow — every
 * failure is encoded into the discriminated union for explicit handling.
 */
declare function openVerifyPopup(params: OpenVerifyPopupParams): Promise<OpenVerifyPopupResult>;
interface ConsumeRedirectFragmentParams {
    /**
     * The original request that was sent to the wallet. The RP MUST persist
     * this between the outbound navigation and the inbound return — the
     * verifier needs `nonce`, `request_id`, `rp_origin`, etc. to bind.
     */
    request: RpVerifyRequest;
    allowedIssuers: string[];
    getIssuerPubkey: IssuerPubkeyResolver;
    nonceStore?: NonceStore;
    maxAttestationAgeSec?: number;
    clockSkewSec?: number;
    /** Defaults to `window.location.hash`. */
    hash?: string;
    /** If true, replace history entry to clear the fragment. Default true. */
    clearHash?: boolean;
    windowRef?: Window;
}
/**
 * Inspect `window.location.hash` for a `numkeys_response=...` fragment
 * left by the wallet's redirect transport (SPEC §9.5.2). Returns null if
 * no response is present (typical first-page-load), or the verified
 * result / failure information if one is.
 */
declare function consumeRedirectFragment(params: ConsumeRedirectFragmentParams): Promise<ConsumeRedirectResult | null>;

export { type ConsumeRedirectFragmentParams, type ConsumeRedirectResult, type ExtensionTransport, InMemoryNonceStore, type IssuerPubkeyResolver, NUMKEYS_PROTOCOL_VERSION, type NonceStore, type OpenVerifyPopupParams, type OpenVerifyPopupResult, type PopupTransport, ProtocolError, type QrSession, type QrTransport, type RedirectTransport, type RequestAttestationParams, type RequestAttestationResult, type RpScope, type RpVerifyErrorResponse, type RpVerifyRequest, type RpVerifyResponse, type Transport, type TransportContext, type TransportOutcome, type TrustPolicy, type VerifyRpResponseOptions, type VerifyRpResponseResult, WALLET_SDK_CONTRACT_VERSION, b64UrlToBytes, buildRpVerifyRequest, bytesToB64Url, canonicalJson, consumeRedirectFragment, encodeRpVerifyRequest, openVerifyPopup, requestAttestation, verifyRpVerifyResponse };
