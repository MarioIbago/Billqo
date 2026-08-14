# Billqo Black Crystal

Aplicacion de finanzas personales con la interfaz Black Crystal. Firebase Authentication identifica a la persona; Google Sheets es la fuente de verdad de toda la informacion financiera.

## Arquitectura de datos

- Firebase Authentication (proyecto `billqo`): inicio/cierre de sesion con Google y validacion del ID token.
- Firestore de Firebase: solo metadatos tecnicos de la conexion OAuth (ID del Sheet, estado, scopes, estados OAuth, idempotencia y refresh token cifrado). No contiene movimientos, categorias, presupuestos ni metricas financieras.
- Google Cloud `billqo`: proyecto dedicado con Google Sheets API, Google Drive API, Firebase Authentication y Cloud Firestore habilitados.
- OAuth de Google para Drive/Sheets: usa el cliente web configurado en `GOOGLE_OAUTH_CLIENT_ID`, con su secreto solo en el backend y con callbacks exactos para el entorno. Las APIs de Sheets/Drive se habilitan en `billqo`.
- Google Drive/Sheets: cada usuario autoriza el acceso a su cuenta y la app crea `Billqo - Mis Finanzas` en su Drive. El archivo pertenece al usuario; no se comparte con una cuenta de Firebase ni con una service account.

El backend usa OAuth 2.0 Authorization Code + PKCE. El refresh token nunca llega al navegador ni se guarda en localStorage; se cifra con AES-256-GCM en el servidor. `drive.file` es el único permiso de datos: limita el acceso al archivo que Billqo crea o que el usuario autoriza para la app, y la API de Sheets admite ese mismo permiso para leer y actualizar sus pestañas.

## Estructura del Sheet

Al crear el archivo se inicializan estas pestañas, sin movimientos de ejemplo:

- `MOVIMIENTOS`: filas con IDs estables, fechas, montos, categorias, metadatos de auditoria y borrado logico.
- `CATEGORÍAS`: catalogo inicial de categorias, editable en el documento.
- `PRESUPUESTOS`: limites y periodos.
- `RECURRENTES`: estructura para cargos recurrentes.
- `CONFIGURACIÓN`: moneda, formato, zona horaria y version de esquema.

Todas las altas, ediciones, eliminaciones, presupuestos, preferencias, graficas e insights se calculan desde una lectura actual del Sheet.

## Privacidad y borrado

- `/privacy` explica en la interfaz qué datos recaba Billqo, qué no recaba y dónde se guardan.
- Eliminar un movimiento desde la lista lo archiva con `deleted_at` para mantener trazabilidad y dejar de contarlo en la app.
- `Borrar datos del Sheet` es una acción separada y explícita: elimina físicamente movimientos, presupuestos y recurrentes del documento. Conserva solo categorías y configuración para no romper la estructura.
- `Desconectar Google` revoca el acceso y elimina la metadata técnica de Billqo, pero no elimina el archivo del Drive del usuario. El usuario puede borrar el archivo completo desde Google Drive.

## Desarrollo local

1. Copia `.env.example` a `.env.local` y completa el cliente OAuth web que tenga registrados los callbacks del entorno, su secreto, la URL de callback y una clave aleatoria base64 de 32 bytes.
2. Conserva las credenciales solo en `.env.local`; ese archivo esta excluido por `.gitignore`.
3. Ejecuta:

```powershell
npm install
npm run dev
```

La aplicacion queda en `http://127.0.0.1:3001`.

El cliente OAuth debe tener como redirect URI exacta:
`http://127.0.0.1:3001/api/google/oauth/callback`.

El cliente OAuth de Drive/Sheets pertenece al proyecto `billqo`. En Google Auth Platform > Clients registra exactamente `https://billqo.vercel.app/api/google/oauth/callback`, `http://127.0.0.1:3001/api/google/oauth/callback` y `http://localhost:3001/api/google/oauth/callback`. En pruebas, agrega como usuarios de prueba las cuentas que conectaran su Google Sheet.

## Produccion

Billqo esta desplegado en Vercel: `https://billqo.vercel.app`.

- El build de Vercel ejecuta `npm run vercel-build` y genera una unica funcion Express para `/api`.
- Las variables de Firebase Admin, OAuth y cifrado viven en Vercel como variables sensibles de Production; nunca se incluyen en el bundle del navegador.
- En Production, `APP_URL` es `https://billqo.vercel.app` y el callback es `https://billqo.vercel.app/api/google/oauth/callback`.
- Firebase Authentication autoriza `billqo.vercel.app`, mantiene Google habilitado y tiene email/password deshabilitado.

## Verificacion

```powershell
npm run typecheck
npm test
npm run build
```

Para probar visualmente el flujo: landing -> autenticacion Firebase -> autorizar Google Sheets -> crear/abrir `Billqo - Mis Finanzas` -> registrar movimiento -> sincronizar. El acceso a `/app` sin sesion redirige a `/auth`.

## Archivos principales

- `src/lib/firebase.ts`: Firebase App y Authentication, sin Firestore en el cliente.
- `src/lib/api.ts`: cliente autenticado del backend `/api`.
- `src/Dashboard.tsx`: carga de conexion, onboarding y operaciones financieras.
- `src/components/CrystalWorkspace.tsx`: shell y vistas Black Crystal.
- `src/components/AddTransactionModal.tsx`: alta y edicion de movimientos.
- `server/googleAuth.ts`: OAuth de Google, PKCE y refresh tokens.
- `server/connectionStore.ts`: metadatos tecnicos cifrados, sin filas financieras.
- `server/sheets.ts` y `server/sheetsSchema.ts`: estructura, CRUD, sincronizacion y validacion del Sheet.
- `server/auth.ts`: verificacion de ID tokens de Firebase y rechazo explicito de cualquier proveedor que no sea `google.com`.

Las escrituras directas de Firestore desde el navegador fueron eliminadas. Las reglas de Firestore bloquean el acceso de clientes; el backend usa Firebase Admin solo para identidad y metadatos tecnicos.
