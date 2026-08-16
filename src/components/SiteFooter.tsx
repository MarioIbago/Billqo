import { ExternalLink, Github, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CuantlyBrand } from './CuantlyBrand';

const GITHUB_PROFILE_URL = 'https://github.com/MarioIbago';
const CONTACT_EMAIL = 'mario.ibago@gmail.com';
const LICENSE_URL = 'https://polyformproject.org/licenses/noncommercial/1.0.0';

export function SiteFooter() {
  const navigate = useNavigate();

  return (
    <footer className="billqo-site-footer">
      <button type="button" className="billqo-site-footer-brand" onClick={() => navigate('/')} aria-label="Ir al inicio de Billqo">
        <CuantlyBrand compact />
      </button>
      <div className="billqo-site-footer-links" aria-label="Enlaces de Billqo">
        <span>Creado por Mario Ibarra Gómez</span>
        <a href={GITHUB_PROFILE_URL} target="_blank" rel="noreferrer">GitHub <ExternalLink size={13} /></a>
        <a href={`mailto:${CONTACT_EMAIL}`}><Mail size={13} />{CONTACT_EMAIL}</a>
        <a href={LICENSE_URL} target="_blank" rel="noreferrer">Licencia no comercial <ExternalLink size={13} /></a>
        <button type="button" onClick={() => navigate('/privacy')}>Privacidad</button>
        <button type="button" onClick={() => navigate('/terms')}>Términos</button>
      </div>
      <a className="billqo-site-footer-github" href={GITHUB_PROFILE_URL} target="_blank" rel="noreferrer" aria-label="GitHub de MarioIbago">
        <Github size={18} />
      </a>
    </footer>
  );
}
