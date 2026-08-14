const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf-8');

code = code.replace(
  "setError('No pudimos iniciar sesión o conectar Google Drive. Revisa la ventana de autorización e inténtalo de nuevo.');",
  `
      const errorMessage = caught instanceof Error ? caught.message : 'Error desconocido';
      console.error(errorMessage);
      if (errorMessage.includes('Cross-Origin-Opener-Policy') || errorMessage.includes('popup-blocked')) {
        setError('El navegador bloqueó la ventana de acceso. Por favor abre la aplicación en una nueva pestaña usando el botón en la esquina superior derecha.');
      } else {
        setError('No pudimos iniciar sesión o conectar Google Drive. Si el problema persiste, intenta abrir la app en una nueva pestaña (botón superior derecho).');
      }
  `
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
