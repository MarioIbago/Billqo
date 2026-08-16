# Billqo

Billqo es una aplicación de finanzas personales para registrar ingresos y gastos, controlar presupuestos, organizar tickets y dar seguimiento a facturas/CFDI. Firebase Authentication identifica a la persona y Google Sheets funciona como la fuente de verdad de la información financiera.

**Producción:** https://billqo.vercel.app  
**GitHub:** https://github.com/MarioIbago  
**Contacto:** mario.ibago@gmail.com

## Funciones principales

- Registro y edición de ingresos y gastos.
- Dashboard de balance, tendencias y categorías.
- Presupuestos y clasificación de gastos.
- Búsqueda y filtros de movimientos.
- Escaneo de tickets con IA y extracción asistida de datos.
- Organización de tickets pendientes, facturados o sin factura requerida.
- Importación y referencia de CFDI/XML.
- Google Sheets como almacenamiento financiero controlado por el usuario.
- Interfaz Black Crystal con glassmorphism y fondo React animado.

## Arquitectura de datos

- Firebase Authentication (proyecto `billqo`): inicio/cierre de sesión con Google y validación del ID token.
- Firestore de Firebase: solo metadatos técnicos de la conexión OAuth (ID del Sheet, estado, scopes, estados OAuth, idempotencia y refresh token cifrado). No contiene movimientos, categorías, presupuestos ni métricas financieras.
- Google Cloud `billqo`: proyecto dedicado con Google Sheets API, Google Drive API, Firebase Authentication y Cloud Firestore habilitados.
- OAuth de Google para Drive/Sheets: usa el cliente web configurado en `GOOGLE_OAUTH_CLIENT_ID`, con su secreto solo en el backend y callbacks exactos para cada entorno.
- Google Drive/Sheets: cada usuario autoriza el acceso a su cuenta y la app crea `Billqo - Mis Finanzas` en su Drive. El archivo pertenece al usuario; no se comparte con una service account.

El backend usa OAuth 2.0 Authorization Code + PKCE. El refresh token nunca llega al navegador ni se guarda en localStorage; se cifra con AES-256-GCM en el servidor. `drive.file` limita el acceso al archivo que Billqo crea o que el usuario autoriza para la app.

## Escáner de tickets con IA

El escáner usa OpenRouter desde el backend. La ruta de producción prioriza modelos multimodales estables y conserva fallback entre proveedores/modelos:

1. `google/gemini-2.5-flash-lite`
2. `google/gemini-2.5-flash`
3. `google/gemma-3-4b-it`

El parser normaliza pequeñas variaciones válidas del JSON del modelo (por ejemplo nombres de campos equivalentes, fechas comunes, montos formateados y etiquetas en español/inglés) antes de aplicar la validación final. Esto evita perder una lectura útil por diferencias de formato sin aceptar imágenes que no sean comprobantes financieros.

`openrouter/free` no se usa como fallback de producción por defecto porque su conjunto de modelos disponibles cambia. Para habilitarlo explícitamente en desarrollo o pruebas de bajo costo:

```env
OPENROUTER_RECEIPT_ALLOW_FREE=true
```

## Estructura del Sheet

Al crear el archivo se inicializan estas pestañas, sin movimientos de ejemplo:

- `MOVIMIENTOS`: filas con IDs estables, fechas, montos, categorías, metadatos de auditoría y borrado lógico.
- `CATEGORÍAS`: catálogo inicial de categorías, editable en el documento.
- `PRESUPUESTOS`: límites y periodos.
- `RECURRENTES`: estructura para cargos recurrentes.
- `CONFIGURACIÓN`: moneda, formato, zona horaria y versión de esquema.

Todas las altas, ediciones, eliminaciones, presupuestos, preferencias, gráficas e insights se calculan desde una lectura actual del Sheet.

## Privacidad y borrado

- `/privacy` explica en la interfaz qué datos recaba Billqo, qué no recaba y dónde se guardan.
- Eliminar un movimiento desde la lista lo archiva con `deleted_at` para mantener trazabilidad y dejar de contarlo en la app.
- `Borrar datos del Sheet` elimina físicamente movimientos, presupuestos y recurrentes del documento. Conserva categorías y configuración para no romper la estructura.
- `Desconectar Google` revoca el acceso y elimina la metadata técnica de Billqo, pero no elimina el archivo del Drive del usuario. El usuario puede borrar el archivo completo desde Google Drive.

## Desarrollo local

1. Copia `.env.example` a `.env.local` y completa las credenciales necesarias.
2. Conserva las credenciales solo en `.env.local`; ese archivo está excluido por `.gitignore`.
3. Ejecuta:

```bash
npm install
npm run dev
```

La aplicación queda en `http://127.0.0.1:3001`.

El cliente OAuth debe tener como redirect URI exacta:

```text
http://127.0.0.1:3001/api/google/oauth/callback
```

En Google Auth Platform registra los callbacks de producción y desarrollo que correspondan al entorno.

## Producción

Billqo está desplegado en Vercel: `https://billqo.vercel.app`.

- El build de Vercel ejecuta `npm run vercel-build` y genera una única función Express para `/api`.
- Las variables de Firebase Admin, OAuth, OpenRouter y cifrado viven en Vercel como variables sensibles de Production; nunca se incluyen en el bundle del navegador.
- En Production, `APP_URL` es `https://billqo.vercel.app` y el callback es `https://billqo.vercel.app/api/google/oauth/callback`.
- Firebase Authentication autoriza `billqo.vercel.app`, mantiene Google habilitado y tiene email/password deshabilitado.

## Verificación

```bash
npm run typecheck
npm test
npm run build
```

Para probar visualmente el flujo: landing → autenticación Firebase → autorizar Google Sheets → crear/abrir `Billqo - Mis Finanzas` → registrar movimiento → sincronizar. El acceso a `/app` sin sesión redirige a `/auth`.

## Archivos principales

- `src/lib/firebase.ts`: Firebase App y Authentication, sin Firestore en el cliente.
- `src/lib/api.ts`: cliente autenticado del backend `/api`.
- `src/Dashboard.tsx`: carga de conexión, onboarding y operaciones financieras.
- `src/components/CrystalWorkspace.tsx`: shell y vistas Black Crystal.
- `src/components/AddTransactionModal.tsx`: alta y edición de movimientos.
- `server/googleAuth.ts`: OAuth de Google, PKCE y refresh tokens.
- `server/connectionStore.ts`: metadatos técnicos cifrados, sin filas financieras.
- `server/sheets.ts` y `server/sheetsSchema.ts`: estructura, CRUD, sincronización y validación del Sheet.
- `server/receiptScannerV2.ts`: lectura resiliente de tickets con OpenRouter.
- `server/auth.ts`: verificación de ID tokens de Firebase y rechazo explícito de cualquier proveedor que no sea `google.com`.

Las escrituras directas de Firestore desde el navegador fueron eliminadas. Las reglas de Firestore bloquean el acceso de clientes; el backend usa Firebase Admin solo para identidad y metadatos técnicos.

## Autor y contacto

- GitHub: **MarioIbago** — https://github.com/MarioIbago
- Correo: **mario.ibago@gmail.com**

## Licencia

Billqo se distribuye bajo **PolyForm Noncommercial License 1.0.0**. Se permite usar, estudiar, modificar y redistribuir el software para fines permitidos por esa licencia, pero el uso comercial no está autorizado por sus términos.

Consulta [`LICENSE.md`](./LICENSE.md) para los términos completos. Para solicitar una licencia comercial o un permiso adicional, escribe a **mario.ibago@gmail.com**.
