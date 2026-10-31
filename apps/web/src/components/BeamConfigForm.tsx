import React from 'react';
import type { BeamFormState, FormLoad, FormSupport, FormLoadType } from '../types/ui.js';
import type { SupportType } from '@optisteel/core';
import { getPresetModels, getHyperstaticPresets } from '../adapters/beamAdapter.js';

interface BeamConfigFormProps {
  form: BeamFormState;
  onChange: (updated: BeamFormState) => void;
  onReset: () => void;
}

export const BeamConfigForm: React.FC<BeamConfigFormProps> = ({ form, onChange, onReset }) => {
  const presets = getPresetModels();
  const hyperPresets = getHyperstaticPresets();

  // Handlers for beam geometry & elasticity
  const handleLengthChange = (val: number) => {
    onChange({ ...form, length: val });
  };

  const handleEChange = (val: number) => {
    onChange({ ...form, E: val });
  };

  const handleIzChange = (val: number) => {
    onChange({ ...form, Iz: val });
  };

  const handleSectionTypeChange = (type: 'rectangular' | 'general') => {
    if (type === 'rectangular') {
      const b = form.widthMm && form.widthMm > 0 ? form.widthMm : 100;
      const h = form.heightMm && form.heightMm > 0 ? form.heightMm : 200;
      const iz = (b * h ** 3) / (12 * 10000);
      const wz = (b * h ** 2) / 6000;
      const area = (b * h) / 100;
      onChange({
        ...form,
        sectionType: 'rectangular',
        widthMm: b,
        heightMm: h,
        Iz: Number(iz.toFixed(1)),
        Wz: Number(wz.toFixed(1)),
        areaCm2: Number(area.toFixed(1)),
      });
    } else {
      onChange({
        ...form,
        sectionType: 'general',
      });
    }
  };

  const handleRectDimensionChange = (bVal?: number, hVal?: number) => {
    const b = bVal !== undefined ? bVal : form.widthMm ?? 100;
    const h = hVal !== undefined ? hVal : form.heightMm ?? 200;
    if (b > 0 && h > 0) {
      const iz = (b * h ** 3) / (12 * 10000);
      const wz = (b * h ** 2) / 6000;
      const area = (b * h) / 100;
      onChange({
        ...form,
        sectionType: 'rectangular',
        widthMm: b,
        heightMm: h,
        Iz: Number(iz.toFixed(1)),
        Wz: Number(wz.toFixed(1)),
        areaCm2: Number(area.toFixed(1)),
      });
    } else {
      onChange({ ...form, widthMm: b, heightMm: h });
    }
  };

  // Support handlers
  const handleAddSupport = () => {
    const nextId = `S${form.supports.length + 1}`;
    const newSupport: FormSupport = {
      id: nextId,
      type: 'roller',
      x: form.length,
      label: `Apoyo ${nextId}`,
    };
    onChange({ ...form, supports: [...form.supports, newSupport] });
  };

  const handleUpdateSupport = (idx: number, patch: Partial<FormSupport>) => {
    const updated = [...form.supports];
    updated[idx] = { ...updated[idx]!, ...patch };
    onChange({ ...form, supports: updated });
  };

  const handleRemoveSupport = (idx: number) => {
    const updated = form.supports.filter((_, i) => i !== idx);
    onChange({ ...form, supports: updated });
  };

  // Load handlers
  const handleAddLoad = (type: FormLoadType) => {
    const nextId = `C${form.loads.length + 1}`;
    let newLoad: FormLoad;

    if (type === 'point') {
      newLoad = {
        id: nextId,
        type: 'point',
        x: Number((form.length / 2).toFixed(2)),
        P: 20.0,
        label: `Puntual ${nextId}`,
      };
    } else if (type === 'distributed') {
      newLoad = {
        id: nextId,
        type: 'distributed',
        xStart: 0,
        xEnd: form.length,
        wStart: 10.0,
        wEnd: 10.0,
        label: `Distribuida ${nextId}`,
      };
    } else {
      newLoad = {
        id: nextId,
        type: 'moment',
        x: Number((form.length / 2).toFixed(2)),
        M: 15.0,
        label: `Momento ${nextId}`,
      };
    }

    onChange({ ...form, loads: [...form.loads, newLoad] });
  };

  const handleUpdateLoad = (idx: number, patch: Partial<FormLoad>) => {
    const updated = [...form.loads];
    updated[idx] = { ...updated[idx]!, ...patch };
    onChange({ ...form, loads: updated });
  };

  const handleRemoveLoad = (idx: number) => {
    const updated = form.loads.filter((_, i) => i !== idx);
    onChange({ ...form, loads: updated });
  };

  const handleLoadPreset = (presetIdx: number) => {
    const selected = presets[presetIdx];
    if (selected) {
      onChange(selected.state);
    }
  };

  return (
    <div className="glass-panel" style={{ height: 'fit-content' }}>
      <div className="panel-header">
        <h2 className="panel-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          Configuración de la Viga
        </h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReset} title="Restablecer viga">
          Limpiar
        </button>
      </div>

      {/* Quick Selection: Casos Hiperestáticos Canónicos H1–H4 */}
      <div className="form-section">
        <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '0.4rem' }}>
          <span>⚡ Casos Hiperestáticos Soportados (H1–H4)</span>
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.4rem',
            marginBottom: '0.5rem',
          }}
        >
          {hyperPresets.map((hp) => (
            <button
              key={hp.id}
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.78rem',
                padding: '0.45rem 0.5rem',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.15rem',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                backgroundColor: 'rgba(56, 189, 248, 0.06)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => onChange(hp.state)}
              title={hp.description}
            >
              <strong style={{ color: '#38bdf8' }}>{hp.id}</strong>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                {hp.id === 'H1' && 'Empotrada-Apoyada (P)'}
                {hp.id === 'H2' && 'Empotrada-Apoyada (w)'}
                {hp.id === 'H3' && 'Biempotrada (w)'}
                {hp.id === 'H4' && '2 Vanos Iguales (w)'}
              </span>
            </button>
          ))}
        </div>

        {/* Scope and requirements guide */}
        <div
          style={{
            padding: '0.5rem 0.7rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            border: '1px solid var(--border-color)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            lineHeight: 1.35,
          }}
        >
          <strong style={{ color: 'var(--text-main)' }}>Guía de Casos Hiperestáticos:</strong>
          <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1rem' }}>
            <li><strong>H1:</strong> Empotramiento + rodillo con cargas puntuales.</li>
            <li><strong>H2:</strong> Empotramiento + rodillo con carga distribuida.</li>
            <li><strong>H3:</strong> Dos empotramientos con carga uniforme o puntual.</li>
            <li><strong>H4:</strong> 3 apoyos simples, dos vanos iguales y carga uniforme continua.</li>
          </ul>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="form-section">
        <label className="form-label">
          <span>Otras Plantillas (Casos Isostáticos Pytel/Singer)</span>
        </label>
        <select
          className="form-select"
          onChange={(e) => {
            const idx = Number(e.target.value);
            if (!Number.isNaN(idx)) handleLoadPreset(idx);
          }}
          defaultValue=""
          aria-label="Seleccionar plantilla de viga"
        >
          <option value="" disabled>
            Cargar caso de referencia...
          </option>
          {presets.map((p, idx) => (
            <option key={idx} value={idx}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Geometry & Elasticity */}
      <div className="form-section">
        <div className="form-section-title">Geometría y Elasticidad</div>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label className="form-label" htmlFor="beam-length">
              <span>Longitud (L)</span>
              <span className="unit">m</span>
            </label>
            <input
              id="beam-length"
              type="number"
              min="0.1"
              step="0.1"
              className="form-input"
              value={form.length}
              onChange={(e) => handleLengthChange(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="beam-e">
              <span>Módulo E</span>
              <span className="unit">GPa</span>
            </label>
            <input
              id="beam-e"
              type="number"
              min="1"
              step="1"
              className="form-input"
              value={form.E}
              onChange={(e) => handleEChange(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="beam-iz">
              <span>Inercia de flexión Iz</span>
              <span className="unit">cm⁴</span>
            </label>
            <input
              id="beam-iz"
              type="number"
              min="1"
              step="10"
              className="form-input"
              value={form.Iz}
              onChange={(e) => handleIzChange(parseFloat(e.target.value) || 0)}
              title="Momento de inercia de área respecto al eje de flexión (eje Z del solver 2D). Para perfiles de catálogo orientados en posición vertical estándar, corresponde a la inercia del eje fuerte Ix."
            />
          </div>
        </div>

        {/* Extended Section Geometry for Mechanics of Materials */}
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Geometría de Sección Transversal (Esfuerzos σ y τ)
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${form.sectionType === 'rectangular' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                onClick={() => handleSectionTypeChange('rectangular')}
              >
                Rectangular (b×h)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${form.sectionType !== 'rectangular' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                onClick={() => handleSectionTypeChange('general')}
              >
                General / Wz
              </button>
            </div>
          </div>

          {form.sectionType === 'rectangular' ? (
            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label" htmlFor="rect-b">
                  <span>Base (b)</span>
                  <span className="unit">mm</span>
                </label>
                <input
                  id="rect-b"
                  type="number"
                  min="1"
                  step="5"
                  className="form-input"
                  value={form.widthMm ?? 100}
                  onChange={(e) => handleRectDimensionChange(parseFloat(e.target.value) || 0, undefined)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="rect-h">
                  <span>Altura (h)</span>
                  <span className="unit">mm</span>
                </label>
                <input
                  id="rect-h"
                  type="number"
                  min="1"
                  step="5"
                  className="form-input"
                  value={form.heightMm ?? 200}
                  onChange={(e) => handleRectDimensionChange(undefined, parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="rect-wz">
                  <span>Módulo Wz (calc)</span>
                  <span className="unit">cm³</span>
                </label>
                <input
                  id="rect-wz"
                  type="number"
                  className="form-input"
                  disabled
                  value={form.Wz ? form.Wz.toFixed(1) : ''}
                  style={{ opacity: 0.85, backgroundColor: 'rgba(255,255,255,0.03)' }}
                />
              </div>
            </div>
          ) : (
            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label" htmlFor="section-wz">
                  <span>Módulo Wz</span>
                  <span className="unit">cm³</span>
                </label>
                <input
                  id="section-wz"
                  type="number"
                  min="0"
                  step="1"
                  className="form-input"
                  value={form.Wz ?? ''}
                  placeholder="Ej: 434"
                  onChange={(e) => onChange({ ...form, Wz: parseFloat(e.target.value) || undefined })}
                  title="Módulo resistente de flexión Wz = Iz / c en cm³. Permite calcular el esfuerzo normal σ_max."
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="section-area">
                  <span>Área (A)</span>
                  <span className="unit">cm²</span>
                </label>
                <input
                  id="section-area"
                  type="number"
                  min="0"
                  step="1"
                  className="form-input"
                  value={form.areaCm2 ?? ''}
                  placeholder="Ej: 57"
                  onChange={(e) => onChange({ ...form, areaCm2: parseFloat(e.target.value) || undefined })}
                  title="Área transversal en cm². Permite evaluar el esfuerzo cortante medio τ = V / A."
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="section-h">
                  <span>Altura total h</span>
                  <span className="unit">mm</span>
                </label>
                <input
                  id="section-h"
                  type="number"
                  min="0"
                  step="5"
                  className="form-input"
                  value={form.heightMm ?? ''}
                  placeholder="Ej: 267"
                  onChange={(e) => onChange({ ...form, heightMm: parseFloat(e.target.value) || undefined })}
                  title="Altura total de la sección en mm (c = h/2 si simétrica)."
                />
              </div>
            </div>
          )}

          <div className="form-row form-row-3" style={{ marginTop: '0.4rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="bending-allowable">
                <span>σ admisible</span>
                <span className="unit">MPa</span>
              </label>
              <input
                id="bending-allowable"
                type="number"
                min="1"
                step="5"
                className="form-input"
                value={form.allowableBendingStressMPa ?? ''}
                placeholder="Ej: 150 (opcional)"
                onChange={(e) =>
                  onChange({ ...form, allowableBendingStressMPa: parseFloat(e.target.value) || undefined })
                }
                title="Esfuerzo admisible a flexión en MPa (ej. 150 MPa para A36 o 250 MPa)."
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="deflection-limit">
                <span>Límite flecha</span>
                <span className="unit">L/n</span>
              </label>
              <input
                id="deflection-limit"
                type="number"
                min="50"
                step="60"
                className="form-input"
                value={form.deflectionLimitDenominator ?? 360}
                placeholder="360"
                onChange={(e) =>
                  onChange({ ...form, deflectionLimitDenominator: parseFloat(e.target.value) || 360 })
                }
                title="Denominador del límite de flecha elástico (ej. 360 para L/360 o 240 para L/240)."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Supports Section */}
      <div className="form-section">
        <div className="form-section-title">
          <span>Apoyos ({form.supports.length})</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddSupport}
            aria-label="Agregar nuevo apoyo"
          >
            + Añadir Apoyo
          </button>
        </div>

        {form.supports.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic' }}>
            No hay apoyos configurados. La viga debe tener 1 empotramiento o 2 apoyos simples para ser isostática.
          </p>
        ) : (
          form.supports.map((sup, idx) => (
            <div key={sup.id || idx} className="item-card">
              <div className="item-card-header">
                <span className="item-badge">{sup.id}</span>
                <button
                  type="button"
                  className="btn btn-danger-ghost"
                  onClick={() => handleRemoveSupport(idx)}
                  aria-label={`Eliminar apoyo ${sup.id}`}
                >
                  ✕
                </button>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select
                    className="form-select"
                    value={sup.type}
                    onChange={(e) =>
                      handleUpdateSupport(idx, { type: e.target.value as SupportType })
                    }
                  >
                    <option value="pin">Articulación (Pin)</option>
                    <option value="roller">Rodillo (Roller)</option>
                    <option value="fixed">Empotramiento (Fixed)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <span>Posición x</span>
                    <span className="unit">m</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={form.length}
                    step="0.1"
                    className="form-input"
                    value={sup.x}
                    onChange={(e) =>
                      handleUpdateSupport(idx, { x: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Loads Section */}
      <div className="form-section">
        <div className="form-section-title">
          <span>Cargas Aplicadas ({form.loads.length})</span>
          <div className="load-action-buttons">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleAddLoad('point')}
              title="Añadir carga puntual"
            >
              + Puntual
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleAddLoad('distributed')}
              title="Añadir carga distribuida"
            >
              + Distribuida
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleAddLoad('moment')}
              title="Añadir momento concentrado"
            >
              + Momento
            </button>
          </div>
        </div>

        {form.loads.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic' }}>
            No hay cargas aplicadas. Añade cargas puntuales, distribuidas o momentos.
          </p>
        ) : (
          form.loads.map((load, idx) => (
            <div key={load.id || idx} className="item-card">
              <div className="item-card-header">
                <span className="item-badge" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                  {load.type.toUpperCase()} #{idx + 1}
                </span>
                <button
                  type="button"
                  className="btn btn-danger-ghost"
                  onClick={() => handleRemoveLoad(idx)}
                  aria-label={`Eliminar carga ${load.id}`}
                >
                  ✕
                </button>
              </div>

              {load.type === 'point' && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <span>Magnitud P</span>
                      <span className="unit">kN (↓ +)</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      value={load.P ?? 0}
                      onChange={(e) =>
                        handleUpdateLoad(idx, { P: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <span>Posición x</span>
                      <span className="unit">m</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={form.length}
                      step="0.1"
                      className="form-input"
                      value={load.x ?? 0}
                      onChange={(e) =>
                        handleUpdateLoad(idx, { x: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              )}

              {load.type === 'distributed' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        <span>x Inicio</span>
                        <span className="unit">m</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={form.length}
                        step="0.1"
                        className="form-input"
                        value={load.xStart ?? 0}
                        onChange={(e) =>
                          handleUpdateLoad(idx, { xStart: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        <span>x Fin</span>
                        <span className="unit">m</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={form.length}
                        step="0.1"
                        className="form-input"
                        value={load.xEnd ?? form.length}
                        onChange={(e) =>
                          handleUpdateLoad(idx, { xEnd: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        <span>w Inicio</span>
                        <span className="unit">kN/m</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        className="form-input"
                        value={load.wStart ?? 0}
                        onChange={(e) =>
                          handleUpdateLoad(idx, { wStart: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        <span>w Fin</span>
                        <span className="unit">kN/m</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        className="form-input"
                        value={load.wEnd ?? 0}
                        onChange={(e) =>
                          handleUpdateLoad(idx, { wEnd: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {load.type === 'moment' && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <span>Momento M</span>
                      <span className="unit">kN·m (↺ +)</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      value={load.M ?? 0}
                      onChange={(e) =>
                        handleUpdateLoad(idx, { M: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <span>Posición x</span>
                      <span className="unit">m</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={form.length}
                      step="0.1"
                      className="form-input"
                      value={load.x ?? 0}
                      onChange={(e) =>
                        handleUpdateLoad(idx, { x: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
