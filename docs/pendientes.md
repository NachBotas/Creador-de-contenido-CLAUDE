# Pendientes

## Métricas de Instagram (cuentas propias y de clientes)
- **Estado:** el código ya está publicado (sección Métricas). Falta la configuración en Meta.
- **Qué falta:** crear la app en developers.facebook.com, configurar el login de Instagram,
  invitar las cuentas como evaluadores y cargar `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` en Vercel.
- **Guía:** `docs/guia-metricas-instagram.md`.
- **Idea extra:** cuando esté conectado, contar comentarios con la palabra clave por post (no requiere ManyChat).
  Necesita además el permiso `instagram_business_manage_comments`.

## Trazabilidad de clientes con ManyChat
- **Estado:** primera versión publicada (secciones **Negocios** y **Clientes**). Falta probarla con un token real.
- **Detalle:** `docs/pendiente-manychat-trazabilidad.md`.
- **A futuro:** conectar la app de alumnos del socio (otro Vercel) para marcar los cierres solos,
  cruzando por @ de Instagram, email o teléfono.
