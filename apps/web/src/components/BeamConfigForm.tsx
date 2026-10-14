import React from 'react';
import type { BeamFormState, FormLoad, FormSupport, FormLoadType } from '../types/ui.js';
import type { SupportType } from '@optisteel/core';
import { getPresetModels } from '../adapters/beamAdapter.js';

interface BeamConfigFormProps {
  form: BeamFormState;
  onChange: (updated: BeamFormState) => void;
  onReset: () => void;
}

export const BeamConfigForm: React.FC<BeamConfigFormProps> = ({ form, onChange, onReset }) => {
  const presets = getPresetModels();

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

      {/* Preset Selector */}
      <div className="form-section">
        <label className="form-label">
          <span>Plantillas Rápidas (Casos Canónicos)</span>
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
        <div className="form-row">
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
              <span>Inercia Iz</span>
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
            />
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
          <div style={{ display: 'flex', gap: '0.35rem' }}>
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
