import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("utils", () => {
  describe("cn (className merger)", () => {
    it("should merge class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("should handle undefined values", () => {
      expect(cn("foo", undefined, "bar")).toBe("foo bar");
    });

    it("should handle null values", () => {
      expect(cn("foo", null, "bar")).toBe("foo bar");
    });

    it("should handle empty strings", () => {
      expect(cn("foo", "", "bar")).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      const isActive = true;
      expect(cn("base", isActive && "active")).toBe("base active");
    });

    it("should handle false conditionals", () => {
      const isActive = false;
      expect(cn("base", isActive && "active")).toBe("base");
    });

    it("should merge Tailwind classes properly", () => {
      expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    });

    it("should handle array inputs", () => {
      expect(cn(["foo", "bar"])).toBe("foo bar");
    });

    it("should handle object inputs", () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
    });

    it("should handle mixed inputs", () => {
      expect(cn("base", ["array"], { obj: true })).toBe("base array obj");
    });

    it("should return empty string for no inputs", () => {
      expect(cn()).toBe("");
    });

    it("should override conflicting Tailwind utilities", () => {
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("should handle responsive prefixes", () => {
      expect(cn("sm:text-sm", "md:text-md")).toBe("sm:text-sm md:text-md");
    });
  });
});
