const enc = new TextEncoder()
const dec = new TextDecoder()
const keyCache = new Map<string, CryptoKey>()

function toB64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromB64url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

async function deriveKey(password: string, usage: KeyUsage): Promise<CryptoKey> {
  const cacheKey = `${password}:${usage}`
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey)!

  const raw = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  )

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("fixed-salt"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  )

  keyCache.set(cacheKey, key)
  return key
}

async function deriveIV(plaintext: string): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(plaintext))
  return new Uint8Array(hash).slice(0, 12)
}

async function encrypt(plaintext: string, password: string): Promise<string> {
  const [key, iv] = await Promise.all([
    deriveKey(password, "encrypt"),
    deriveIV(plaintext),
  ])

  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    enc.encode(plaintext)
  )

  // Output = IV (12 bytes) || ciphertext || auth tag (16 bytes)
  const out = new Uint8Array(12 + cipherBuf.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(cipherBuf), 12)
  return toB64url(out.buffer)
}

export async function decrypt(ciphertext: string, password: string): Promise<string> {
  const data = fromB64url(ciphertext)
  const iv = data.slice(0, 12)
  const cipher = data.slice(12)

  const key = await deriveKey(password, "decrypt")

  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipher
    )
    return dec.decode(plainBuf)
  } catch {
    throw new Error("Decryption failed: password incorrecto o dato corrupto")
  }
}

function clearKeyCache(): void {
  keyCache.clear()
}

async function test() {
  // ─── Ejemplo de uso ───
  const password = "mi-password-secreto"
  const inputs = [
    "+54 9 11 1234-5678",
    "USR-00042",
    JSON.stringify({ id: 1, email: "x@x.com" }),
  ]

  for (const original of inputs) {
    const encrypted = await codec.encrypt(original, password)
    const decrypted = await codec.decrypt(encrypted, password)
    console.log(`Original  : ${original}`)
    console.log(`Encrypted : ${encrypted}  (${encrypted.length} chars)`)
    console.log(`Decrypted : ${decrypted}`)
    console.log(`Match     : ${original === decrypted}`)
    console.log("─".repeat(60))
  }


}

export const codec = {
  encrypt,
  decrypt,
  clearKeyCache
}