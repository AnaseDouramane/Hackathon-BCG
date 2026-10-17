import { CATEGORY_UI, type CategoryKey } from "./category";

export function CategoryIcon({ category, size = 18, className = "" }: { category: CategoryKey; size?: number; className?: string }) {
  const { Icon, text, label } = CATEGORY_UI[category];
  return <Icon size={size} className={`${text} shrink-0 ${className}`} aria-label={label} role="img" />;
}
