"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COOKIE_SESION, contrasenaCorrecta, crearTokenSesion, sesionValida } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { completarPortadas, guardarSyncDiaria, iniciarSincronizacion, SYNC_PRIMERA_VEZ } from "@/lib/apify";

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
    msg += " " + (await iniciarSincronizacion({ ...SYNC_PRIMERA_VEZ, referenteIds: [data!.id] }));
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

function leerOpciones(form: FormData) {
  const num = (k: string, def: number) => {
    const v = Number(form.get(k));
    return Number.isFinite(v) && v >= 0 ? v : def;
  };
  return {
    feed: form.get("feed") === "1",
    historias: form.get("historias") === "1",
    dias: num("dias", 7),
    maximo: num("maximo", 8) || 8,
  };
}

export async function sincronizar(form: FormData) {
  await exigirSesion();
  const ids = form.getAll("ids").map(String).filter(Boolean);
  const destino = String(form.get("volver") ?? "") === "contenido" ? "/" : "/referentes";
  if (!ids.length) volver(destino, "Elegí al menos una cuenta.", true);
  try {
    volver(destino, await iniciarSincronizacion({ ...leerOpciones(form), referenteIds: ids }));
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    volver(destino, (e as Error).message, true);
  }
}

export async function importarSortFeedAccion(form: FormData) {
  await exigirSesion();
  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || !archivo.size) volver("/referentes", "Elegí el archivo que exportaste de Sort Feed.", true);
  const { importarSortFeed } = await import("@/lib/sortfeed");
  let msg = "";
  try {
    msg = await importarSortFeed(archivo as File);
  } catch (e) {
    volver("/referentes", (e as Error).message, true);
  }
  revalidatePath("/", "layout");
  volver("/referentes", msg);
}

export async function completarPortadasAccion() {
  await exigirSesion();
  try {
    volver("/referentes", await completarPortadas(60));
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    volver("/referentes", (e as Error).message, true);
  }
}

export async function guardarAjusteSync(form: FormData) {
  await exigirSesion();
  const opciones = leerOpciones(form);
  await guardarSyncDiaria(opciones);
  // Las casillas de cuentas del panel prenden o apagan los interruptores de cada referente.
  const { data } = await db().from("referentes").select("id");
  const todos = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const aplicar = async (campo: "historias_activo" | "contenido_activo", elegidos: string[]) => {
    const si = todos.filter((id) => elegidos.includes(id));
    const no = todos.filter((id) => !elegidos.includes(id));
    if (si.length) await db().from("referentes").update({ [campo]: true }).in("id", si);
    if (no.length) await db().from("referentes").update({ [campo]: false }).in("id", no);
  };
  if (opciones.historias) await aplicar("historias_activo", form.getAll("hist_ids").map(String));
  if (opciones.feed) await aplicar("contenido_activo", form.getAll("feed_ids").map(String));
  revalidatePath("/referentes");
  volver("/referentes", "Sincronización automática guardada.");
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

// ---------- Negocios (hasta 5) y ManyChat ----------

export async function crearNegocio(form: FormData) {
  await exigirSesion();
  const nombre = String(form.get("nombre") ?? "").trim().slice(0, 40);
  const ig = String(form.get("ig") ?? "").trim().replace(/^@/, "").slice(0, 30) || null;
  if (!nombre) volver("/negocios", "Poné un nombre para el negocio.", true);
  const { count } = await db().from("negocios").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= 5) volver("/negocios", "Ya tenés 5 negocios, que es el máximo.", true);
  const { error } = await db().from("negocios").insert({ nombre, ig_username: ig, orden: (count ?? 0) + 1 });
  if (error) volver("/negocios", error.message, true);
  revalidatePath("/", "layout");
  volver("/negocios", `Negocio "${nombre}" creado. Ahora conectá su ManyChat.`);
}

export async function editarNegocio(form: FormData) {
  await exigirSesion();
  const id = String(form.get("id") ?? "");
  const nombre = String(form.get("nombre") ?? "").trim().slice(0, 40);
  const ig = String(form.get("ig") ?? "").trim().replace(/^@/, "").slice(0, 30) || null;
  if (!nombre) volver("/negocios", "El nombre no puede quedar vacío.", true);
  await db().from("negocios").update({ nombre, ig_username: ig }).eq("id", id);
  revalidatePath("/", "layout");
  volver("/negocios", "Cambios guardados.");
}

