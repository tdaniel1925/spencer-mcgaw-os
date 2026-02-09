/**
 * Unit Tests for FormField Component
 * Tests validation, error handling, and user interactions
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormField, validators, composeValidators } from "@/components/ui/form-field";

describe("FormField Component", () => {
  describe("Rendering", () => {
    it("renders with label and input", () => {
      render(
        <FormField
          label="Email"
          name="email"
          value=""
          onChange={() => {}}
        />
      );

      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders with required indicator", () => {
      render(
        <FormField
          label="Email"
          name="email"
          value=""
          onChange={() => {}}
          required
        />
      );

      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("renders with placeholder", () => {
      render(
        <FormField
          label="Email"
          name="email"
          value=""
          onChange={() => {}}
          placeholder="Enter your email"
        />
      );

      expect(screen.getByPlaceholderText("Enter your email")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("displays error message when provided", () => {
      render(
        <FormField
          label="Email"
          name="email"
          value="invalid"
          onChange={() => {}}
          error="Invalid email format"
        />
      );

      expect(screen.getByText("Invalid email format")).toBeInTheDocument();
    });

    it("shows error styling when error is present", () => {
      const { container } = render(
        <FormField
          label="Email"
          name="email"
          value="invalid"
          onChange={() => {}}
          error="Invalid email"
        />
      );

      // Check for error styling
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("border-destructive");
    });

    it("does not show error when no error provided", () => {
      render(
        <FormField
          label="Email"
          name="email"
          value="test@example.com"
          onChange={() => {}}
        />
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Success State", () => {
    it("shows success icon when showSuccess is true", () => {
      const { container } = render(
        <FormField
          label="Email"
          name="email"
          value="test@example.com"
          onChange={() => {}}
          showSuccess
        />
      );

      // Check for success styling
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("border-green-500");
    });
  });

  describe("User Interactions", () => {
    it("calls onChange when value changes", () => {
      const handleChange = vi.fn();
      render(
        <FormField
          label="Email"
          name="email"
          value=""
          onChange={handleChange}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "test@example.com" } });

      expect(handleChange).toHaveBeenCalledWith("test@example.com");
    });

    it("calls onBlur when field loses focus", () => {
      const handleBlur = vi.fn();
      render(
        <FormField
          label="Email"
          name="email"
          value=""
          onChange={() => {}}
          onBlur={handleBlur}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.blur(input);

      expect(handleBlur).toHaveBeenCalled();
    });
  });

  describe("Input Types", () => {
    it("renders as email input when type is email", () => {
      render(
        <FormField
          label="Email"
          name="email"
          type="email"
          value=""
          onChange={() => {}}
        />
      );

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "email");
    });

    it("renders as password input when type is password", () => {
      render(
        <FormField
          label="Password"
          name="password"
          type="password"
          value=""
          onChange={() => {}}
        />
      );

      const input = screen.getByLabelText("Password");
      expect(input).toHaveAttribute("type", "password");
    });

    it("renders as textarea when type is textarea", () => {
      render(
        <FormField
          label="Description"
          name="description"
          type="textarea"
          value=""
          onChange={() => {}}
        />
      );

      // Check for textarea element
      const textarea = screen.getByRole("textbox");
      expect(textarea.tagName).toBe("TEXTAREA");
    });
  });

  describe("Character Counter", () => {
    it("shows character counter for textarea with maxLength", () => {
      render(
        <FormField
          label="Description"
          name="description"
          type="textarea"
          value="Hello"
          onChange={() => {}}
          maxLength={100}
        />
      );

      expect(screen.getByText("5 / 100")).toBeInTheDocument();
    });
  });

  describe("Tooltip", () => {
    it("renders tooltip when tooltipContent is provided", () => {
      const { container } = render(
        <FormField
          label="Phone"
          name="phone"
          value=""
          onChange={() => {}}
          tooltipContent="Format: (555) 555-5555"
        />
      );

      // Tooltip icon should be present (check for Info icon svg)
      const tooltipIcon = container.querySelector("svg");
      expect(tooltipIcon).toBeInTheDocument();
    });
  });
});

describe("Validators", () => {
  describe("required validator", () => {
    it("returns error for empty string", () => {
      const result = validators.required("");
      expect(result).toBe("This field is required");
    });

    it("returns error for whitespace string", () => {
      const result = validators.required("   ");
      expect(result).toBe("This field is required");
    });

    it("returns null for valid string", () => {
      const result = validators.required("test");
      expect(result).toBeNull();
    });

    it("returns null for zero (zero is a valid value)", () => {
      const result = validators.required(0);
      // Zero converts to "0" which is not empty
      expect(result).toBeNull();
    });
  });

  describe("email validator", () => {
    it("returns error for invalid email", () => {
      const result = validators.email("invalid");
      expect(result).toBe("Please enter a valid email address");
    });

    it("returns error for email without @", () => {
      const result = validators.email("test.com");
      expect(result).toBe("Please enter a valid email address");
    });

    it("returns error for email without domain", () => {
      const result = validators.email("test@");
      expect(result).toBe("Please enter a valid email address");
    });

    it("returns null for valid email", () => {
      const result = validators.email("test@example.com");
      expect(result).toBeNull();
    });
  });

  describe("phone validator", () => {
    it("returns error for invalid phone", () => {
      const result = validators.phone("123");
      expect(result).toBe("Phone number must be at least 10 digits");
    });

    it("returns null for valid phone formats", () => {
      expect(validators.phone("(555) 555-5555")).toBeNull();
      expect(validators.phone("555-555-5555")).toBeNull();
      expect(validators.phone("5555555555")).toBeNull();
    });
  });

  describe("zipCode validator", () => {
    it("returns error for invalid zip code", () => {
      const result = validators.zipCode("123");
      expect(result).toBe("Please enter a valid ZIP code (12345 or 12345-6789)");
    });

    it("returns null for valid 5-digit zip", () => {
      const result = validators.zipCode("12345");
      expect(result).toBeNull();
    });

    it("returns null for valid ZIP+4 format", () => {
      const result = validators.zipCode("12345-6789");
      expect(result).toBeNull();
    });
  });

  describe("ssn validator", () => {
    it("returns error for invalid SSN", () => {
      const result = validators.ssn("123-45-678");
      expect(result).toBe("Please enter a valid SSN (XXX-XX-XXXX)");
    });

    it("returns null for valid SSN", () => {
      const result = validators.ssn("123-45-6789");
      expect(result).toBeNull();
    });
  });

  describe("ein validator", () => {
    it("returns error for invalid EIN", () => {
      const result = validators.ein("12-345678");
      expect(result).toBe("Please enter a valid EIN (XX-XXXXXXX)");
    });

    it("returns null for valid EIN", () => {
      const result = validators.ein("12-3456789");
      expect(result).toBeNull();
    });
  });

  describe("url validator", () => {
    it("returns error for invalid URL", () => {
      const result = validators.url("not a url");
      expect(result).toBe("Please enter a valid URL");
    });

    it("returns null for valid URLs", () => {
      expect(validators.url("https://example.com")).toBeNull();
      expect(validators.url("http://example.com/path")).toBeNull();
    });
  });

  describe("minLength validator", () => {
    const minLength5 = validators.minLength(5);

    it("returns error when string is too short", () => {
      const result = minLength5("abc");
      expect(result).toBe("Must be at least 5 characters");
    });

    it("returns null when string meets minimum", () => {
      const result = minLength5("abcde");
      expect(result).toBeNull();
    });
  });

  describe("maxLength validator", () => {
    const maxLength10 = validators.maxLength(10);

    it("returns error when string is too long", () => {
      const result = maxLength10("12345678901");
      expect(result).toBe("Must be no more than 10 characters");
    });

    it("returns null when string is within limit", () => {
      const result = maxLength10("123456789");
      expect(result).toBeNull();
    });
  });
});

describe("composeValidators", () => {
  it("returns first error from multiple validators", () => {
    const validate = composeValidators(
      validators.required,
      validators.email
    );

    const result = validate("");
    expect(result).toBe("This field is required");
  });

  it("validates through all validators", () => {
    const validate = composeValidators(
      validators.required,
      validators.email
    );

    const result = validate("invalid");
    expect(result).toBe("Please enter a valid email address");
  });

  it("returns null when all validators pass", () => {
    const validate = composeValidators(
      validators.required,
      validators.email
    );

    const result = validate("test@example.com");
    expect(result).toBeNull();
  });
});
