import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { can } from "@pentest/shared";
import { useAuth } from "./auth/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <nav className="sidebar">
        <h1>GGT</h1>
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/projects">Projects</NavLink>
        {user && can(user.role, "PENTEST_CREATE") && <NavLink to="/pentests/new">Start pentest</NavLink>}
        {user?.role === "ADMIN" && <NavLink to="/admin/users">User management</NavLink>}
        {user && (
          <span className="logout" onClick={logout}>
            Sign out ({user.email} &middot; {user.role})
          </span>
        )}
      </nav>
      <div className="content">{children}</div>
    </div>
  );
}
