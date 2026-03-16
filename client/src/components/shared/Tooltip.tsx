import type { ReactNode } from 'react';
import {
  Tooltip as TooltipRoot,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip.js';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({
  content,
  children,
  position = 'top',
}: TooltipProps) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={position}>{content}</TooltipContent>
    </TooltipRoot>
  );
}
