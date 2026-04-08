'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, Info, Trash2 } from 'lucide-react';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export type ConfirmationModalVariant = 'danger' | 'warning' | 'info';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationModalVariant;
  isLoading?: boolean;
}

const variantConfig: Record<
  ConfirmationModalVariant,
  {
    icon: React.ReactNode;
    iconColor: string;
    buttonVariant: 'primary' | 'danger';
  }
> = {
  danger: {
    icon: <Trash2 className="w-6 h-6" />,
    iconColor: 'text-error-600 dark:text-error-400',
    buttonVariant: 'danger',
  },
  warning: {
    icon: <AlertTriangle className="w-6 h-6" />,
    iconColor: 'text-warning-600 dark:text-warning-400',
    buttonVariant: 'primary',
  },
  info: {
    icon: <Info className="w-6 h-6" />,
    iconColor: 'text-primary-600 dark:text-primary-400',
    buttonVariant: 'primary',
  },
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  const config = variantConfig[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <ModalContent>
        <div className="flex gap-4">
          <div className={`flex-shrink-0 mt-0.5 ${config.iconColor}`}>{config.icon}</div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={isLoading}
        >
          {cancelText}
        </Button>
        <Button
          variant={config.buttonVariant}
          onClick={handleConfirm}
          disabled={isLoading}
          isLoading={isLoading}
        >
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  );
};