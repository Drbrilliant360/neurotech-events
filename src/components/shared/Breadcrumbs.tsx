import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

/** Desktop shows the full trail; on phones only the parent link remains as a back control. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="nt-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.to && index !== items.length - 1 ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
