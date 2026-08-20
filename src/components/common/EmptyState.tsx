import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
}) => {
  return (
    <div className="text-center py-12 px-4 border border-dashed border-gray-300 rounded-lg bg-gray-50/50">
      {icon && <div className="mx-auto w-12 h-12 flex items-center justify-center text-gray-400 mb-3">{icon}</div>}
      <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
      <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onAction} icon={actionIcon}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
