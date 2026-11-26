# Referencia: cómo funciona Ghosty

Análisis de la app Ghosty (useghosty.com), que usamos como referencia para nuestra plataforma de contenido.
Se completa a medida que revisamos más secciones.

## Stack técnico

- **Frontend:** Next.js (App Router), alojado en Vercel.
- **Base de datos, archivos y login:** Supabase. Las fotos de perfil se guardan en Supabase Storage.
- **Créditos:** 500 por mes. Las acciones pesadas (scrapear, transcribir, revisar) consumen créditos.
- **Multi-cliente:** pensada para ghostwriters. Cada usuario maneja varios clientes y cada referente pertenece a un cliente.

## Menú

| Sección | Subtítulo | Qué hace |
|---|---|---|
| Content GPS | Descubrí qué funciona | Biblioteca de contenido propio y de la competencia |
| Mesa de Trabajo | Convertí ideas en contenido | Pendiente de revisar |
| Banco de ideas | — | Referencias guardadas desde Content GPS |
| Métricas | Medí tu impacto | Pendiente de revisar |
| ADN de marca | — | Perfil de marca del cliente (Gestionar) |

También existen, ocultas según el plan: Brain, Casos de Éxito, Auditoría de la IA, Onboarding de clientes, Clientes y Administración.

## Content GPS (revisado)

### Pestañas
- **Tu cuenta:** tus propios posts. Requiere conectar Instagram Business/Creator por la API oficial.
- **Competencia:** los referentes que seguís.

### Agregar referentes
- Campo "usuario o link del perfil".
- Cada referente tiene dos interruptores: **Contenido** (posts y reels) e **Historias**.
- Hay un límite de sincronizaciones (por ejemplo, "30 sincronizaciones disponibles").

**Datos que guarda de cada referente:** usuario de IG, ID de IG, nombre, foto, seguidores, contenido activado, historias activadas, última sincronización y hasta qué fecha se sincronizaron los posts.

### Vistas de la competencia
- **Grilla:** tarjetas por cuenta con el botón "Explorar contenido".
- **Feed viral:** lo mejor de todas las cuentas mezclado.
- **Historias:** las historias de los referentes.

### Biblioteca (filtros y orden)
- **Tipo:** Todos / Reels / Carruseles / Historias.
- **Solo ganadores:** muestra solo el contenido que superó el promedio de su cuenta.
- **Ordenar por:**
  - **Más outlier:** el multiplicador sobre el promedio de la cuenta. Es la métrica central.
  - Más recientes.
  - Más comentarios.
- **Vista:** Grilla, o **Tablero por categorías** (una columna por categoría).
- Botón **Sincronizar**.
- Usa "engagement normalizado": compara cada post contra el promedio de su propia cuenta, no en números absolutos.

## Pendiente de revisar
- "Explorar contenido" de un referente: qué datos muestra cada reel o carrusel (vistas, transcripción, hook, categoría).
- El detalle de un post al abrirlo.
- Feed viral e Historias.
- Banco de ideas, Mesa de Trabajo, Métricas y ADN de marca.

## Qué tomamos para nuestra app
- Referentes con interruptores de Contenido e Historias.
- La métrica outlier: vistas del post / promedio de la cuenta.
- "Solo ganadores" y orden por outlier.
- El tablero por categorías, que en nuestro caso son los **formatos de Reel** (Talking Head, Miro, Clip, etc.).
- Tres bases separadas: **Historias**, **Reels** (por formato) y **Carruseles**.
