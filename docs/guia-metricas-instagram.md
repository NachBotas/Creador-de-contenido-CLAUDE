# Guía: conectar cuentas de Instagram (Métricas)

La sección **Métricas** usa la API oficial de Instagram ("Instagram API con inicio de sesión de Instagram").
Nadie comparte contraseñas: cada cuenta autoriza desde la página oficial de Instagram.

## Requisitos
- Las cuentas tienen que ser **profesionales** (Empresa o Creador). Se cambia en Instagram → Configuración → Tipo de cuenta.
- Una cuenta de **desarrollador de Meta** (gratis) con tu Facebook: https://developers.facebook.com

## Paso 1 · Crear la app en Meta
1. Entrá a https://developers.facebook.com/apps y tocá **Crear app**.
2. Nombre: `Radar` (o el que quieras).
3. En **Casos de uso** elegí **Administrar mensajes y contenido en Instagram**.
4. Tipo de negocio: elegí tu portfolio o seguí sin uno. Tocá **Crear app**.

## Paso 2 · Configurar el inicio de sesión de Instagram
1. En el panel de la app: **Casos de uso → Instagram → Personalizar → Configuración de la API con inicio de sesión de Instagram**.
2. En **3. Configurar el inicio de sesión para empresas de Instagram** tocá **Configuración del inicio de sesión para empresas**.
3. En **URI de redireccionamiento de OAuth** pegá exactamente:
   `https://radar-contenido-amber.vercel.app/api/instagram/callback`
4. Guardá.
5. En esa misma pantalla, copiá el **Identificador de la app de Instagram** y el **Clave secreta de la app de Instagram**.
   Ojo: no son el "Identificador de la app" de Facebook que aparece arriba de todo.

## Paso 3 · Sumar las cuentas (vos, Nico, Alan…)
Mientras la app está en "modo desarrollo", solo se pueden conectar cuentas invitadas:
1. **Roles de la app → Roles → Agregar personas → Evaluador de Instagram** y escribí el @ de cada cuenta.
2. Cada dueño acepta la invitación desde Instagram (web): **Configuración → Apps y sitios web → Invitaciones de evaluador**,
   o entrando a https://www.instagram.com/accounts/manage_access/ → pestaña **Invitaciones de evaluador** → **Aceptar**.

Para conectar muchas cuentas sin invitarlas una por una, Meta pide pasar la "Revisión de la app" (se hace una vez).

## Paso 4 · Cargar los datos en Vercel
En https://vercel.com/kronos-1112/radar-contenido/settings/environment-variables agregá (Production, Sensitive):

| Key | Value |
|---|---|
| `INSTAGRAM_APP_ID` | Identificador de la app de Instagram |
| `INSTAGRAM_APP_SECRET` | Clave secreta de la app de Instagram |

Avisale a Claude para que vuelva a publicar la web.

## Paso 5 · Conectar
- **Tu cuenta:** Métricas → **Conectar con Instagram**.
- **Un cliente:** Métricas → **Invitar a un cliente** → le mandás el link (dura 7 días). Lo abre, inicia sesión en Instagram y queda conectado.

Las métricas se actualizan solas una vez por día (y con el botón **Actualizar ahora**).
Instagram no da el total de seguidores de días pasados: la curva de crecimiento se arma a partir del día en que conectás.

## ManyChat (pestaña Conversaciones)
1. En ManyChat: **Settings → API** → copiá el token.
2. En la web: Métricas → la cuenta → **Conversaciones** → pegá el token → **Conectar**.
3. Seguí las instrucciones de esa pantalla para agregar la **Solicitud externa** en cada flow (requiere ManyChat Pro).
   Empezá cada etiqueta con `reel-`, `historia-` o `carrusel-`.
