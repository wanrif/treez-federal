import type { ReactElement } from 'react';

export function DashboardIndex(): ReactElement {
  return (
    <div
      style={{
        padding: '1.25rem',
        background: '#111827',
        borderRadius: '8px',
        marginTop: '1rem',
      }}
    >
      <h3>Dashboard Index View</h3>
      <p style={{ color: '#9ca3af', marginTop: '0.5rem' }}>
        This sub-view is dynamically loaded across zone boundaries via ESM dynamic import. It uses
        the shared React and TanStack Router instance managed by the host orchestrator.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem',
        }}
      >
        <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Active Users</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#34d399' }}>1,429</div>
        </div>
        <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Requests/sec</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>8.4k</div>
        </div>
        <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Memory Context</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#a78bfa' }}>
            Single Shared Container
          </div>
        </div>
      </div>
    </div>
  );
}
