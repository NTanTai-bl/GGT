import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <nav className="sidebar">
        <h1>AI Pentest Platform</h1>
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/projects">Projects</NavLink>
        <NavLink to="/pentests/new">Start pentest</NavLink>
        {user && (
          <span className="logout" onClick={logout}>
            Sign out ({user.email})
          </span>
        )}
      </nav>
      <div className="content">{children}</div>
    </div>
  );
}
