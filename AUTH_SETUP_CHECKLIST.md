# Checklist de autenticacion y Google Sheets de Billqo

## Firebase Authentication

- [x] Firebase project `billqo` es el proyecto de identidad configurado mediante variables `VITE_FIREBASE_*`.
- [x] El proveedor Google esta habilitado en Firebase Authentication; Billqo permite acceso exclusivamente con Google.
- [x] Los dominios `127.0.0.1`, `localhost` y `billqo.vercel.app` estan autorizados en Firebase Authentication.
- [x] Firestore Native `(default)` existe en `nam5` y las reglas bloquean el acceso directo del cliente.
- [ ] `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` y `FIREBASE_ADMIN_DATABASE_ID` desplegados pertenecen a `billqo`.
- [x] El backend valida el ID token de Firebase y acepta unicamente sesiones `google.com`.

Firebase no es el origen de los movimientos. Las reglas de Firestore estan cerradas para clientes; Firebase Admin solo conserva metadatos tecnicos de la conexion OAuth.

## Proyecto Google Cloud dedicado

- Project ID y nombre visible: `billqo` / `Billqo`
- APIs habilitadas: `sheets.googleapis.com`, `drive.googleapis.com`, `firestore.googleapis.com`
- Cliente OAuth web separado para Drive/Sheets: el descargado desde Google Auth Platform dentro de `billqo`.
- Redirect URI local exacta: `http://127.0.0.1:3001/api/google/oauth/callback`
- Redirect URI alternativa local: `http://localhost:3001/api/google/oauth/callback`
- Redirect URI de produccion exacta: `https://billqo.vercel.app/api/google/oauth/callback`
- Los tres callbacks deben estar registrados en Google Auth Platform > Clients para evitar `redirect_uri_mismatch`.

La app solicita `openid`, `email`, `drive.file` y `spreadsheets`. El usuario concede el acceso a su propia cuenta; no hay que compartir el Sheet con Firebase ni con una cuenta de servicio.

## Variables del servidor

- [ ] `APP_URL` coincide con el host visible en el navegador.
- [ ] `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` y `GOOGLE_OAUTH_REDIRECT_URI` pertenecen al cliente web de `billqo` (no al cliente interno de Firebase).
- [ ] `GOOGLE_SHEET_TITLE=Billqo - Mis Finanzas`.
- [ ] `TOKEN_ENCRYPTION_KEY` es base64 de exactamente 32 bytes.
- [ ] `GOOGLE_SHEET_OWNER_KEY` es estable y no contiene el UID en texto visible.
- [ ] Ningun secreto se expone bajo `VITE_*` ni se guarda en localStorage.

## Flujo de aprobacion local

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`
5. `npm run dev`
6. Abrir `http://127.0.0.1:3001`.
7. Pulsar `Continuar con Google` y aceptar los permisos.
8. Confirmar que aparece el archivo `Billqo - Mis Finanzas` con `MOVIMIENTOS`, `CATEGORIAS`, `PRESUPUESTOS`, `RECURRENTES` y `CONFIGURACION`.
9. Crear, editar y archivar un movimiento; recargar y confirmar que los cambios vienen del Sheet.
10. Abrir `Configuracion > Abrir mi Sheet` y probar `Sincronizar ahora`.
11. Abrir `Privacidad`, revisar el alcance de datos y probar el flujo de desconexion sin borrar el archivo.
12. Solo con confirmacion explicita, probar `Borrar datos del Sheet` y verificar que se limpian movimientos, presupuestos y recurrentes.

## Recuperacion

- `GOOGLE_REAUTH_REQUIRED`: volver a conectar Google.
- `SHEET_NOT_FOUND`: la app ofrece crear un archivo nuevo; el archivo anterior no se borra automaticamente.
- `SHEET_SCHEMA_INVALID`: corregir las columnas indicadas antes de continuar.
- `CONFLICT`: sincronizar y volver a guardar para no sobreescribir cambios externos.
