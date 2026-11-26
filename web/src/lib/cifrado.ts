import "server-only";

// Cifra tokens de terceros (Instagram, ManyChat) antes de guardarlos en la base.
// La clave sale de SESSION_SECRET: si la cambiás, hay que volver a conectar las cuentas.

async function clave(): Promise<CryptoKey> {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) throw new Error("Falta SESSION_SECRET");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secreto}:tokens`));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function cifrar(texto: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await clave(), new TextEncoder().encode(texto));
  return Buffer.concat([Buffer.from(iv), Buffer.from(datos)]).toString("base64");
}

export async function descifrar(cifrado: string): Promise<string> {
  const bytes = Buffer.from(cifrado, "base64");
  const datos = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, await clave(), bytes.subarray(12));
  return new TextDecoder().decode(datos);
}
