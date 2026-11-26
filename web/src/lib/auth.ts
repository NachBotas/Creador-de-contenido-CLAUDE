// Sesión simple con una sola contraseña. El cookie guarda "vencimiento.firma".
// Usa Web Crypto para funcionar tanto en el middleware (edge) como en el servidor.

export const COOKIE_SESION = "sesion";
const DURACION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

const encoder = new TextEncoder();

async function firmar(valor: string): Promise<string> {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto || secreto.length < 16) throw new Error("Falta SESSION_SECRET (mínimo 16 caracteres)");
  const clave = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign("HMAC", clave, encoder.encode(valor));
  return Array.from(new Uint8Array(firma), (b) => b.toString(16).padStart(2, "0")).join("");
}

function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function crearTokenSesion(): Promise<{ token: string; vence: Date }> {
  const vence = Date.now() + DURACION_MS;
  return { token: `${vence}.${await firmar(String(vence))}`, vence: new Date(vence) };
}

export async function sesionValida(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [vence, firma] = token.split(".");
  if (!vence || !firma || Number(vence) < Date.now()) return false;
  try {
    return igualSeguro(firma, await firmar(vence));
  } catch {
    return false;
  }
}

export async function contrasenaCorrecta(intento: string): Promise<boolean> {
  const real = process.env.APP_PASSWORD;
  if (!real) return false;
  // Comparamos las firmas para que el tiempo no dependa del contenido.
  return igualSeguro(await firmar(`pw:${intento}`), await firmar(`pw:${real}`));
}
