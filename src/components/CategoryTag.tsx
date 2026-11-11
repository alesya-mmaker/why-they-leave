import { SOURCE_LABEL } from "@/lib/categorize";
import { Categorized } from "@/lib/types";

/** Категория + кто её поставил (человек, словарь, LLM). */
export function CategoryTag({ c }: { c: Categorized | null | undefined }) {
  if (!c) return <span className="muted">—</span>;
  return (
    <span className="cat">
      <span>{c.category}</span>
      <span className={`src ${c.source}`}>{SOURCE_LABEL[c.source]}</span>
    </span>
  );
}
