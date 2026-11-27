# Guía: conectar Google Drive (historias)

La app guarda cada historia capturada (video o imagen completa) en tu Google Drive, en
`Radar – Historias / @cuenta / AAAA-MM-DD`. La miniatura queda también en la app.
Permiso que se pide: **drive.file** (la app solo ve los archivos que ella misma crea).

## Paso 1 · Proyecto en Google Cloud (gratis)
1. Entrá a https://console.cloud.google.com con la cuenta de Google donde querés guardar las historias.
2. Arriba, en el selector de proyectos → **Proyecto nuevo** → nombre `Radar` → **Crear**. Seleccionalo.

## Paso 2 · Activar la API de Drive
1. https://console.cloud.google.com/apis/library/drive.googleapis.com → **Habilitar**.

## Paso 3 · Pantalla de consentimiento
1. **APIs y servicios → Pantalla de consentimiento de OAuth** (o "Google Auth Platform → Branding").
2. Nombre de la app: `Radar`. Email de asistencia: el tuyo. **Público: Externo**. Contacto: tu email. Guardar.
3. En **Público** (Audience) tocá **Publicar app** → Confirmar. Así el permiso no vence a los 7 días.
   (Con el permiso drive.file no hace falta verificación de Google; cuando conectes vas a ver un aviso de
   "app no verificada": tocá *Configuración avanzada → Ir a Radar*.)

## Paso 4 · Credenciales
1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. Tipo: **Aplicación web**. Nombre: `Radar web`.
3. **URI de redireccionamiento autorizados** → Agregar:
   `https://radar-contenido-amber.vercel.app/api/google/callback`
4. **Crear**. Copiá el **ID de cliente** y el **Secreto del cliente**.

## Paso 5 · Vercel
En https://vercel.com/kronos-1112/radar-contenido/settings/environment-variables agregá (Production, Sensitive):

| Key | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | ID de cliente |
| `GOOGLE_CLIENT_SECRET` | Secreto del cliente |

Avisale a Claude para que vuelva a publicar.

## Paso 6 · Conectar
En la web: **Referentes → Historias en Google Drive → Conectar Google Drive** → elegí tu cuenta → permitir.
Desde ahí, cada captura sube sus historias a Drive. Las pendientes se suben con "Subir pendientes ahora" o en el cron diario.
