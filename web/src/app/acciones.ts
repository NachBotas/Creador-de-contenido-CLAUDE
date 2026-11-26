"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COOKIE_SESION, contrasenaCorrecta, crearTokenSesion, sesionValida } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { iniciarSincronizacion } from "@/lib/apify";

async function exigirSesion() {
  const c = await cookies();
  if (!(await sesionValida(c.get(COOKIE_SESION)?.value))) redirect("/login");
}

const volver = (ruta: string, msg: string, error = false) =>
  redirect(`${ruta}?${error ? "error" : "msg"}=${encodeURIComponent(msg)}`);

// ---------- Sesión ----------

export async function entrar(_: unknown, form: FormData): Promise<{ error: string } | undefined> {
  const intento = String(form.get("contrasena") ?? "");
  if (!(await contrasenaCorrecta(intento))) return { error: "Contraseña incorrecta." };
  const { token, vence } = await crearTokenSesion();
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: vence,
    path: "/",
  });
  redirect("/");
}

export async function salir() {
  (await cookies()).delete(COOKIE_SESION);
  redirect("/login");
}

// ---------- Referentes ----------

function limpiarUsuario(texto: string): string | null {
  const t = texto.trim();
  const deUrl = t.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const usuario = (deUrl ? deUrl[1] : t).replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(usuario) ? usuario : null;
}

export async function agregarReferente(form: FormData) {
  await exigirSesion();
  const usuario = limpiarUsuario(String(form.get("usuario") ?? ""));
  if (!usuario) volver("/referentes", "Ese usuario no es válido. Probá con @usuario o el link del perfil.", true);
  const { data, error } = await db()
    .from("referentes")
    .upsert({ ig_username: usuario }, { onConflict: "ig_username" })
    .select("id")
    .single();
  if (error) volver("/referentes", error.message, true);
  let msg = `@${usuario} agregado.`;
  try {
    msg += " " + (await iniciarSincronizacion(data!.id));
  } catch (e) {
    msg += ` No se pudo sincronizar todavía: ${(e as Error).message}`;
  }
  revalidatePath("/", "layout");
  volver("/referentes", msg);
}

export async function cambiarInterruptor(id: string, campo: "contenido_activo" | "historias_activo", valor: boolean) {
  await exigirSesion();
  await db().from("referentes").update({ [campo]: valor }).eq("id", id);
  revalidatePath("/referentes");
}

export async function eliminarReferente(id: string) {
  await exigirSesion();
  await db().from("referentes").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function sincronizar(form: FormData) {
  await exigirSesion();
  const id = String(form.get("id") ?? "") || undefined;
  try {
    volver("/referentes", await iniciarSincronizacion(id));
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    volver("/referentes", (e as Error).message, true);
  }
}

// ---------- Formatos ----------

export async function cambiarFormato(publicacionId: string, formatoId: number | null) {
  await exigirSesion();
  await db().from("publicaciones").update({ formato_id: formatoId }).eq("id", publicacionId);
  revalidatePath("/", "layout");
}

export async function agregarFormato(form: FormData) {
  await exigirSesion();
  const nombre = String(form.get("nombre") ?? "").trim().slice(0, 40);
  if (!nombre) volver("/referentes", "Escribí un nombre para el formato.", true);
  const { data: ultimo } = await db().from("formatos").select("orden").order("orden", { ascending: false }).limit(1);
  const orden = ((ultimo?.[0] as { orden: number } | undefined)?.orden ?? 0) + 1;
  const { error } = await db().from("formatos").insert({ nombre, orden });
  if (error) volver("/referentes", error.code === "23505" ? "Ese formato ya existe." : error.message, true);
  revalidatePath("/", "layout");
  volver("/referentes", `Formato "${nombre}" agregado.`);
}

export async function eliminarFormato(id: number) {
  await exigirSesion();
  await db().from("formatos").delete().eq("id", id);
  revalidatePath("/", "layout");
}

// ---------- Banco de ideas ----------

export async function guardarIdea(publicacionId: string) {
  await exigirSesion();
  await db().from("ideas").upsert({ publicacion_id: publicacionId }, { onConflict: "publicacion_id" });
  revalidatePath("/", "layout");
}

export async function quitarIdea(publicacionId: string) {
  await exigirSesion();
  await db().from("ideas").delete().eq("publicacion_id", publicacionId);
  revalidatePath("/", "layout");
}

// ---------- Métricas (cuentas propias y de clientes) ----------

export async function crearLinkInvitacion(): Promise<string> {
  await exigirSesion();
  const { crearInvitacion } = await import("@/lib/auth");
  const { urlPublica } = await import("@/lib/apify");
  return `${urlPublica() ?? ""}/conectar?inv=${encodeURIComponent(await crearInvitacion(7))}`;
}

export async function actualizarCuenta(form: FormData) {
  await exigirSesion();
  const id = String(form.get("id") ?? "");
  const { sincronizarCuenta } = await import("@/lib/instagram");
  try {
    await sincronizarCuenta(id);
  } catch (e) {
    volver(`/metricas/${id}`, (e as Error).message, true);
  }
  revalidatePath("/metricas", "layout");
  volver(`/metricas/${id}`, "Datos actualizados.");
}

export async function desconectarCuenta(id: string) {
  await exigirSesion();
  await db().from("cuentas_ig").delete().eq("id", id);
  revalidatePath("/metricas", "layout");
  redirect("/metricas");
}

export async function conectarManychatAccion(form: FormData) {
  await exigirSesion();
  const cuenta = String(form.get("cuenta") ?? "");
  const token = String(form.get("token") ?? "").trim();
  const ruta = `/metricas/${cuenta}?tab=conversaciones`;
  if (token.length < 10) redirect(`${ruta}&error=${encodeURIComponent("Pegá el token completo de ManyChat.")}`);
  const { conectarManychat } = await import("@/lib/manychat");
  let nombre = "";
  try {
    nombre = await conectarManychat(token, cuenta || null);
  } catch (e) {
    redirect(`${ruta}&error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/metricas", "layout");
  redirect(`${ruta}&msg=${encodeURIComponent(`ManyChat conectado: ${nombre}. Verificá que sea la cuenta correcta.`)}`);
}

export async function desconectarManychat(form: FormData) {
  await exigirSesion();
  const id = String(form.get("id") ?? "");
  const cuenta = String(form.get("cuenta") ?? "");
  await db().from("manychat_conexiones").delete().eq("id", id);
  revalidatePath("/metricas", "layout");
  redirect(`/metricas/${cuenta}?tab=conversaciones`);
}
