"use client";

import {CoachNotifications} from "./CoachNotifications";
import {SystemUpdateNotice} from "./SystemUpdateNotice";
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
  LogOut, ShieldCheck, Leaf, Menu, X, Dumbbell, Library, ChevronDown, FolderKanban, Activity, Languages, User, FileText, MessageSquare,
} from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { SHELL_COPY, useAppLanguage } from "@/lib/language";
import { attachDomTranslator } from "@/lib/i18n-dom";
import { useWhiteLabel } from "@/lib/white-label";

const isCurrent = (pathname: string, to: string) => pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));

export function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [dark, setDark] = useState(() => { try { return localStorage.getItem("dietforge_dark") === "true"; } catch { return false; } });
  const { logout, email, status } = useSubscription();
  const { lang, setLang } = useAppLanguage();
  const { brand } = useWhiteLabel();
  const t = SHELL_COPY[lang];
  const [mobile, setMobile] = useState(false);

  type NavItem = { to: string; label: string; icon: typeof Home };
  const primaryLinks: NavItem[] = [
    { to: "/", label: t.dashboard, icon: Home },
    { to: "/clients", label: t.clients, icon: Users },
    { to: "/chat", label: t.chat, icon: MessageSquare },
  ];

  const groups: { id: string; label: string; icon: typeof Home; links: NavItem[] }[] = [
    {
      id: "tracking",
      label: t.tracking,
      icon: Activity,
      links: [
        { to: "/agenda", label: t.agenda, icon: ClipboardList },
        { to: "/reports", label: t.reports, icon: BarChart3 },
      ],
    },
    {
      id: "planning",
      label: t.planning,
      icon: FolderKanban,
      links: [
        { to: "/training", label: t.routines, icon: Dumbbell },
        { to: "/foods", label: t.foods, icon: Apple },
        { to: "/exercises", label: t.exercises, icon: Library },
      ],
    },
    {
      id: "system",
      label: t.system,
      icon: ShieldCheck,
      links: [
        { to: "/quality", label: t.quality, icon: ShieldCheck },
        ...(status.isAdmin ? [{ to: "/admin", label: t.admin, icon: ShieldCheck }] : []),
      ],
    },
  ];
  const allLinks = [...primaryLinks, ...groups.flatMap(group => group.links)];
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const currentLabel = allLinks.find(link => isCurrent(pathname, link.to))?.label ?? t.planning;

  const toggleGroup = (id: string) => setOpenGroups(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  useEffect(() => {
    const main = mainRef.current;
    main?.scrollTo(0, 0);
    if (!main || typeof window.matchMedia !== "function") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let animations: Animation[] = [];
    const animationByTarget = new Map<HTMLElement, Animation>();
    const revealFocusedBlock = (event: FocusEvent) => {
      const focused = event.target;
      if (!(focused instanceof Node)) return;
      for (const [target, animation] of animationByTarget) {
        if (target.contains(focused)) animation.cancel();
      }
    };
    const cancelAnimations = () => {
      if (frame && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
      animations.forEach(animation => animation.cancel());
      animations = [];
      animationByTarget.clear();
    };
    const animateRoute = () => {
      if (reducedMotion.matches) return;
      const isSafeTarget = (node: Element): node is HTMLElement => {
        if (!(node instanceof HTMLElement) || node.hidden || node.getAttribute("aria-hidden") === "true") return false;
        if (node.matches("[data-page-cascade]") || node.querySelector("[data-page-cascade]")) return false;
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed") return false;
        const overlaySelector = '[role="dialog"], [class~="fixed"], [class*="modal"], [class*="backdrop"]';
        return !node.matches(overlaySelector) && !node.querySelector(overlaySelector);
      };
      const roots = Array.from(main.children).filter(isSafeTarget);
      const revealChildren = (root: HTMLElement) => {
        let level = [root];
        for (let depth = 0; depth < 3; depth += 1) {
          const children = level.flatMap(node => Array.from(node.children).filter(isSafeTarget));
          if (children.length > 1) return children;
          if (children.length !== 1) break;
          level = children;
        }
        return level;
      };
      const blocks = roots.flatMap(revealChildren);
      const activeElement = document.activeElement;
      const targets = (blocks.length > 1 ? blocks : roots)
        .filter(target => !(activeElement instanceof Node) || !target.contains(activeElement))
        .slice(0, 8);
      animations = targets.flatMap((target, index) => {
        if (typeof target.animate !== "function") return [];
        const animation = target.animate([
          { opacity: 0, transform: "translateY(18px) scale(.98)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ], { duration: 500, delay: index * 75, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
        animationByTarget.set(target, animation);
        animation.finished.finally(() => animationByTarget.delete(target)).catch(() => {});
        return [animation];
      });
    };
    if (typeof window.requestAnimationFrame === "function") frame = window.requestAnimationFrame(animateRoute);
    else animateRoute();
    main.addEventListener("focusin", revealFocusedBlock);
    reducedMotion.addEventListener?.("change", cancelAnimations);
    return () => {
      main.removeEventListener("focusin", revealFocusedBlock);
      reducedMotion.removeEventListener?.("change", cancelAnimations);
      cancelAnimations();
    };
  }, [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("dietforge_dark", String(dark)); } catch { /* Theme still applies for this session. */ }
  }, [dark]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    return attachDomTranslator(main, lang);
  }, [lang, pathname]);

  return (
    <div className="df-shell">
      {mobile&&<button className="df-backdrop" aria-label={t.closeNav} onClick={()=>setMobile(false)}/>}
      <aside className={"df-sidebar "+(mobile?"is-open":"")}>
        <Link href="/" className="df-wordmark"><span className="df-logo">{brand.logoDataUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={brand.logoDataUrl} alt="" className="w-full h-full object-cover rounded-[9px]" />) : <Leaf size={21}/>}</span>{brand.brandName}<span className="df-wordmark-tag">{brand.tagline}</span></Link>
        <p className="text-[10px] tracking-widest text-emerald-200/50 mt-9 px-3">{t.workspace}</p>
        <nav aria-label={t.navLabel} className="df-navigation">
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
        <div className="df-sidebar-foot">
          <div className="df-account-card">
            <div className="df-account-meta">
              <span className="df-account-role">{status.isAdmin?t.adminRole:t.coachAccount}</span>
              <p className="df-account-email">{email}</p>
            </div>
            <div className="df-account-links">
              <Link href="/cuenta" className="df-privacy-link" onClick={()=>setMobile(false)}><User size={14}/>{t.myAccount}</Link>
              <Link href="/privacidad" target="_blank" rel="noopener noreferrer" className="df-privacy-link"><FileText size={14}/>{t.privacyNotice}</Link>
            </div>
          </div>
          <div className="df-sidebar-prefs">
            <div className="df-lang-switch" role="group" aria-label={t.language}>
              <span className="df-lang-label"><Languages size={14}/>{t.language}</span>
              <div className="df-lang-pills">
                <button type="button" aria-pressed={lang==="es"} onClick={()=>setLang("es")}>ES</button>
                <button type="button" aria-pressed={lang==="en"} onClick={()=>setLang("en")}>EN</button>
              </div>
            </div>
            <button type="button" className="df-foot-btn" onClick={()=>setDark(!dark)}>{dark?<Sun size={14}/>:<Moon size={14}/>}{dark?t.lightMode:t.darkMode}</button>
            <button type="button" className="df-foot-btn df-foot-logout" onClick={logout}><LogOut size={14}/>{t.logout}</button>
          </div>
        </div>
      </aside>
      <div className="df-main"><header className="df-topbar"><div className="flex gap-3 items-center"><button className="df-mobile-toggle" aria-label={t.openNav} aria-expanded={mobile} onClick={()=>setMobile(!mobile)}>{mobile?<X size={20}/>:<Menu size={20}/>}</button><span className="df-muted">{brand.brandName} <span className="mx-2 opacity-40">/</span> <strong className="df-text font-medium">{currentLabel}</strong></span></div><div className="flex items-center gap-3"><CoachNotifications/><span className="df-badge df-badge-green">{status.isAdmin?t.adminRole:t.proCoach}</span></div></header>
        <main ref={mainRef} className="df-content"><SystemUpdateNotice/>{children}</main>
      </div>
    </div>
  );
}
