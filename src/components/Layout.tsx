import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Users,
  ClipboardList,
  Apple,
  BarChart3,
  Home,
  Moon,
  Sun,
} from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/foods", label: "Alimentos", icon: Apple },
  { to: "/calculator", label: "Calculadora", icon: ClipboardList },
  { to: "/reports", label: "Reportes", icon: BarChart3 },
];

export function Layout() {
  const [dark, setDark] = useState(() => localStorage.getItem("dietforge_dark") === "true");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dietforge_dark", String(dark));
  }, [dark]);

  return (
    <div className="flex h-screen overflow-hidden">
      <nav className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 dark:bg-gray-900 dark:border-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h1 className="text-lg font-bold text-brand-600">DietForge</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Planificador de dietas</p>
        </div>
        <div className="flex-1 p-3 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                }`
              }
            >
              <l.icon className="w-4 h-4" />
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <button
            onClick={() => setDark(!dark)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors w-full"
          >
            {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {dark ? "Modo claro" : "Modo oscuro"}
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500">v1.0.0</p>
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
        <Outlet />
      </main>
    </div>
  );
}
