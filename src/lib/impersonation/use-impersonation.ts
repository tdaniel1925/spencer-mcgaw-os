/**
 * Impersonation Hook
 * Checks for active impersonation session and provides controls
 */

import { useState, useEffect, useCallback } from 'react';

interface ImpersonationState {
  isImpersonating: boolean;
  impersonatedUser: {
    userId: string;
    email: string;
    fullName: string;
    role: string;
  } | null;
  originalUserId: string | null;
  startedAt: string | null;
}

interface UseImpersonationReturn extends ImpersonationState {
  stopImpersonation: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

export function useImpersonation(): UseImpersonationReturn {
  const [state, setState] = useState<ImpersonationState>({
    isImpersonating: false,
    impersonatedUser: null,
    originalUserId: null,
    startedAt: null,
  });

  // Check impersonation status
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/impersonate');
      if (!response.ok) {
        setState({
          isImpersonating: false,
          impersonatedUser: null,
          originalUserId: null,
          startedAt: null,
        });
        return;
      }

      const data = await response.json();

      if (data.impersonating) {
        setState({
          isImpersonating: true,
          impersonatedUser: data.impersonatedUser,
          originalUserId: data.originalUserId,
          startedAt: data.startedAt,
        });
      } else {
        setState({
          isImpersonating: false,
          impersonatedUser: null,
          originalUserId: null,
          startedAt: null,
        });
      }
    } catch (error) {
      console.error('[Impersonation] Failed to check status:', error);
      setState({
        isImpersonating: false,
        impersonatedUser: null,
        originalUserId: null,
        startedAt: null,
      });
    }
  }, []);

  // Stop impersonation
  const stopImpersonation = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to stop impersonation');
      }

      // Refresh status
      await refreshStatus();

      // Reload page to reset session
      window.location.reload();

      return true;
    } catch (error) {
      console.error('[Impersonation] Failed to stop:', error);
      return false;
    }
  }, [refreshStatus]);

  // Check status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    ...state,
    stopImpersonation,
    refreshStatus,
  };
}
