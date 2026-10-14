import React from 'react';
import type { ActiveTab } from '../types/ui.js';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenConventions: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onOpenConventions }) => {
  return (
    <header className="app-header">
      <div className="header-top-row">
        <div className="brand-wrapper">
          <div className="brand-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 6h16M4 12h16M4 18h16" />
              <circle cx="8" cy="12" r="3" fill="#ffffff" />
              <circle cx="16" cy="12" r="3" fill="#ffffff" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <h1 className="brand-title">OptiSteel 2.0</h1>
              <span className="brand-badge">CORE v0.1</span>
            </div>
            <p className="brand-subtitle" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              Motor Científico de Análisis de Vigas Isostáticas
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenConventions}
            title="Ver convenciones de signos de fuerzas y momentos"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="btn-text-full">Convenciones de Signos</span>
            <span className="btn-text-short">Signos</span>
          </button>
        </div>
      </div>

      <nav className="nav-tabs" aria-label="Secciones principales">
        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'analyzer' ? 'active' : ''}`}
          onClick={() => onTabChange('analyzer')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span className={`nav-text-full ${activeTab === 'analyzer' ? 'active' : ''}`}>Analizador de Vigas</span>
          <span className="nav-text-short">Analizador</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'pytel-singer' ? 'active' : ''}`}
          onClick={() => onTabChange('pytel-singer')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span className={`nav-text-full ${activeTab === 'pytel-singer' ? 'active' : ''}`}>Casos Pytel-Singer (12)</span>
          <span className="nav-text-short">Casos Pytel (12)</span>
        </button>
      </nav>
    </header>
  );
};
