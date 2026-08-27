// Meta signs every webhook with an hmac of the raw request body and verifies the callback url with a
// challenge handshake. Both helpers are pure and isomorphic so the express layer can call them before
// handing anything to processRouter. Kept apart from router.ts so a future per tenant secret only touches
// this file.

// Subscription handshake: Meta calls the callback url once with these query params when it is saved.
// Returns the challenge to echo back, or null when the request is not a valid handshake.
export function verifyChallenge(query: Record<string, any>, verifyToken: string): string | null {

  if (!verifyToken) return null
  if (query?.["hub.mode"] !== "subscribe") return null
  if (query?.["hub.verify_token"] !== verifyToken) return null

  return String(query["hub.challenge"] || "") || null

}

// header is the x-hub-signature-256 value, "sha256=<hex>". rawBody must be the exact bytes received:
// a reparsed and re-stringified body changes key order and whitespace and never matches.
export async function verifySignature(rawBody: Uint8Array | string, header: string, appSecret: string): Promise<boolean> {

  if (!rawBody || !header || !appSecret) return false
  if (!header.startsWith("sha256=")) return false

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const body = typeof rawBody === "string" ? new TextEncoder().encode(rawBody) : new Uint8Array(rawBody)
  const signature = await crypto.subtle.sign("HMAC", key, body)
  return timingSafeEqual(toHex(new Uint8Array(signature)), header.slice(7))

}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")
}

// Bailing out on the first wrong character leaks how much of a forged signature was already correct.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
