
import React from 'react';
import {
  BarChart3,
  BookOpen,
  FileCode2,
  Layers,
  LogOut,
  Plus,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import type { UserProfile } from '../types';
import { auth } from '../lib/firebase';
import { CuantlyMark } from './CuantlyBrand';

type AppTab = 'dashboard' | 'registry' | 'insights' | 'budgets';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  user: UserProfile;
  onOpenAddModal: () => void;
  onOpenPromptModal: () => void;
  onOpenUserModal: () => void;
  onOpenCostGuide?: () => void;
  transactionCount: number;
}

const tabs: Array<{ id: AppTab; label: string; short: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'dashboard', label: 'Dashboard', short: 'Inicio', icon: BarChart3 },
  { id: 'registry', label: 'Movimientos', short: 'Movs.', icon: Wallet },
  { id: 'insights', label: 'Insights', short: 'Insights', icon: Sparkles },
  { id: 'budgets', label: 'Presupuestos', short: 'Presup.', icon: Layers },
];

const BILLQO_WORDMARK_STYLE: React.CSSProperties = {
  fontFamily:
    '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  fontWeight: 400,
  fontStyle: 'normal',
  letterSpacing: '-0.01em',
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  user,
  onOpenAddModal,
  onOpenPromptModal,
  onOpenUserModal,
  onOpenCostGuide,
  transactionCount,
}) => {
  return (
    <>
      <header className="crystal-header">
        <div className="crystal-header-inner">
          <button type="button" className="crystal-header-brand" onClick={() => setActiveTab('dashboard')}>
            <span className="crystal-header-mark"><CuantlyMark size={21} /></span>
            <span>
              <strong style={BILLQO_WORDMARK_STYLE}>Billqo</strong>
              <small>Black Crystal</small>
            </span>
          </button>

          <nav className="crystal-desktop-tabs" aria-label="Navegación principal">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={activeTab === id ? 'is-active' : ''}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={16} />
                <span>{label}</span>
                {id === 'registry' && <em>{transactionCount}</em>}
              </button>
            ))}
          </nav>

          <div className="crystal-header-actions">
            {onOpenCostGuide && (
              <button type="button" className="crystal-icon-button crystal-desktop-only" onClick={onOpenCostGuide} title="Guía de costos">
                <BookOpen size={17} />
              </button>
            )}
            <button type="button" className="crystal-icon-button crystal-desktop-only" onClick={onOpenPromptModal} title="Master Prompt">
              <FileCode2 size={17} />
            </button>
            <button type="button" className="crystal-add-button crystal-desktop-only" onClick={onOpenAddModal}>
              <Plus size={17} />
              Nuevo movimiento
            </button>
            <button type="button" className="crystal-user-button" onClick={onOpenUserModal} title={user.name}>
              {user.avatar ? <img src={user.avatar} alt="" /> : <User size={17} />}
              <span>{user.name.split(' ')[0]}</span>
            </button>
            <button type="button" className="crystal-icon-button crystal-desktop-only" onClick={() => void signOut(auth)} title="Cerrar sesión">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <nav className="crystal-mobile-bottom-nav" aria-label="Navegación móvil">
        {tabs.slice(0, 2).map(({ id, short, icon: Icon }) => (
          <button key={id} type="button" className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)}>
            <Icon size={19} />
            <span>{short}</span>
          </button>
        ))}

        <button type="button" className="crystal-mobile-plus" onClick={onOpenAddModal} aria-label="Nuevo movimiento">
          <Plus size={26} />
        </button>

        {tabs.slice(2).map(({ id, short, icon: Icon }) => (
          <button key={id} type="button" className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)}>
            <Icon size={19} />
            <span>{short}</span>
          </button>
        ))}
      </nav>
    </>
  );
};
