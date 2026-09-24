import { Outlet } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';

export function DashboardLayout(): ReactElement {
  const [zoneCounter, setZoneCounter] = useState<number>(0);

  return (
    <div className="card" style={{ borderColor: '#10b981' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <div>
          <span className="badge badge-zone">Remote Zone</span>
          <h2>📊 Dashboard Zone (Port 3001, Base /dashboard/)</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span>Zone Local State:</span>
          <span
            style={{
              background: '#10b981',
              color: '#0b0f19',
              padding: '0.1rem 0.5rem',
              borderRadius: '8px',
              fontWeight: 'bold',
            }}
          >
            {zoneCounter}
          </span>
          <button
            onClick={function increment() {
              setZoneCounter((c) => c + 1);
            }}
            style={{
              background: '#10b981',
              color: '#0b0f19',
              border: 'none',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            +1
          </button>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
