import { Link, Outlet } from '@tanstack/react-router';

export function Layout() {
  return (
    <div className="container">
      <nav className="nav" aria-label="Primary">
        <Link
          to="/"
          className="nav__link"
          activeOptions={{ exact: true }}
          activeProps={{ className: 'nav__link nav__link--active' }}
        >
          Overview
        </Link>
        <Link
          to="/agents/{-$agentId}"
          className="nav__link"
          activeProps={{ className: 'nav__link nav__link--active' }}
        >
          Agents
        </Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
