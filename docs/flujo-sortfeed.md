# Flujo de datos: Sort Feed + Apify

| Qué | Herramienta | Costo |
|---|---|---|
| Feed (reels y carruseles): vistas, likes, comentarios, outlier | **Sort Feed** (conector en Claude) | $0 — incluido en Sort Feed Pro |
| Transcripciones y hooks | **Sort Feed** (extensión: Select → Export + Transcripts) | $0 |
| Portada y texto de los ganadores importados | **Apify**, automático cada mañana (40 por día) o botón en Referentes | US$ 0,0027 c/u |
| Historias (automático diario) | **Apify** | ~US$ 2/mes con 5 cuentas (dentro del crédito gratis de US$ 5) |

## Cómo se trae el feed con Sort Feed
1. Chrome abierto, con la extensión de Sort Feed (cuenta Pro) e Instagram iniciado.
2. Pedirle a Claude, por ejemplo: "Traé con Sort Feed los reels del último mes de @usuario y cargalos en la app".
3. Claude ordena el perfil, exporta el CSV y lo carga con `scripts/importar_sortfeed.py`
   (crea el referente si no existe y no pisa portada, texto, formato ni transcripción).
4. A la mañana siguiente la app completa portada y texto de los ganadores (o tocás "Completar ahora" en Referentes).

Límites de Sort Feed MCP: 200 consultas a Instagram por hora, 1.000 por día, hasta 500 publicaciones por perfil.
El conector todavía no trae transcripciones: se exportan desde la extensión (hasta 25 por vez).
