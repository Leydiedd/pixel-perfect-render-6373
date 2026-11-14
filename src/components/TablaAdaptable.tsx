import {
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
  type TableHTMLAttributes,
} from "react";
type Elemento = ReactElement<{
  children?: ReactNode;
  colSpan?: number;
  "data-label"?: string | undefined;
  role?: string;
}>;
function texto(node: ReactNode): string {
  return Children.toArray(node)
    .map((n) =>
      typeof n === "string" || typeof n === "number"
        ? String(n)
        : isValidElement(n)
          ? texto((n as Elemento).props.children)
          : "",
    )
    .join(" ")
    .trim();
}
export function TablaAdaptable({
  children,
  className = "",
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  const labels: string[] = [];
  function headers(node: ReactNode) {
    Children.forEach(node, (n) => {
      if (!isValidElement(n)) return;
      const e = n as Elemento;
      if (e.type === "th") labels.push(texto(e.props.children));
      else headers(e.props.children);
    });
  }
  headers(children);
  function body(node: ReactNode, inBody = false): ReactNode {
    return Children.map(node, (n) => {
      if (!isValidElement(n)) return n;
      const e = n as Elemento;
      if (e.type === "tr" && inBody) {
        let col = 0;
        return cloneElement(e, {
          role: "row",
          children: Children.map(e.props.children, (cell) => {
            if (!isValidElement(cell)) return cell;
            const c = cell as Elemento;
            const label = labels[col++] || "Detalle";
            return cloneElement(c, {
              role: "cell",
              "data-label": c.props.colSpan ? undefined : label,
            });
          }),
        });
      }
      return cloneElement(e, { children: body(e.props.children, inBody || e.type === "tbody") });
    });
  }
  return (
    <table {...props} role="table" className={`tabla-adaptable ${className}`}>
      {body(children)}
    </table>
  );
}
