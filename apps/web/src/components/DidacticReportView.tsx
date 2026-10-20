import React, { useState } from 'react';
import type { DidacticReport, DidacticStep } from '@optisteel/core';

interface DidacticReportViewProps {
  report: DidacticReport;
}

export const DidacticReportView: React.FC<DidacticReportViewProps> = ({ report }) => {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>(() => {
    // Expand all steps by default for pedagogical clarity
    const initial: Record<number, boolean> = {};
    report.steps.forEach((s: DidacticStep) => {
      initial[s.stepNumber] = true;
    });
    return initial;
  });

  const toggleStep = (num: number) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [num]: !prev[num],
    }));
  };

  const toggleAll = (expand: boolean) => {
    const updated: Record<number, boolean> = {};
    report.steps.forEach((s: DidacticStep) => {
      updated[s.stepNumber] = expand;
    });
    setExpandedSteps(updated);
  };

  return (
    <div className="glass-panel didactic-report-panel" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
      {/* Header */}
      <div className="panel-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              className="diagram-badge"
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                fontWeight: 700,
              }}
            >
              {report.caseId} • Grado {report.degreeOfIndeterminacy}
            </span>
            <span
              className="diagram-badge"
              style={{
                backgroundColor: 'rgba(192, 132, 252, 0.15)',
                color: '#c084fc',
                borderColor: 'rgba(192, 132, 252, 0.4)',
              }}
            >
              Método Analítico de Compatibilidad
            </span>
          </div>
          <h3 className="panel-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            {report.caseName}
          </h3>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Derivación paso a paso: formulación elástica de Euler-Bernoulli, ecuaciones de compatibilidad cinemática y equilibrio.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => toggleAll(true)}
            title="Expandir todos los pasos"
          >
            Expandir todo
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => toggleAll(false)}
            title="Colapsar todos los pasos"
          >
            Colapsar todo
          </button>
        </div>
      </div>

      {/* Overview Cards: Primary Structure & Compatibility */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.75rem',
          margin: '1rem 0',
          padding: '0.75rem',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Estructura Primaria
          </span>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
            {report.primaryStructure}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Incógnitas Redundantes
          </span>
          <div style={{ fontWeight: 600, color: '#f59e0b', marginTop: '0.15rem' }}>
            {report.redundantReactions.join(', ')}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Condición de Compatibilidad
          </span>
          <div style={{ fontWeight: 600, color: '#38bdf8', marginTop: '0.15rem' }}>
            {report.compatibilityConditions.join(' • ')}
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {report.steps.map((step: DidacticStep) => {
          const isExpanded = !!expandedSteps[step.stepNumber];
          return (
            <div
              key={step.stepNumber}
              className="didactic-step-card"
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.45)',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                borderRadius: '8px',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Step Header (Clickable Accordion) */}
              <div
                onClick={() => toggleStep(step.stepNumber)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  backgroundColor: isExpanded ? 'rgba(51, 65, 85, 0.3)' : 'transparent',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-color, #2563eb)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    {step.stepNumber}
                  </span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                      {step.title}
                    </strong>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {step.principle}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {step.check?.isVerified && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        borderRadius: '4px',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontWeight: 600,
                      }}
                    >
                      ✓ Verificado
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {/* Step Content */}
              {isExpanded && (
                <div style={{ padding: '0.85rem 1rem 1rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  {step.formulation && (
                    <div style={{ marginBottom: '0.6rem' }}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
                        Formulación Teórica:
                      </span>
                      <pre
                        style={{
                          margin: '0.25rem 0 0',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#0f172a',
                          borderRadius: '6px',
                          color: '#38bdf8',
                          fontSize: '0.82rem',
                          fontFamily: 'JetBrains Mono, monospace',
                          whiteSpace: 'pre-wrap',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                        }}
                      >
                        {step.formulation}
                      </pre>
                    </div>
                  )}

                  {step.substitution && (
                    <div style={{ marginBottom: '0.6rem' }}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
                        Sustitución con Parámetros del Modelo:
                      </span>
                      <pre
                        style={{
                          margin: '0.25rem 0 0',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#0f172a',
                          borderRadius: '6px',
                          color: '#e2e8f0',
                          fontSize: '0.82rem',
                          fontFamily: 'JetBrains Mono, monospace',
                          whiteSpace: 'pre-wrap',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                        }}
                      >
                        {step.substitution}
                      </pre>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f59e0b' }}>
                      Resultado: <span style={{ color: '#ffffff' }}>{step.result}</span>
                    </div>

                    {step.check && (
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: step.check.isVerified ? '#10b981' : '#f43f5e',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <span>{step.check.isVerified ? '✓' : '⚠'}</span>
                        <span>{step.check.description}</span>
                        {step.check.errorMargin !== undefined && (
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                            (tolerancia: {step.check.errorMargin.toExponential(2)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Conclusions Card */}
      {report.conclusions.length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.85rem 1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '8px',
          }}
        >
          <strong style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <span>✓</span> Conclusiones y Resumen Académico del Análisis:
          </strong>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#e2e8f0', fontSize: '0.84rem' }}>
            {report.conclusions.map((c: string, i: number) => (
              <li key={i} style={{ marginBottom: '0.2rem' }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
