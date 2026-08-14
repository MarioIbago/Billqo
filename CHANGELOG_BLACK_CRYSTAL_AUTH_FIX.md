# Black Crystal + Auth Fix — cambios aplicados

## UI / UX

- Black Crystal Glass aplicado como capa visual global.
- Fondo negro puro.
- Vidrio neutro gris/plata como acento por defecto.
- Morado/índigo/violeta neutralizado como color global; se conserva únicamente cuando forma parte de una visualización semántica/categórica.
- Tipografía con stack `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `SF Pro Display`, `Inter`, `Helvetica Neue`.
- Controles táctiles mínimo 44px.
- Inputs de 48–52px.
- Navegación inferior móvil con CTA central.
- Safe-area para iPhone.
- Modales como bottom sheet en móvil.
- Fallback si `backdrop-filter` no existe.
- `prefers-reduced-motion`.
- Paquete de referencia incluido dentro del proyecto.

## Firebase Authentication

- Eliminado el proyecto Firebase hardcodeado incorrecto.
- Configuración cliente desde `VITE_FIREBASE_*` con fallback al archivo incluido.
- Persistencia de sesión `browserLocalPersistence`.
- `getRedirectResult` procesado al cargar `/auth`.
- Sesión Firebase existente reutilizada al volver a `/auth`.
- `VITE_FIREBASE_AUTH_FLOW=auto|popup|redirect`.
- `auto` evita redirect cross-origin en Vercel por defecto.
- Popup bloqueado tiene mensaje accionable.
- Errores de API posteriores al login ya no se disfrazan como errores Firebase.
- Reintento único de Firebase ID token con `getIdToken(true)` ante 401.
- Mensaje específico si el cliente Firebase y Firebase Admin no validan la misma sesión.

## Google OAuth / Sheets

- Callback OAuth ahora termina autorización y aprovisiona el Sheet automáticamente.
- El dashboard reanuda aprovisionamiento si quedó `authorized` o `provisioning`.
- El estado de conexión se conserva antes de aprovisionar para evitar loaders infinitos.
- Estados `GOOGLE_REAUTH_REQUIRED` y `SHEET_NOT_FOUND` refrescan la conexión.
- Sigue usando OAuth web + PKCE + state de un solo uso.
- Refresh tokens permanecen cifrados en servidor.

## Persistencia / concurrencia

- Preferencias usan `preferences.updatedAt`.
- Presupuestos existentes usan su propio `updatedAt`.
- Eliminación de transacciones usa `transaction.updatedAt`.
- Nuevas transacciones usan un idempotency key único.
- Presupuestos identifican correctamente la categoría real antes de guardar.

## Componentes corregidos

- `AddTransactionModal` alineado con el contrato del Dashboard.
- `UserSessionModal` alineado con el contrato del Dashboard.
- `PromptViewerModal` recibe `isOpen`.
- `CostExplanationModal` recibe `isOpen`.
- `GoogleStorageOnboarding` acepta funciones async que devuelven datos.
- `UserProfile` se construye con el shape real esperado.
- Avatar tiene fallback cuando Google no entrega foto.

## Desarrollo / Vercel

- `server.ts` respeta `PORT`; fallback 3001.
- `api/index.ts` agregado porque `vercel.json` lo declara.
- `index.html` usa `viewport-fit=cover` y theme-color negro.
- `VITE_FIREBASE_MEASUREMENT_ID` y `VITE_FIREBASE_AUTH_FLOW` agregados a `.env.example`.
- `Dashboard.original.tsx` movido a `archive/` para que no participe en TypeScript.

## Validación realizada en este entorno

- Se hizo comprobación sintáctica con TypeScript sobre todos los archivos TS/TSX de implementación.
- Se hizo un type-check local del frontend con shims de dependencias externas para validar contratos entre los componentes del proyecto.
- El type-check local del frontend terminó sin errores.
- Se intentó `npm ci` varias veces. El registry de npm respondió intermitentemente con `EAI_AGAIN` y el proceso no pudo completar las dependencias en este entorno, por lo que el build real con las dependencias del lockfile debe repetirse en una máquina/red con acceso normal a npm antes del deploy.

## Revisión final adicional

- `server/firebaseAdmin.ts`: los fallos de inicialización de Firebase Admin ahora se reportan como `CONFIGURATION_ERROR` en lugar de confundirse con una sesión inválida.
- `server/auth.ts`: el servidor registra únicamente el código seguro del fallo de verificación y nunca el ID token; mantiene la restricción al proveedor `google.com`.
- `server/sheets.ts`: el gasto real de presupuestos puede empatar tanto por `categoryId` como por nombre de categoría para compatibilidad con filas antiguas.
- `VERIFICATION_REPORT.md`: documenta qué validaciones sí se ejecutaron y por qué el build completo quedó bloqueado por acceso al registro npm en este entorno.
