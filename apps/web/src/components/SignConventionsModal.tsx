import React, { useEffect, useRef } from 'react';

interface SignConventionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignConventionsModal: React.FC<SignConventionsModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="custom-modal"
      onClose={onClose}
      aria-labelledby="conventions-title"
    >
      <div className="modal-header">
        <h2 id="conventions-title" className="modal-title">
          Convenciones de Signos y Fundamentos Mecánicos — OptiSteel 2.0
        </h2>
        <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar ventana">
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem', lineHeight: '1.6' }}>
        <div className="alert alert-info" style={{ margin: 0 }}>
          <div>
            <strong>Referencia Teórica:</strong> Euler-Bernoulli, Pytel & Singer 4.ª Edición (Capítulo 6), y resistencia de materiales clásica.
          </div>
        </div>

        <div>
          <h3 style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
            1. Fuerzas Externas y Apoyos
          </h3>
          <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
            <li><strong>Cargas puntuales P:</strong> Positivas hacia abajo (+↓).</li>
            <li><strong>Cargas distribuidas w(x):</strong> Positivas hacia abajo (+↓, kN/m).</li>
            <li><strong>Reacciones verticales Ry:</strong> Positivas hacia arriba (+↑, kN).</li>
            <li><strong>Momentos externos aplicados M:</strong> Positivos antihorarios (+↺ CCW, kN·m).</li>
            <li><strong>Momentos de reacción en empotramientos Mr:</strong> Positivos antihorarios (+↺ CCW, kN·m).</li>
          </ul>
        </div>

        <div>
          <h3 style={{ color: 'var(--accent-emerald)', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
            2. Fuerzas Internas (Esfuerzos Cortante y Flector)
          </h3>
          <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
            <li>
              <strong>Fuerza cortante V(x):</strong> Positiva cuando la cara izquierda del corte empuja hacia arriba y la cara derecha hacia abajo.
              <br />
              <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>dV/dx = -w(x)</code>
            </li>
            <li>
              <strong>Momento flector M(x):</strong> Positivo a flexión simple ("sagging": fibras inferiores en tracción y fibras superiores en compresión).
              <br />
              <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>dM/dx = V(x)</code>
            </li>
          </ul>
        </div>

        <div>
          <h3 style={{ color: '#c084fc', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
            3. Deformaciones y Ecuación de la Elástica
          </h3>
          <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
            <li>
              <strong>Deflexión y(x):</strong> Positiva hacia abajo (+↓), coherente con el descenso por gravedad.
            </li>
            <li>
              <strong>Ecuación diferencial de la elástica:</strong>
              <br />
              <code style={{ fontFamily: 'var(--font-mono)', color: '#c084fc' }}>
                EI · d²y/dx² = -M(x)
              </code>
            </li>
            <li>
              <strong>Pendiente θ(x) = dy/dx:</strong> Giro de la sección en radianes (rad).
            </li>
            <li>
              <strong>Rigidez a flexión:</strong>{' '}
              <code style={{ fontFamily: 'var(--font-mono)' }}>EI = E [GPa] · Iz [cm⁴] · 10⁻² [kN·m²]</code>.
            </li>
          </ul>
        </div>

        <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </dialog>
  );
};
