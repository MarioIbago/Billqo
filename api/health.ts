export const config = {
  maxDuration: 10,
};

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export default function handler(_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) {
  res.status(200).json({
    status: 'ok',
    runtime: 'vercel-node',
    configuration: {
      appUrl: present('APP_URL'),
      googleOAuth: present('GOOGLE_OAUTH_CLIENT_ID') && present('GOOGLE_OAUTH_CLIENT_SECRET') && present('GOOGLE_OAUTH_REDIRECT_URI'),
      firebaseAdmin: present('FIREBASE_ADMIN_PROJECT_ID') && present('FIREBASE_ADMIN_CLIENT_EMAIL') && present('FIREBASE_ADMIN_PRIVATE_KEY'),
      tokenEncryption: present('TOKEN_ENCRYPTION_KEY'),
      openRouter: present('OPENROUTER_API_KEY'),
    },
    timestamp: new Date().toISOString(),
  });
}
