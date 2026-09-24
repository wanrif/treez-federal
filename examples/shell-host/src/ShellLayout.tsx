import { Outlet, Link } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';

export function ShellLayout(): ReactElement {
  const [shellCounter, setShellCounter] = useState<number>(0);

  return (
    <div className="shell-container">
      <header className="shell-header">
        <div className="shell-logo">
          <span>⚡</span>
          <span>treez-federal</span>
          <span className="badge badge-host" style={{ margin: 0, marginLeft: 8 }}>
            Host Shell (Port 3000)
          </span>
        </div>

        <nav className="shell-nav">
          <Link to="/" className="nav-link">
            Host Home
          </Link>
          <Link to="/dashboard" className="nav-link">
            Dashboard Zone
          </Link>
        </nav>

        <div className="shell-state-widget">
          <span>Shell State:</span>
          <span className="state-badge">Count: {shellCounter}</span>
          <button
            className="counter-btn"
            onClick={function increment() {
              setShellCounter((prev) => prev + 1);
            }}
          >
            +1
          </button>
        </div>
      </header>

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
