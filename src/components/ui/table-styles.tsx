
import { cn } from "@/lib/utils";

// Compact styling for tables across the application
export const tableStyles = {
  cell: "p-2 align-middle [&:has([role=checkbox])]:pr-0",
  head: "h-8 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
  row: "border-b transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted h-9",
  editableCell: "hover:bg-muted/40 cursor-pointer",
};

export const TableCompact = {
  Cell: ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className={cn(tableStyles.cell, className)} {...props} />
  ),
  Head: ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className={cn(tableStyles.head, className)} {...props} />
  ),
  Row: ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className={cn(tableStyles.row, className)} {...props} />
  ),
};

interface OffsetChipProps {
  offset?: string;
  index?: number;
  onRemove?: () => void;
  onDelete?: () => void;
  children?: React.ReactNode;
  showArrow?: boolean;
}

export const OffsetChip = ({ offset, index, onRemove, onDelete, children, showArrow }: OffsetChipProps) => (
  <div className="inline-flex items-center bg-muted rounded-md px-2 py-1 text-xs mr-1 mb-1">
    <span className="font-mono">{offset || children}</span>
    {(onRemove || onDelete) && (
      <button 
        onClick={onRemove || onDelete}
        className="ml-1 text-muted-foreground hover:text-destructive"
      >
        ×
      </button>
    )}
  </div>
);