export async function eliminarNegocio(id: string) {
  await exigirSesion();
  await db().from("negocios").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function conectarManychatNegocio(form: FormData) {
  await exigirSesion();
  const negocio = String(form.get("negocio") ?? "");
  const token = String(form.get("token") ?? "").trim();
  if (token.length < 10) volver("/negocios", "Pegá el token completo de ManyChat.", true);
  const { conectarManychat } = await import("@/lib/manychat");
  let nombre = "";
  try {
    nombre = await conectarManychat(token, negocio);
  } catch (e) {
    volver("/negocios", (e as Error).message, true);
  }
  revalidatePath("/", "layout");
  volver("/negocios", `ManyChat conectado: «${nombre}». Verificá que sea la cuenta correcta de ese negocio.`);
}

export async function desconectarManychatNegocio(form: FormData) {
  await exigirSesion();
  await db().from("manychat_conexiones").delete().eq("negocio_id", String(form.get("negocio") ?? ""));
  revalidatePath("/", "layout");
  volver("/negocios", "ManyChat desconectado.");
}

// ---------- Trazabilidad ----------

export async function abrirContacto(form: FormData) {
  await exigirSesion();
  const negocio = String(form.get("negocio") ?? "");
  const sub = String(form.get("subscriber") ?? "");
  const { guardarContacto } = await import("@/lib/manychat");
  let id = "";
  try {
    id = await guardarContacto(negocio, sub);
  } catch (e) {
    redirect(`/clientes?n=${negocio}&error=${encodeURIComponent((e as Error).message)}`);
  }
  redirect(`/clientes/${id}`);
}

export async function actualizarContacto(form: FormData) {
  await exigirSesion();
  const id = String(form.get("id") ?? "");
  const { data } = await db().from("contactos").select("negocio_id, subscriber_id").eq("id", id).single();
  const { guardarContacto } = await import("@/lib/manychat");
  try {
    await guardarContacto((data as { negocio_id: string }).negocio_id, (data as { subscriber_id: string }).subscriber_id);
  } catch (e) {
    redirect(`/clientes/${id}?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}?msg=${encodeURIComponent("Etiquetas actualizadas desde ManyChat.")}`);
}

export async function guardarCierre(form: FormData) {
  await exigirSesion();
  const id = String(form.get("id") ?? "");
  const cerrado = form.get("cerrado") === "1";
  const monto = Number(String(form.get("monto") ?? "").replace(/[^\d.,]/g, "").replace(",", "."));
  await db()
    .from("contactos")
    .update({
      cerrado,
      fecha_cierre: cerrado ? String(form.get("fecha") || new Date().toISOString().slice(0, 10)) : null,
      monto: cerrado && Number.isFinite(monto) && monto > 0 ? monto : null,
      nota: String(form.get("nota") ?? "").slice(0, 1000) || null,
    })
    .eq("id", id);
  revalidatePath("/clientes", "layout");
  redirect(`/clientes/${id}?msg=${encodeURIComponent(cerrado ? "Marcado como cliente." : "Guardado.")}`);
}

export async function eliminarContacto(id: string, negocio: string) {
  await exigirSesion();
  await db().from("contactos").delete().eq("id", id);
  revalidatePath("/clientes", "layout");
  redirect(`/clientes?n=${negocio}`);
}

// ---------- Google Drive (historias) ----------

export async function desconectarDriveAccion() {
  await exigirSesion();
  const { desconectarDrive } = await import("@/lib/drive");
  await desconectarDrive();
  revalidatePath("/referentes");
  volver("/referentes", "Google Drive desconectado. Los archivos ya subidos siguen en tu Drive.");
}

export async function subirDriveAhora() {
  await exigirSesion();
  const { subirHistoriasPendientes } = await import("@/lib/drive");
  let msg = "";
  try {
    msg = await subirHistoriasPendientes(50_000);
  } catch (e) {
    volver("/referentes", (e as Error).message, true);
  }
  revalidatePath("/", "layout");
  volver("/referentes", msg);
}
