import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";

export interface NavItem {
  to: string;
  label: string;
  icon?: IconName;
  end?: boolean;
  badge?: number;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Open/close state for the mobile drawer with Escape-to-close and body scroll lock. */
export function useDrawer() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, toggle: () => setOpen((value) => !value), close: () => setOpen(false) };
}

export function MobileTopBar({
  title,
  subtitle,
  homeTo = "/",
  menuOpen,
  onMenu,
  right,
}: {
  title: string;
  subtitle?: string;
  homeTo?: string;
  menuOpen: boolean;
  onMenu: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="nt-mobile-bar">
      <Link to={homeTo} className="nt-mobile-brand" aria-label={`${title} home`}>
        <span className="nt-mark sm" />
        <span>
          <strong>{title}</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </span>
      </Link>
      <div className="nt-mobile-bar-actions">
        {right}
        <button
          type="button"
          className="nt-icon-btn"
          aria-expanded={menuOpen}
          aria-controls="nt-mobile-drawer"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={onMenu}
        >
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
      </div>
    </div>
  );
}

export function MobileDrawer({
  open,
  onClose,
  heading,
  sections,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  heading: string;
  sections: NavSection[];
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="nt-drawer-root">
      <button type="button" className="nt-drawer-backdrop" aria-label="Close menu" onClick={onClose} />
      <nav id="nt-mobile-drawer" ref={panel} className="nt-drawer" aria-label={heading}>
        <div className="nt-drawer-head">
          <strong>{heading}</strong>
          <button type="button" className="nt-icon-btn" aria-label="Close menu" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {sections.map((section, index) => (
          <div key={section.title ?? index} className="nt-drawer-section">
            {section.title ? <div className="nt-drawer-title">{section.title}</div> : null}
            {section.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className="nt-drawer-link" onClick={onClose}>
                {item.icon ? <Icon name={item.icon} size={18} /> : null}
                <span>{item.label}</span>
                {item.badge ? <span className="nt-nav-count">{item.badge}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
        {footer ? <div className="nt-drawer-footer">{footer}</div> : null}
      </nav>
    </div>
  );
}

export function BottomNav({ items, moreOpen, onMore }: { items: NavItem[]; moreOpen?: boolean; onMore?: () => void }) {
  return (
    <nav className="nt-bottom-nav" aria-label="Primary">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="nt-bottom-link">
          <span className="nt-bottom-icon">
            <Icon name={item.icon ?? "grid"} />
            {item.badge ? <span className="nt-bottom-badge">{item.badge > 9 ? "9+" : item.badge}</span> : null}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
      {onMore ? (
        <button
          type="button"
          className={`nt-bottom-link ${moreOpen ? "is-on" : ""}`}
          onClick={onMore}
          aria-expanded={moreOpen}
          aria-controls="nt-mobile-drawer"
        >
          <span className="nt-bottom-icon">
            <Icon name="more" />
          </span>
          <span>More</span>
        </button>
      ) : null}
    </nav>
  );
}
