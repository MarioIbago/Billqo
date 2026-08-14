const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf-8');

code = code.replace(
  `      if (errorMessage.includes('Cross-Origin-Opener-Policy') || errorMessage.includes('popup-blocked')) {
        setError('El navegador bloqueó la ventana de acceso. Por favor abre la aplicación en una nueva pestaña usando el botón en la esquina superior derecha.');
      } else {
        setError('No pudimos iniciar sesión o conectar Google Drive. Si el problema persiste, intenta abrir la app en una nueva pestaña (botón superior derecho).');
      }`,
  `      if (errorMessage.includes('unauthorized-domain')) {
        setError('El dominio actual no está autorizado en Firebase. Para usar la vista previa, necesitas agregar este dominio a Firebase Authentication > Settings > Authorized domains, o abrir la aplicación en una nueva pestaña.');
      } else if (errorMessage.includes('Cross-Origin-Opener-Policy') || errorMessage.includes('popup-blocked')) {
        setError('El navegador bloqueó la ventana de acceso. Por favor abre la aplicación en una nueva pestaña usando el botón en la esquina superior derecha.');
      } else {
        setError('No pudimos iniciar sesión o conectar Google Drive. Si el problema persiste, intenta abrir la app en una nueva pestaña (botón superior derecho).');
      }`
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
