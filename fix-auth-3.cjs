const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf-8');

code = code.replace(
  `      const errorMessage = caught instanceof Error ? caught.message : 'Error desconocido';
      console.error(errorMessage);
      if (errorMessage.includes('unauthorized-domain')) {
        setError('El dominio actual no está autorizado en Firebase. Para usar la vista previa, necesitas agregar este dominio a Firebase Authentication > Settings > Authorized domains, o abrir la aplicación en una nueva pestaña.');
      } else if (errorMessage.includes('Cross-Origin-Opener-Policy') || errorMessage.includes('popup-blocked')) {
        setError('El navegador bloqueó la ventana de acceso. Por favor abre la aplicación en una nueva pestaña usando el botón en la esquina superior derecha.');
      } else {
        setError('No pudimos iniciar sesión o conectar Google Drive. Si el problema persiste, intenta abrir la app en una nueva pestaña (botón superior derecho).');
      }`,
  `      const errorMessage = caught instanceof Error ? caught.message : 'Error desconocido';
      const errorCode = (caught as any).code || '';
      console.error(errorMessage, errorCode);
      if (errorCode === 'auth/unauthorized-domain' || errorMessage.includes('unauthorized-domain')) {
        setError('El dominio actual no está autorizado. Para poder iniciar sesión en la vista previa, abre la aplicación en una nueva pestaña haciendo clic en el icono superior derecho, o añade este dominio en la consola de Firebase.');
      } else if (errorCode === 'auth/popup-closed-by-user') {
        setError('Cerraste la ventana de inicio de sesión antes de terminar. Inténtalo de nuevo.');
      } else if (errorMessage.includes('Cross-Origin-Opener-Policy') || errorMessage.includes('popup-blocked')) {
        setError('El navegador bloqueó la ventana emergente. Por favor, abre la aplicación en una nueva pestaña usando el botón en la esquina superior derecha.');
      } else {
        setError('No pudimos iniciar sesión. Si el problema persiste, intenta abrir la app en una nueva pestaña (botón superior derecho). Detalle: ' + errorCode);
      }`
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
