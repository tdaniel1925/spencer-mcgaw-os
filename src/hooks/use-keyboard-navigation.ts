/**
 * Keyboard Navigation Hook
 * Provides common keyboard shortcuts and navigation helpers
 */

import { useEffect, useCallback, useRef } from "react";

export interface KeyboardNavigationOptions {
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Hook to handle keyboard navigation and shortcuts
 * @param options - Configuration options for keyboard handlers
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions) {
  const {
    onEscape,
    onEnter,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    enabled = true,
    preventDefault = true,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      switch (event.key) {
        case "Escape":
          if (onEscape) {
            if (preventDefault) event.preventDefault();
            onEscape();
          }
          break;
        case "Enter":
          if (onEnter && !event.shiftKey) {
            // Allow Shift+Enter for newlines in textareas
            const target = event.target as HTMLElement;
            if (target.tagName !== "TEXTAREA") {
              if (preventDefault) event.preventDefault();
              onEnter();
            }
          }
          break;
        case "ArrowUp":
          if (onArrowUp) {
            if (preventDefault) event.preventDefault();
            onArrowUp();
          }
          break;
        case "ArrowDown":
          if (onArrowDown) {
            if (preventDefault) event.preventDefault();
            onArrowDown();
          }
          break;
        case "ArrowLeft":
          if (onArrowLeft) {
            if (preventDefault) event.preventDefault();
            onArrowLeft();
          }
          break;
        case "ArrowRight":
          if (onArrowRight) {
            if (preventDefault) event.preventDefault();
            onArrowRight();
          }
          break;
      }
    },
    [
      enabled,
      onEscape,
      onEnter,
      onArrowUp,
      onArrowDown,
      onArrowLeft,
      onArrowRight,
      preventDefault,
    ]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [enabled, handleKeyDown]);
}

/**
 * Hook for managing focus within a list of items with arrow key navigation
 * @param itemsLength - Number of items in the list
 * @param enabled - Whether navigation is enabled
 */
export function useListNavigation(itemsLength: number, enabled = true) {
  const currentIndexRef = useRef(0);

  const moveUp = useCallback(() => {
    currentIndexRef.current = Math.max(0, currentIndexRef.current - 1);
    return currentIndexRef.current;
  }, []);

  const moveDown = useCallback(() => {
    currentIndexRef.current = Math.min(itemsLength - 1, currentIndexRef.current + 1);
    return currentIndexRef.current;
  }, [itemsLength]);

  const reset = useCallback(() => {
    currentIndexRef.current = 0;
  }, []);

  const getCurrentIndex = useCallback(() => {
    return currentIndexRef.current;
  }, []);

  const setCurrentIndex = useCallback((index: number) => {
    currentIndexRef.current = Math.max(0, Math.min(itemsLength - 1, index));
  }, [itemsLength]);

  return {
    moveUp,
    moveDown,
    reset,
    getCurrentIndex,
    setCurrentIndex,
    currentIndex: currentIndexRef.current,
  };
}

/**
 * Hook for global keyboard shortcuts (Cmd/Ctrl + key combinations)
 */
export interface GlobalShortcuts {
  "cmd+k"?: () => void; // Command palette
  "cmd+/"?: () => void; // Keyboard shortcuts help
  "cmd+n"?: () => void; // New item
  "cmd+s"?: () => void; // Save
  "cmd+f"?: () => void; // Search
}

export function useGlobalShortcuts(shortcuts: GlobalShortcuts, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdKey = isMac ? event.metaKey : event.ctrlKey;

      if (!cmdKey) return;

      const key = event.key.toLowerCase();

      switch (key) {
        case "k":
          if (shortcuts["cmd+k"]) {
            event.preventDefault();
            shortcuts["cmd+k"]();
          }
          break;
        case "/":
          if (shortcuts["cmd+/"]) {
            event.preventDefault();
            shortcuts["cmd+/"]();
          }
          break;
        case "n":
          if (shortcuts["cmd+n"]) {
            event.preventDefault();
            shortcuts["cmd+n"]();
          }
          break;
        case "s":
          if (shortcuts["cmd+s"]) {
            event.preventDefault();
            shortcuts["cmd+s"]();
          }
          break;
        case "f":
          if (shortcuts["cmd+f"]) {
            event.preventDefault();
            shortcuts["cmd+f"]();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}
