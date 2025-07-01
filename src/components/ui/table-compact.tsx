
import React from "react";
import { cn } from "@/lib/utils";
import { tableStyles } from "./table-styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// We'll strip out null/undefined values from props to avoid React warnings
const cleanProps = (props: Record<string, any>) => {
  return Object.fromEntries(
    Object.entries(props).filter(([_, v]) => v !== null && v !== undefined)
  );
};

const TableCompact = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => {
  const cleanedProps = cleanProps(props);
  return (
    <Table ref={ref} className={cn("w-full text-sm", className)} {...cleanedProps} />
  );
});
TableCompact.displayName = "TableCompact";

const TableCompactHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  const cleanedProps = cleanProps(props);
  return (
    <TableHeader ref={ref} className={cn("border-b", className)} {...cleanedProps} />
  );
});
TableCompactHeader.displayName = "TableCompactHeader";

const TableCompactBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  const cleanedProps = cleanProps(props);
  return (
    <TableBody ref={ref} className={cn("", className)} {...cleanedProps} />
  );
});
TableCompactBody.displayName = "TableCompactBody";

const TableCompactRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => {
  const cleanedProps = cleanProps(props);
  return (
    <TableRow ref={ref} className={cn(tableStyles.row, "h-8", className)} {...cleanedProps} />
  );
});
TableCompactRow.displayName = "TableCompactRow";

const TableCompactHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const cleanedProps = cleanProps(props);
  return (
    <TableHead ref={ref} className={cn(tableStyles.head, className)} {...cleanedProps} />
  );
});
TableCompactHead.displayName = "TableCompactHead";

const TableCompactCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const cleanedProps = cleanProps(props);
  return (
    <TableCell ref={ref} className={cn(tableStyles.cell, "py-1", className)} {...cleanedProps} />
  );
});
TableCompactCell.displayName = "TableCompactCell";

export { 
  TableCompact, 
  TableCompactHeader, 
  TableCompactBody, 
  TableCompactRow, 
  TableCompactHead, 
  TableCompactCell 
};
