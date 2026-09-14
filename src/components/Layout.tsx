"use client";

import {CoachNotifications} from "./CoachNotifications";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Users,
  ClipboardList,
  Apple,
  BarChart3,
  Home,
  Moon,
  Sun,
  LayoutDashboard,
  LogOut, ShieldCheck, Leaf, Menu, X, Dumbbell, Library, ChevronDown, FolderKanban, Activity,
} from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";

const primaryLinks = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/clients", label: "Clientes", icon: Users },
];

const baseGroups = [
  {
    id: "tracking",
    label: "Seguimiento",
    icon: Activity,
    links: [
      { to: "/coach", label: "Panel Coach", icon: LayoutDashboard },
      { to: "/agenda", label: "Agenda", icon: ClipboardList },
      { to: "/reports", label: "Reportes", icon: BarChart3 },
    ],
  },
  {
    id: "planning",
    label: "Planificación",
    icon: FolderKanban,
    links: [
      { to: "/training", label: "Rutinas", icon: Dumbbell },
      { to: "/foods", label: "Alimentos", icon: Apple },
      { to: "/exercises", label: "Ejercicios", icon: Library },
    ],
  },
];

const isCurrent = (pathname: string, to: string) => pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));

export function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [dark, setDark] = useState(() => { try { return localStorage.getItem("dietforge_dark") === "true"; } catch { return false; } });
  const { logout, email, status } = useSubscription();
  const [mobile, setMobile] = useState(false);
  const groups = [...baseGroups, {
    id: "system",
    label: "Sistema",
    icon: ShieldCheck,
    links: [
      { to: "/quality", label: "Calidad y respaldos", icon: ShieldCheck },
      ...(status.isAdmin ? [{ to: "/admin", label: "Administración", icon: ShieldCheck }] : []),
    ],
  }];
  const allLinks = [...primaryLinks, ...groups.flatMap(group => group.links)];
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const currentLabel = allLinks.find(link => isCurrent(pathname, link.to))?.label ?? "Planificación";

  const toggleGroup = (id: string) => setOpenGroups(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("dietforge_dark", String(dark)); } catch { /* Theme still applies for this session. */ }
  }, [dark]);

  return (
    <div className="df-shell">
      {mobile&&<button className="df-backdrop" aria-label="Cerrar navegación" onClick={()=>setMobile(false)}/>}
      <aside className={"df-sidebar "+(mobile?"is-open":"")}>
        <Link href="/" className="df-wordmark"><span className="df-logo"><Leaf size={21}/></span>DietForge<span className="df-wordmark-tag">PRO</span></Link>
        <p className="text-[10px] tracking-widest text-emerald-200/50 mt-9 px-3">ESPACIO DE TRABAJO</p>
        <nav aria-label="Navegación principal" className="df-navigation">
          {primaryLinks.map(link=><Link key={link.to} href={link.to} onClick={()=>setMobile(false)} aria-current={isCurrent(pathname,link.to)?"page":undefined}><link.icon size={17}/>{link.label}</Link>)}
          <div className="df-nav-divider"/>
          {groups.map(group=>{
            const active=group.links.some(link=>isCurrent(pathname,link.to));
            const open=active||openGroups.includes(group.id);
            return <div className="df-nav-group" key={group.id}>
              <button type="button" className="df-nav-group-toggle" aria-expanded={open} aria-controls={`nav-${group.id}`} data-active={active||undefined} onClick={()=>toggleGroup(group.id)}>
                <group.icon size={17}/><span>{group.label}</span><ChevronDown className="df-nav-chevron" size={15}/>
              </button>
              <div id={`nav-${group.id}`} className="df-nav-submenu" hidden={!open}>
                {group.links.map(link=><Link key={link.to} href={link.to} onClick={()=>setMobile(false)} aria-current={isCurrent(pathname,link.to)?"page":undefined}><link.icon size={15}/>{link.label}</Link>)}
              </div>
            </div>;
          })}
        </nav>
        <div className="df-sidebar-foot"><div className="border-t border-white/10 pt-4 pb-3 px-3"><p className="text-xs font-medium">{status.isAdmin?"Administrador":"Cuenta de coach"}</p><p className="text-[10px] text-emerald-100/50 mt-2 break-all">{email}</p></div><button onClick={()=>setDark(!dark)}>{dark?<Sun size={16}/>:<Moon size={16}/>}Modo {dark?"claro":"oscuro"}</button><button onClick={logout}><LogOut size={16}/>Cerrar sesión</button></div>
      </aside>
      <div className="df-main"><header className="df-topbar"><div className="flex gap-3 items-center"><button className="df-mobile-toggle" aria-label="Abrir navegación" aria-expanded={mobile} onClick={()=>setMobile(!mobile)}>{mobile?<X size={20}/>:<Menu size={20}/>}</button><span className="df-muted">DietForge <span className="mx-2 opacity-40">/</span> <strong className="df-text font-medium">{currentLabel}</strong></span></div><div className="flex items-center gap-3"><CoachNotifications/><span className="df-badge df-badge-green">{status.isAdmin?"Administrador":"Coach profesional"}</span></div></header>
        <main ref={mainRef} className="df-content">{children}</main>
      </div>
    </div>
  );
}
