import Link from "next/link";
import { listarCuentas } from "@/lib/metricas";
import { instagramConfigurado } from "@/lib/instagram";
import { fechaHora, numero } from "@/lib/formato";
import Encabezado, { Aviso } from "@/components/Encabezado";
import Invitar from "@/components/Invitar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Métricas · Radar de contenido" };

export default async function Metricas({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const { msg, error } = await searchParams;
  const configurado = instagramConfigurado();
  const cuentas = configurado ? await listarCuentas() : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Encabezado titulo="Métricas" bajada="Tus cuentas y las de tus clientes, con los datos oficiales de Instagram." />
      <Aviso msg={msg} error={error} />

      {!configurado ? (
        <div className="rounded-xl border border-ganador/40 bg-ganador/10 p-5 text-sm leading-relaxed">
          <p className="font-medium">Falta un paso de configuración</p>
          <p className="mt-1 text-suave">
            Para conectar cuentas hay que crear la app de Instagram en Meta (gratis) y cargar <code>INSTAGRAM_APP_ID</code> e{" "}
            <code>INSTAGRAM_APP_SECRET</code> en Vercel. Pedile a Claude la guía paso a paso.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-borde bg-panel p-4">
              <p className="font-medium">Conectar una cuenta</p>
              <p className="text-sm text-suave">Si tenés la sesión de Instagram abierta en este navegador (por ejemplo, la tuya).</p>
              <a href="/api/instagram/conectar" className="mt-auto flex h-10 items-center justify-center rounded-lg bg-acento text-sm font-semibold text-black hover:bg-acento-osc">
                Conectar con Instagram
              </a>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-borde bg-panel p-4">
              <p className="font-medium">Conectar la cuenta de un cliente</p>
              <p className="text-sm text-suave">Le mandás un link y la conecta él desde su celular. No te tiene que pasar la contraseña.</p>
              <div className="mt-auto">
                <Invitar />
              </div>
            </div>
          </div>

          {cuentas.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cuentas.map((c) => (
                <li key={c.id}>
                  <Link href={`/metricas/${c.id}`} className="flex items-center gap-3 rounded-xl border border-borde bg-panel p-4 transition hover:border-suave/40">
                    {c.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.foto_url} alt="" className="size-12 rounded-full object-cover" />
                    ) : (
                      <span className="grid size-12 place-items-center rounded-full bg-panel-2">{c.username[0]?.toUpperCase()}</span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">@{c.username}</span>
                      <span className="block text-xs text-suave">{numero(c.seguidores)} seguidores</span>
                      <span className={`block text-[11px] ${c.ultimo_error ? "text-peligro" : "text-tenue"}`}>
                        {c.ultimo_error ? "Hubo un error, abrí para ver" : `Actualizado ${fechaHora(c.ultima_sync)}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
