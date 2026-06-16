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
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";

const links = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/coach", label: "Panel Coach", icon: LayoutDashboard },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/foods", label: "Alimentos", icon: Apple },
  { to: "/calculator", label: "Calculadora", icon: ClipboardList },
  { to: "/reports", label: "Reportes", icon: BarChart3 },
];

export function Layout() {
  const [dark, setDark] = useState(() => localStorage.getItem("dietforge_dark") === "true");
  const { email, status, logout } = useSubscription();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dietforge_dark", String(dark));
  }, [dark]);

  return (
    <div className="flex h-screen overflow-hidden">
      <nav className="w-56 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 shadow-sm">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="DietForge" className="w-8 h-8" />
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-brand-500 to-brand-600 bg-clip-text text-transparent">DietForge</h1>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Planificador de dietas</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-3 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
                  isActive
                    ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
                }`
              }
            >
              <l.icon className="w-4 h-4" />
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <button
            onClick={() => setDark(!dark)}
            className="flex items-center gap-2.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all active:scale-[0.97] w-full px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </div>
            {dark ? "Modo claro" : "Modo oscuro"}
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 text-xs text-gray-400 hover:text-red-500 transition-all active:scale-[0.97] w-full px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <LogOut className="w-3.5 h-3.5" />
            </div>
            Cerrar sesión
          </button>
          <p className="text-[10px] text-gray-300 dark:text-gray-600 px-2">DietForge v1.0.0</p>
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
        <Outlet />
      </main>
    </div>
  );
}
