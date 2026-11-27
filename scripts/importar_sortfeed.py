"""Convierte un export de Sort Feed (CSV) en SQL para cargarlo en la base.

Uso:  python3 scripts/importar_sortfeed.py <usuario_ig> <archivo.csv> > consulta.json
Acepta el CSV tal cual lo exporta Sort Feed (Profile, Reel|Post, Create Date, Views,
Outlier Score, Likes, Comments[, Caption]) o el formato corto codigo,fecha,vistas,likes,comentarios.

- Crea el referente si no existe.
- Inserta publicaciones nuevas y actualiza vistas/likes/comentarios de las existentes
  sin pisar portada, texto, formato ni transcripción.
"""
import csv
import json
import re
import sys


def sql_texto(v):
    return "null" if v in (None, "") else "'" + str(v).replace("'", "''") + "'"


def sql_num(v):
    v = (v or "").strip().replace(",", "")
    return v if re.fullmatch(r"\d+", v) else "null"


def filas(ruta):
    with open(ruta, newline="", encoding="utf-8") as f:
        lector = list(csv.reader(f))
    if lector and lector[0] and lector[0][0].strip().lower() == "profile":
        cab = [c.strip().lower() for c in lector[0]]
        idx = {c: i for i, c in enumerate(cab)}
        col_link = idx.get("reel", idx.get("post"))
        for r in lector[1:]:
            if not r:
                continue
            link = r[col_link]
            m = re.search(r"/(reel|p)/([A-Za-z0-9_-]+)", link)
            if not m:
                continue
            yield {
                "codigo": m.group(2),
                "tipo": "reel" if m.group(1) == "reel" or "reel" in cab else "imagen",
                "fecha": r[idx["create date"]] if "create date" in idx else "",
                "vistas": r[idx["views"]] if "views" in idx else "",
                "likes": r[idx["likes"]] if "likes" in idx else "",
                "comentarios": r[idx["comments"]] if "comments" in idx else "",
                "caption": r[idx["caption"]] if "caption" in idx else "",
            }
    else:
        for r in lector:
            if len(r) >= 5:
                yield {"codigo": r[0], "tipo": "reel", "fecha": r[1], "vistas": r[2], "likes": r[3], "comentarios": r[4], "caption": ""}


def main():
    usuario = sys.argv[1].lstrip("@").lower()
    valores = []
    for f in filas(sys.argv[2]):
        url = f"https://www.instagram.com/{'reel' if f['tipo'] == 'reel' else 'p'}/{f['codigo']}/"
        fecha = sql_texto(f["fecha"] + "T12:00:00Z") if f["fecha"] else "null"
        valores.append(
            f"({sql_texto(f['codigo'])}, {sql_texto(f['tipo'])}, {sql_texto(url)}, {fecha}::timestamptz, "
            f"{sql_num(f['vistas'])}::bigint, {sql_num(f['likes'])}::bigint, {sql_num(f['comentarios'])}::bigint, {sql_texto(f['caption'])})"
        )
    if not valores:
        sys.exit("No encontré filas en el CSV")
    consulta = f"""
insert into referentes (ig_username) values ({sql_texto(usuario)}) on conflict (ig_username) do nothing;
with ref as (select id from referentes where ig_username = {sql_texto(usuario)}),
datos (ig_id, tipo, url, fecha, vistas, likes, comentarios, caption) as (values {", ".join(valores)})
insert into publicaciones (referente_id, ig_id, tipo, url, fecha_publicacion, vistas, likes, comentarios, caption)
select ref.id, d.ig_id, d.tipo, d.url, d.fecha, d.vistas, d.likes, d.comentarios, d.caption from datos d, ref
on conflict (ig_id) do update set
  vistas = coalesce(excluded.vistas, publicaciones.vistas),
  likes = coalesce(excluded.likes, publicaciones.likes),
  comentarios = coalesce(excluded.comentarios, publicaciones.comentarios),
  fecha_publicacion = coalesce(publicaciones.fecha_publicacion, excluded.fecha_publicacion),
  caption = coalesce(publicaciones.caption, excluded.caption),
  updated_at = now();
update referentes set ultima_sync = now() where ig_username = {sql_texto(usuario)};
select count(*) filter (where miniatura_url is null) as sin_portada, count(*) as total
from publicaciones where referente_id = (select id from referentes where ig_username = {sql_texto(usuario)});
"""
    print(json.dumps({"query": consulta}))


if __name__ == "__main__":
    main()
