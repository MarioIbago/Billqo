# Informe de verificacion de Billqo

Fecha: 2026-08-13

## Produccion

- URL: `https://billqo.vercel.app`.
- Ultimo despliegue: `dpl_cjHXJSjUJZttGYMbo5eoBowUb4J4` (`READY`, Production; `https://billqo-js3x4a6qv-cuantlys-projects.vercel.app`).
- `GET /api/health`: HTTP 200, JSON valido y `Cache-Control: private, no-store`.
- Rutas protegidas sin sesion (`/api/connection` y `/api/google/oauth/start`): HTTP 401 `AUTH_REQUIRED`.
- UI de produccion verificada en Chrome aislado: carga, muestra solo el boton de Google, no muestra campos de email/contrasena y no presenta errores de consola ni overlay de Vite.
- El popup de Firebase abre `billqo.firebaseapp.com/__/auth/handler` sin `redirect_uri_mismatch`; no se uso ni se conservo ninguna sesion personal durante esta prueba.
- `/app` sin sesion vuelve a `#/auth`. La pagina de privacidad muestra las secciones de datos recabados, datos no recabados, Google Sheet y borrado/desconexion.
- El bundle de produccion usa configuracion Firebase de `billqo`; no contiene la configuracion ni el proyecto Firebase anterior.

## Firebase y Google Cloud `billqo`

- Proyecto Firebase/GCP `billqo`: activo.
- Google Sign-In: habilitado en Firebase Authentication.
- Dominios autorizados: `localhost`, `127.0.0.1`, `billqo.firebaseapp.com`, `billqo.web.app` y `billqo.vercel.app`.
- APIs habilitadas: Google Drive, Google Sheets y Cloud Firestore.
- Firestore Native `(default)` creado en `nam5`.
- Reglas de Firestore publicadas: todo acceso directo del cliente queda denegado.
- Prueba real de Firebase Admin: escritura, lectura y eliminacion de un documento temporal de metadata completadas correctamente.
- Firestore nunca recibe movimientos, presupuestos, recurrencias ni metricas financieras; conserva solo metadata tecnica y tokens de refresh cifrados.

## Secretos y backend

- Las claves de Firebase Admin, secreto OAuth y clave AES-256-GCM se guardan solo como variables sensibles de Vercel y en `.env.local` ignorado localmente.
- El codigo fuente ya no contiene un fallback hardcodeado de Firebase: el cliente usa exclusivamente `VITE_FIREBASE_*`.
- `.gitignore` excluye `.env*`, exportaciones `client_secret_*.json`, cuentas de servicio Firebase y bundles de API generados.
- El bundle de API no contiene material de clave privada, correos de cuentas de servicio ni secreto OAuth.
- Headers de produccion confirmados: HSTS, `nosniff`, `DENY`, Referrer Policy, Permissions Policy y COOP. Las cabeceras de navegador se declaran tambien en `vercel.json` para la pagina estatica, no solo para la API.
- `.vercelignore` evita que archivos `.env`, exportaciones de credenciales, diagnosticos y material no ejecutable lleguen al upload de Vercel.
- `npm audit --omit=dev`: PASS, cero vulnerabilidades. `uuid` se fija en `11.1.1` mediante `overrides`; el uso transitivo compatible es `uuid.v4()`.
- Vercel Firewall: se dejo el borrador `Observe Billqo API burst rate` (mas de 120 solicitudes por minuto por IP en `/api`, accion `log`). No esta publicado ni bloquea a nadie; se debe revisar trafico real antes de convertirlo en limitacion activa.
- Se agrego limpieza en backend para estados OAuth y operaciones vencidas. La politica TTL administrada de Firestore no se activo porque Google exige facturacion habilitada; no se habilito facturacion.

## Checks locales

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: PASS (5 archivos, 16 pruebas).
- `npm run vercel-build`: PASS.
- Servidor local: `http://127.0.0.1:3001` activo y verificado.
- Landing y `#/auth` renderizan correctamente, sin errores de consola; la pantalla de acceso solo ofrece Google.
- Revision de datos: no hay movimientos, presupuestos ni cifras financieras de demostracion en tiempo de ejecucion. El Sheet nuevo solo recibe encabezados, categorias iniciales y preferencias vacias.

## Bloqueo externo pendiente: OAuth de Google Sheets

El cliente OAuth web descargado desde `billqo` no trae URIs de redireccionamiento autorizados. Por eso Google responde `Error 400: redirect_uri_mismatch` antes de conceder Drive/Sheets.

En Google Auth Platform > Clients del proyecto `billqo`, agrega exactamente:

- `https://billqo.vercel.app/api/google/oauth/callback`
- `http://127.0.0.1:3001/api/google/oauth/callback`
- `http://localhost:3001/api/google/oauth/callback`

El backend ya exige que `GOOGLE_OAUTH_REDIRECT_URI` coincida con `APP_URL`, por lo que no volvera a enviar una URL distinta. Si el consentimiento OAuth esta en modo Testing, agrega como usuarios de prueba las cuentas que conectaran Sheets (por ejemplo, `cmjewelrymx@gmail.com`).

No se pudo guardar esos tres URIs desde esta sesion porque el puente de la consola de Google/Chrome falla a nivel local con `failed to write kernel assets ... os error 3`. No se afirma que el CRUD real contra Google Sheets haya terminado hasta que los URIs se guarden y se complete una autorizacion.
