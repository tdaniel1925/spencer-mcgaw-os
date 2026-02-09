/**
 * Unit Tests for useKeyboardNavigation Hook
 * Tests keyboard event handling and navigation logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useKeyboardNavigation,
  useListNavigation,
  useGlobalShortcuts,
} from "@/hooks/use-keyboard-navigation";

describe("useKeyboardNavigation Hook", () => {
  beforeEach(() => {
    // Clear all event listeners before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up event listeners
    vi.restoreAllMocks();
  });

  describe("Escape key", () => {
    it("calls onEscape when Escape is pressed", () => {
      const onEscape = vi.fn();
      renderHook(() =>
        useKeyboardNavigation({
          onEscape,
          enabled: true,
        })
      );

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Escape" });
        window.dispatchEvent(event);
      });

      expect(onEscape).toHaveBeenCalled();
    });

    it("does not call onEscape when disabled", () => {
      const onEscape = vi.fn();
      renderHook(() =>
        useKeyboardNavigation({
          onEscape,
          enabled: false,
        })
      );

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Escape" });
        window.dispatchEvent(event);
      });

      expect(onEscape).not.toHaveBeenCalled();
    });
  });

  describe("Enter key", () => {
    it("calls onEnter when Enter is pressed", () => {
      const onEnter = vi.fn();
      renderHook(() =>
        useKeyboardNavigation({
          onEnter,
          enabled: true,
        })
      );

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Enter" });
        window.dispatchEvent(event);
      });

      expect(onEnter).toHaveBeenCalled();
    });

    it("does not call onEnter for Shift+Enter", () => {
      const onEnter = vi.fn();
      renderHook(() =>
        useKeyboardNavigation({
          onEnter,
          enabled: true,
        })
      );

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Enter", shiftKey: true });
        window.dispatchEvent(event);
      });

      expect(onEnter).not.toHaveBeenCalled();
    });
  });

  describe("Arrow keys", () => {
    it("calls onArrowUp when ArrowUp is pressed", () => {
      const onArrowUp = vi.fn();
      renderHook(() =>
        useKeyboardNavigation({
          onArrowUp,
          enabled: true,
        })
      );

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "ArrowUp" });
        window.dispatchEvent(event);
      });

      expect(onArrowUp).toHaveBeenCalled();
    });

    it("calls onArrowDown when ArrowDown is pressed", () => {
      const onArrowDown = vi.fn();
      renderHook(() =>
        useKeyboardNavigation({
          onArrowDown,
          enabled: true,
        })
      );

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
        window.dispatchEvent(event);
      });

      expect(onArrowDown).toHaveBeenCalled();
    });

    it("calls onArrowLeft when ArrowLeft is pressed", () => {
      const onArrowLeft = vi.fn();
      renderHook(() =>
        useKeyboardNavigation({
          onArrowLeft,
          enabled: true,
        })
      );

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "ArrowLeft" });
        window.dispatchEvent(event);
      });

      expect(onArrowLeft).toHaveBeenCalled();
    });

    it("calls onArrowRight when ArrowRight is pressed", () => {
      const onArrowRight = vi.fn();
      renderHook(() =>
        useKeyboardNavigation({
          onArrowRight,
          enabled: true,
        })
      );

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "ArrowRight" });
        window.dispatchEvent(event);
      });

      expect(onArrowRight).toHaveBeenCalled();
    });
  });
});

describe("useListNavigation Hook", () => {
  it("initializes with index 0", () => {
    const { result } = renderHook(() => useListNavigation(10));

    expect(result.current.getCurrentIndex()).toBe(0);
  });

  it("moves down and increments index", () => {
    const { result } = renderHook(() => useListNavigation(10));

    act(() => {
      result.current.moveDown();
    });

    expect(result.current.getCurrentIndex()).toBe(1);
  });

  it("moves up and decrements index", () => {
    const { result } = renderHook(() => useListNavigation(10));

    act(() => {
      result.current.setCurrentIndex(5);
      result.current.moveUp();
    });

    expect(result.current.getCurrentIndex()).toBe(4);
  });

  it("does not go below 0 when moving up", () => {
    const { result } = renderHook(() => useListNavigation(10));

    act(() => {
      result.current.moveUp();
    });

    expect(result.current.getCurrentIndex()).toBe(0);
  });

  it("does not exceed max when moving down", () => {
    const { result } = renderHook(() => useListNavigation(5));

    act(() => {
      result.current.setCurrentIndex(4);
      result.current.moveDown();
    });

    expect(result.current.getCurrentIndex()).toBe(4);
  });

  it("resets index to 0", () => {
    const { result } = renderHook(() => useListNavigation(10));

    act(() => {
      result.current.setCurrentIndex(5);
      result.current.reset();
    });

    expect(result.current.getCurrentIndex()).toBe(0);
  });

  it("sets index manually", () => {
    const { result } = renderHook(() => useListNavigation(10));

    act(() => {
      result.current.setCurrentIndex(7);
    });

    expect(result.current.getCurrentIndex()).toBe(7);
  });

  it("clamps index to valid range when setting", () => {
    const { result } = renderHook(() => useListNavigation(10));

    act(() => {
      result.current.setCurrentIndex(20);
    });

    expect(result.current.getCurrentIndex()).toBe(9);

    act(() => {
      result.current.setCurrentIndex(-5);
    });

    expect(result.current.getCurrentIndex()).toBe(0);
  });
});

describe("useGlobalShortcuts Hook", () => {
  it("calls cmd+k handler on Mac", () => {
    // Mock Mac platform
    Object.defineProperty(navigator, "platform", {
      value: "MacIntel",
      writable: true,
    });

    const handler = vi.fn();
    renderHook(() =>
      useGlobalShortcuts({
        "cmd+k": handler,
      })
    );

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
      });
      window.dispatchEvent(event);
    });

    expect(handler).toHaveBeenCalled();
  });

  it("calls cmd+n handler", () => {
    const handler = vi.fn();
    renderHook(() =>
      useGlobalShortcuts({
        "cmd+n": handler,
      })
    );

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "n",
        metaKey: true,
      });
      window.dispatchEvent(event);
    });

    expect(handler).toHaveBeenCalled();
  });

  it("calls cmd+s handler", () => {
    const handler = vi.fn();
    renderHook(() =>
      useGlobalShortcuts({
        "cmd+s": handler,
      })
    );

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "s",
        metaKey: true,
      });
      window.dispatchEvent(event);
    });

    expect(handler).toHaveBeenCalled();
  });

  it("calls cmd+f handler", () => {
    const handler = vi.fn();
    renderHook(() =>
      useGlobalShortcuts({
        "cmd+f": handler,
      })
    );

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "f",
        metaKey: true,
      });
      window.dispatchEvent(event);
    });

    expect(handler).toHaveBeenCalled();
  });

  it("does not call handler when disabled", () => {
    const handler = vi.fn();
    renderHook(() =>
      useGlobalShortcuts(
        {
          "cmd+k": handler,
        },
        false
      )
    );

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
      });
      window.dispatchEvent(event);
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call handler without cmd/ctrl key", () => {
    const handler = vi.fn();
    renderHook(() =>
      useGlobalShortcuts({
        "cmd+k": handler,
      })
    );

    act(() => {
      const event = new KeyboardEvent("keydown", { key: "k" });
      window.dispatchEvent(event);
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
