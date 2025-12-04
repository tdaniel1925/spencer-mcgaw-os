"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, Archive, CheckCircle, XCircle } from "lucide-react";

export type ConfirmationVariant = "danger" | "warning" | "info" | "success";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationVariant;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  itemCount?: number;
  itemName?: string;
}

const variantConfig: Record<
  ConfirmationVariant,
  { icon: React.ReactNode; buttonClass: string }
> = {
  danger: {
    icon: <Trash2 className="h-5 w-5 text-destructive" />,
    buttonClass: "bg-destructive text-white hover:bg-destructive/90",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    buttonClass: "bg-amber-500 text-white hover:bg-amber-600",
  },
  info: {
    icon: <Archive className="h-5 w-5 text-blue-500" />,
    buttonClass: "bg-blue-500 text-white hover:bg-blue-600",
  },
  success: {
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    buttonClass: "bg-green-500 text-white hover:bg-green-600",
  },
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  onConfirm,
  isLoading = false,
  itemCount,
  itemName,
}: ConfirmationDialogProps) {
  const [isPending, setIsPending] = React.useState(false);
  const config = variantConfig[variant];

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsPending(false);
    }
  };

  const loading = isLoading || isPending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              {config.icon}
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {description}
            {itemCount !== undefined && itemCount > 0 && (
              <span className="mt-2 block font-medium text-foreground">
                {itemCount} {itemName || "item"}
                {itemCount !== 1 ? "s" : ""} will be affected.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={config.buttonClass}
          >
            {loading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook for managing confirmation dialog state
export function useConfirmation() {
  const [state, setState] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmationVariant;
    onConfirm: () => void | Promise<void>;
    itemCount?: number;
    itemName?: string;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const confirm = React.useCallback(
    (options: Omit<typeof state, "open">): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          ...options,
          open: true,
          onConfirm: async () => {
            await options.onConfirm();
            resolve(true);
          },
        });
      });
    },
    []
  );

  const close = React.useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    state,
    confirm,
    close,
    setOpen: (open: boolean) => setState((prev) => ({ ...prev, open })),
  };
}

// Preset confirmation dialogs
export function useDeleteConfirmation() {
  const { confirm, state, setOpen } = useConfirmation();

  const confirmDelete = React.useCallback(
    (options: {
      title?: string;
      description?: string;
      itemCount?: number;
      itemName?: string;
      onConfirm: () => void | Promise<void>;
    }) => {
      return confirm({
        title: options.title || "Delete Item",
        description:
          options.description ||
          "Are you sure you want to delete this item? This action cannot be undone.",
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "danger",
        itemCount: options.itemCount,
        itemName: options.itemName,
        onConfirm: options.onConfirm,
      });
    },
    [confirm]
  );

  return { confirmDelete, state, setOpen };
}

export function useArchiveConfirmation() {
  const { confirm, state, setOpen } = useConfirmation();

  const confirmArchive = React.useCallback(
    (options: {
      title?: string;
      description?: string;
      itemCount?: number;
      itemName?: string;
      onConfirm: () => void | Promise<void>;
    }) => {
      return confirm({
        title: options.title || "Archive Item",
        description:
          options.description ||
          "Are you sure you want to archive this item? You can restore it later.",
        confirmText: "Archive",
        cancelText: "Cancel",
        variant: "info",
        itemCount: options.itemCount,
        itemName: options.itemName,
        onConfirm: options.onConfirm,
      });
    },
    [confirm]
  );

  return { confirmArchive, state, setOpen };
}

export function useBulkActionConfirmation() {
  const { confirm, state, setOpen } = useConfirmation();

  const confirmBulkAction = React.useCallback(
    (options: {
      action: "delete" | "archive" | "complete" | "assign";
      itemCount: number;
      itemName?: string;
      onConfirm: () => void | Promise<void>;
    }) => {
      const actionConfig = {
        delete: {
          title: "Delete Multiple Items",
          description: "Are you sure you want to delete these items? This action cannot be undone.",
          confirmText: "Delete All",
          variant: "danger" as const,
        },
        archive: {
          title: "Archive Multiple Items",
          description: "Are you sure you want to archive these items? You can restore them later.",
          confirmText: "Archive All",
          variant: "info" as const,
        },
        complete: {
          title: "Mark as Complete",
          description: "Are you sure you want to mark these items as complete?",
          confirmText: "Complete All",
          variant: "success" as const,
        },
        assign: {
          title: "Assign Items",
          description: "Are you sure you want to assign these items?",
          confirmText: "Assign",
          variant: "info" as const,
        },
      };

      const config = actionConfig[options.action];

      return confirm({
        title: config.title,
        description: config.description,
        confirmText: config.confirmText,
        cancelText: "Cancel",
        variant: config.variant,
        itemCount: options.itemCount,
        itemName: options.itemName,
        onConfirm: options.onConfirm,
      });
    },
    [confirm]
  );

  return { confirmBulkAction, state, setOpen };
}
