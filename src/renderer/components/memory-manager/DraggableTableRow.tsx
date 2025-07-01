
import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { TableRow } from "@/components/ui/table";
import { MoveVertical } from 'lucide-react';

interface DraggableTableRowProps {
  id: string;
  index: number;
  moveRow: (dragIndex: number, hoverIndex: number) => void;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const rowType = 'memory-address-row';

export const DraggableTableRow: React.FC<DraggableTableRowProps> = ({ 
  id, 
  index, 
  moveRow, 
  children, 
  className,
  onClick 
}) => {
  const ref = useRef<HTMLTableRowElement>(null);
  
  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: rowType,
    item: { id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ handlerId }, drop] = useDrop({
    accept: rowType,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: any, monitor) {
      if (!ref.current) {
        return;
      }
      
      const dragIndex = item.index;
      const hoverIndex = index;
      
      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }
      
      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      
      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      
      // Get pixels to the top
      const hoverClientY = clientOffset?.y ? clientOffset.y - hoverBoundingRect.top : 0;
      
      // Only perform the move when the mouse has crossed half of the item's height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%
      
      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }
      
      // Time to actually perform the action
      moveRow(dragIndex, hoverIndex);
      
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for performance 
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });
  
  const opacity = isDragging ? 0.5 : 1;
  
  drag(dragPreview(drop(ref)));
  
  return (
    <TableRow 
      ref={ref} 
      className={`${className || ''} ${isDragging ? 'bg-accent/40' : ''}`}
      style={{ opacity }}
      onClick={onClick}
      data-handler-id={handlerId}
    >
      {children}
    </TableRow>
  );
};

export const DragHandle: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`flex items-center cursor-move text-muted-foreground/50 hover:text-primary ${className || ''}`}>
      <MoveVertical className="h-4 w-4" />
    </div>
  );
};
