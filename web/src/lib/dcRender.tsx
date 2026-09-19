import {
  createElement,
  Fragment,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

type Ctx = Record<string, unknown>;

function getPath(ctx: Ctx, path: string): unknown {
  const parts = path.trim().split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function interpolate(text: string, ctx: Ctx): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr: string) => {
    const v = getPath(ctx, expr.trim());
    if (v == null) return "";
    if (typeof v === "function") return "";
    return String(v);
  });
}

function cssToObject(css: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const part of css.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const i = trimmed.indexOf(":");
    if (i === -1) continue;
    const prop = trimmed.slice(0, i).trim();
    const val = trimmed.slice(i + 1).trim();
    const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = val;
  }
  return out as CSSProperties;
}

function parseStyleHover(raw: string | null): CSSProperties | undefined {
  if (!raw) return undefined;
  return cssToObject(raw);
}

function attrsToProps(
  el: Element,
  ctx: Ctx,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name;
    if (name === "style" || name === "style-hover" || name.startsWith("hint-") || name === "onClick") {
      continue;
    }
    if (name === "class") {
      props.className = interpolate(attr.value, ctx);
      continue;
    }
    if (name === "for") {
      props.htmlFor = interpolate(attr.value, ctx);
      continue;
    }
    props[name] = interpolate(attr.value, ctx);
  }

  const styleRaw = el.getAttribute("style");
  if (styleRaw) {
    props.style = cssToObject(interpolate(styleRaw, ctx));
  }

  const onClickRaw = el.getAttribute("onClick") || el.getAttribute("onclick");
  if (onClickRaw) {
    const m = onClickRaw.match(/\{\{\s*([^}]+?)\s*\}\}/);
    if (m) {
      const fn = getPath(ctx, m[1].trim());
      if (typeof fn === "function") {
        props.onClick = (e: MouseEvent) => {
          e.preventDefault();
          (fn as () => void)();
        };
      }
    }
  }

  return props;
}

function childrenOf(el: Element, ctx: Ctx): ReactNode[] {
  return Array.from(el.childNodes)
    .map((n, i) => nodeToReact(n, ctx, i))
    .filter((n) => n !== null && n !== undefined && n !== false);
}

function nodeToReact(node: Node, ctx: Ctx, key: number | string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text.trim() && text.includes("\n")) return text.includes("\n\n") ? "\n" : null;
    return interpolate(text, ctx);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === "sc-if") {
    const raw = el.getAttribute("value") || "";
    const m = raw.match(/\{\{\s*([^}]+?)\s*\}\}/);
    const val = m ? getPath(ctx, m[1].trim()) : false;
    if (!val) return null;
    return createElement(Fragment, { key }, ...childrenOf(el, ctx));
  }

  if (tag === "sc-for") {
    const listRaw = el.getAttribute("list") || "";
    const asName = el.getAttribute("as") || "item";
    const lm = listRaw.match(/\{\{\s*([^}]+?)\s*\}\}/);
    const list = (lm ? getPath(ctx, lm[1].trim()) : []) as unknown[];
    if (!Array.isArray(list)) return null;
    return createElement(
      Fragment,
      { key },
      ...list.map((item, idx) => {
        const childCtx = { ...ctx, [asName]: item };
        return createElement(
          Fragment,
          { key: idx },
          ...childrenOf(el, childCtx),
        );
      }),
    );
  }

  if (tag === "image-slot") {
    const src = interpolate(el.getAttribute("src") || "", ctx);
    const radius = el.getAttribute("radius") || "12";
    const fit = el.getAttribute("fit") || "cover";
    const placeholder = interpolate(el.getAttribute("placeholder") || "", ctx);
    const resolved = src.startsWith("img/") ? `/${src}` : src.startsWith("/") ? src : src ? `/${src}` : "";
    return (
      <div
        key={key}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: `${radius}px`,
          overflow: "hidden",
          background: "linear-gradient(135deg,#e8efd4,#f4f5e2)",
        }}
      >
        {resolved ? (
          <img
            src={resolved}
            alt={placeholder || ""}
            style={{
              width: "100%",
              height: "100%",
              objectFit: fit as "cover" | "contain",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: "#7c8467",
              font: "500 13px 'DM Sans',sans-serif",
              padding: 12,
              textAlign: "center",
            }}
          >
            {placeholder}
          </div>
        )}
      </div>
    );
  }

  if (tag === "br") return createElement("br", { key });

  const props = attrsToProps(el, ctx);
  props.key = key;

  const hoverStyle = parseStyleHover(el.getAttribute("style-hover"));
  if (hoverStyle) {
    const baseStyle = (props.style as CSSProperties) || {};
    return createElement(Hoverable, {
      key,
      tag: tag === "button" ? "button" : tag,
      baseStyle,
      hoverStyle,
      props,
      children: childrenOf(el, ctx),
    });
  }

  const voidTags = new Set(["input", "img", "meta", "link", "hr"]);
  if (voidTags.has(tag)) {
    return createElement(tag, props);
  }

  return createElement(tag, props, ...childrenOf(el, ctx));
}

function Hoverable({
  tag,
  baseStyle,
  hoverStyle,
  props,
  children,
}: {
  tag: string;
  baseStyle: CSSProperties;
  hoverStyle: CSSProperties;
  props: Record<string, unknown>;
  children: ReactNode[];
}) {
  const { style: _s, key: _k, ...rest } = props;
  return createElement(
    tag,
    {
      ...rest,
      style: baseStyle,
      onMouseEnter: (e: MouseEvent<HTMLElement>) => {
        Object.assign(e.currentTarget.style, cssToObject(
          Object.entries(hoverStyle)
            .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v}`)
            .join(";"),
        ));
        // apply hover keys directly
        for (const [k, v] of Object.entries(hoverStyle)) {
          (e.currentTarget.style as unknown as Record<string, string>)[k] = String(v);
        }
      },
      onMouseLeave: (e: MouseEvent<HTMLElement>) => {
        for (const [k, v] of Object.entries(baseStyle)) {
          (e.currentTarget.style as unknown as Record<string, string>)[k] = String(v ?? "");
        }
        for (const k of Object.keys(hoverStyle)) {
          if (!(k in baseStyle)) {
            (e.currentTarget.style as unknown as Record<string, string>)[k] = "";
          }
        }
      },
    },
    ...children,
  );
}

let parserDoc: Document | null = null;

export function renderDc(html: string, ctx: Ctx): ReactNode {
  if (typeof DOMParser === "undefined") return null;
  if (!parserDoc) parserDoc = document.implementation.createHTMLDocument("");
  const wrap = parserDoc.createElement("div");
  wrap.innerHTML = html;
  const nodes = Array.from(wrap.childNodes).map((n, i) => nodeToReact(n, ctx, i));
  return createElement(Fragment, null, ...nodes);
}
