"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { salir } from "@/app/acciones";

const ITEMS = [
  { href: "/", etiqueta: "Contenido", detalle: "Reels, carruseles e historias", icono: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/referentes", etiqueta: "Referentes", detalle: "Cuentas y formatos", icono: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8" },
  { href: "/ideas", etiqueta: "Banco de ideas", detalle: "Lo que guardaste", icono: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z" },
  { href: "/clientes", etiqueta: "Clientes", detalle: "De dónde vino cada uno", icono: "M3 12h4l3 8 4-16 3 8h4" },
  { href: "/negocios", etiqueta: "Negocios", detalle: "Tus cuentas y ManyChat", icono: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" },
  { href: "/metricas", etiqueta: "Métricas", detalle: "Tus cuentas y clientes", icono: "M18 20V10M12 20V4M6 20v-6" },
];

function activo(ruta: string, href: string) {
  if (href === "/") return ruta === "/" || ruta.startsWith("/historias") || ruta.startsWith("/p/");
  return ruta.startsWith(href);
}

export default function Navegacion() {
  const ruta = usePathname();
  return (
    <>
      {/* Escritorio */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-borde bg-fondo md:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#1a1d24" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="#c6f432" strokeWidth="2.5" />
            <circle cx="16" cy="16" r="3.5" fill="#c6f432" />
          </svg>
          <span className="font-semibold tracking-tight">Radar</span>
        </div>
        <nav aria-label="Secciones" className="flex flex-1 flex-col gap-1 p-3">
          {ITEMS.map((it) => {
            const on = activo(ruta, it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  on ? "bg-panel-2 text-texto ring-1 ring-borde" : "text-suave hover:bg-panel hover:text-texto"
                }`}
              >
                <Icono d={it.icono} on={on} />
                <span>
                  <span className="block font-medium">{it.etiqueta}</span>
                  <span className="block text-[11px] text-tenue">{it.detalle}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <form action={salir} className="border-t border-borde p-3">
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-suave hover:bg-panel hover:text-texto">Cerrar sesión</button>
        </form>
      </aside>

      {/* Celular */}
      <nav aria-label="Secciones" className="sticky top-0 z-30 flex gap-1 overflow-x-auto border-b border-borde bg-fondo/95 px-3 py-2 backdrop-blur md:hidden">
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${activo(ruta, it.href) ? "bg-panel-2 text-texto" : "text-suave"}`}
          >
            {it.etiqueta}
          </Link>
        ))}
      </nav>
    </>
  );
}

function Icono({ d, on }: { d: string; on: boolean }) {
  return (
    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${on ? "bg-acento/15 text-acento" : "bg-panel text-suave"}`}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </span>
  );
}
