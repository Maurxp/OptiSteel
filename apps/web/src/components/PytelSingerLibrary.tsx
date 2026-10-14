import React, { useState } from 'react';
import { PYTEL_SINGER_CASES, type PytelSingerCaseDefinition } from '@optisteel/core';
import type { BeamFormState, FormLoad, FormSupport } from '../types/ui.js';

interface PytelSingerLibraryProps {
  onLoadCase: (modelState: BeamFormState) => void;
}

export const PytelSingerLibrary: React.FC<PytelSingerLibraryProps> = ({ onLoadCase }) => {
  const [filterSupport, setFilterSupport] = useState<string>('all');

  const cases = Object.values(PYTEL_SINGER_CASES);

  const filteredCases = cases.filter((c) => {
    if (filterSupport === 'all') return true;
    return c.supportType === filterSupport;
  });

  const handleSelectCase = (c: PytelSingerCaseDefinition) => {
    // Generate realistic default parameters for loading into the analyzer
    const params: Record<string, number> = {
      L: 6.0,
      P: 30.0,
      a: 2.5,
      b: 3.5,
      w: 12.0,
      w0: 15.0,
      M: 20.0,
      M0: 25.0,
    };

    const model = c.createModel(params);

    const formState: BeamFormState = {
      length: model.length,
      materialName: 'Acero A36 (E = 200 GPa)',
      E: 200.0,
      sectionName: 'W10x30 (Iz = 7076 cm⁴)',
      Iz: 7076.0,
      supports: model.supports.map((s) => {
        const item: FormSupport = {
          id: s.id,
          type: s.type,
          x: s.x,
        };
        if (s.label) item.label = s.label;
        return item;
      }),
      loads: model.loads.map((l) => {
        if (l.type === 'point') {
          const item: FormLoad = { id: l.id, type: 'point', x: l.x, P: l.P };
          if (l.label) item.label = l.label;
          return item;
        } else if (l.type === 'distributed') {
          const item: FormLoad = {
            id: l.id,
            type: 'distributed',
            xStart: l.xStart,
            xEnd: l.xEnd,
            wStart: l.wStart,
            wEnd: l.wEnd,
          };
          if (l.label) item.label = l.label;
          return item;
        } else {
          const item: FormLoad = { id: l.id, type: 'moment', x: l.x, M: l.M };
          if (l.label) item.label = l.label;
          return item;
        }
      }),
    };

    onLoadCase(formState);
  };

  return (
    <div className="pytel-library">
      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Biblioteca Canónica de Deformaciones — Pytel & Singer (Tabla 6-2)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              Fuente primaria: "Resistencia de Materiales", 4.ª Edición (pp. 218–219). Fórmulas teóricas de referencia contrastadas independientemente.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${filterSupport === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterSupport('all')}
            >
              Todos (12)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterSupport === 'simply_supported' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterSupport('simply_supported')}
            >
              Simplemente Apoyadas
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterSupport === 'cantilever' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterSupport('cantilever')}
            >
              Voladizos
            </button>
          </div>
        </div>
      </div>

      <div className="pytel-grid">
        {filteredCases.map((c) => (
          <div key={c.caseNumber} className="pytel-card">
            <div>
              <div className="pytel-header">
                <span className="pytel-case-num">CASO {c.caseNumber} (Pág. {c.page})</span>
                <span
                  className="diagram-badge"
                  style={{
                    color:
                      c.verificationStatus === 'pedagogical_approximation'
                        ? '#f59e0b'
                        : '#10b981',
                  }}
                >
                  {c.verificationStatus === 'pedagogical_approximation'
                    ? 'Aproximación pedagógica'
                    : 'Verificado analíticamente'}
                </span>
              </div>

              <h3 className="pytel-title">{c.title}</h3>
              <p className="pytel-desc">{c.description}</p>

              <div className="pytel-formulas">
                <div><strong>Reacciones:</strong> {c.formulas.reactions}</div>
                <div><strong>Momento Máx:</strong> {c.formulas.maxMoment}</div>
                <div><strong>Deflexión Máx:</strong> {c.formulas.maxDeflection}</div>
                <div><strong>Posición Máx:</strong> {c.formulas.maxDeflectionLocation}</div>
                {c.formulas.centerDeflection && (
                  <div><strong>Deflexión Centro:</strong> {c.formulas.centerDeflection}</div>
                )}
              </div>

              {c.notes && (
                <div
                  style={{
                    fontSize: '0.74rem',
                    color: 'var(--text-dim)',
                    marginBottom: '0.85rem',
                    fontStyle: 'italic',
                    lineHeight: '1.4',
                  }}
                >
                  Nota técnica: {c.notes}
                </div>
              )}
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.8rem' }}
                onClick={() => handleSelectCase(c)}
              >
                ⚡ Cargar Caso en el Analizador
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
