/**
 * Minimal AWS SigV4 signer for Deno Edge Functions.
 *
 * Built for the small surface we actually need (Rekognition's
 * JSON/AWS-protocol endpoints), not as a general AWS client. If we
 * ever need DynamoDB, S3, or another service from Edge Functions,
 * factor this further or pull in `https://deno.land/x/aws_sign_v4`.
 *
 * Usage:
 *   const headers = await signAwsRequest({
 *     service: "rekognition",
 *     region: "us-east-1",
 *     method: "POST",
 *     url: "https://rekognition.us-east-1.amazonaws.com/",
 *     headers: { "X-Amz-Target": "RekognitionService.CreateFaceLivenessSession", "Content-Type": "application/x-amz-json-1.1" },
 *     body: '{}',
 *     accessKeyId: ..., secretAccessKey: ..., sessionToken?: ...,
 *   });
 *   const res = await fetch(url, { method, headers, body });
 *
 * Constraints:
 *   - Body must be a string (not a stream). Edge Function payloads are
 *     small (request → JSON → string is fine).
 *   - The Host header is computed from the URL automatically.
 *   - All other headers should be passed in; signer adds X-Amz-Date,
 *     X-Amz-Content-Sha256, Authorization, and (if present) X-Amz-Security-Token.
 */

const enc = new TextEncoder();

export interface SignParams {
  service: string;
  region: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data = typeof input === "string" ? enc.encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

async function hmacRaw(key: ArrayBuffer | Uint8Array, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    key instanceof Uint8Array ? key : new Uint8Array(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return new Uint8Array(sig);
}

async function hmacHex(key: ArrayBuffer | Uint8Array, msg: string): Promise<string> {
  return toHex(await hmacRaw(key, msg));
}

/**
 * Returns the headers (including the Authorization signature) the
 * caller should pass to `fetch`. The original input headers are
 * preserved verbatim; we add the SigV4-required ones.
 */
export async function signAwsRequest(p: SignParams): Promise<Record<string, string>> {
  const url = new URL(p.url);

  // Build the canonical request. SigV4 spec: METHOD\nCANONICAL_URI\nCANONICAL_QUERY\nCANONICAL_HEADERS\nSIGNED_HEADERS\nPAYLOAD_HASH
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]/g, "").replace(/\.\d{3}/, ""); // yyyymmddThhmmssZ
  const dateStamp = amzDate.slice(0, 8); // yyyymmdd
  const payloadHash = await sha256Hex(p.body || "");

  // Headers we'll sign — caller-provided + the SigV4 mandatory set.
  // Host is derived from the URL; X-Amz-Date is generated above.
  const headers: Record<string, string> = {
    ...p.headers,
    host: url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };
  if (p.sessionToken) {
    headers["x-amz-security-token"] = p.sessionToken;
  }

  // Canonicalize: lowercase keys, trim values, sort alphabetically.
  const sortedKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const canonicalHeaders = sortedKeys
    .map((k) => `${k}:${String(headers[Object.keys(headers).find((h) => h.toLowerCase() === k) as string]).trim()}\n`)
    .join("");
  const signedHeaders = sortedKeys.join(";");

  // Rekognition root path is "/" — canonical URI is the path with
  // no query string. Query string is empty for the JSON RPC style
  // endpoints we use.
  const canonicalUri = url.pathname || "/";
  const canonicalQueryString = url.search ? url.search.slice(1) : "";

  const canonicalRequest = [
    p.method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${p.region}/${p.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  // Derive the signing key. AWS-required chain:
  //   kDate    = HMAC("AWS4" + secret, dateStamp)
  //   kRegion  = HMAC(kDate, region)
  //   kService = HMAC(kRegion, service)
  //   kSigning = HMAC(kService, "aws4_request")
  const kDate    = await hmacRaw(enc.encode(`AWS4${p.secretAccessKey}`), dateStamp);
  const kRegion  = await hmacRaw(kDate, p.region);
  const kService = await hmacRaw(kRegion, p.service);
  const kSigning = await hmacRaw(kService, "aws4_request");
  const signature = await hmacHex(kSigning, stringToSign);

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${p.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Return only the headers the caller should pass to fetch. The
  // mixed-case header names from the caller's input are preserved
  // (fetch is case-insensitive), and we add the new ones with the
  // canonical AWS casing.
  return {
    ...p.headers,
    Host: url.host,
    "X-Amz-Date": amzDate,
    "X-Amz-Content-Sha256": payloadHash,
    ...(p.sessionToken ? { "X-Amz-Security-Token": p.sessionToken } : {}),
    Authorization: authHeader,
  };
}
