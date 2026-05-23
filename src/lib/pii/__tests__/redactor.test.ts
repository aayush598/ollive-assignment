import { describe, it, expect } from "vitest";
import { redactPII } from "../redactor";

describe("redactPII", () => {
  it("should redact email addresses", () => {
    const result = redactPII("Contact me at john@example.com");
    expect(result.redacted).toBe("Contact me at [EMAIL_REDACTED]");
    expect(result.hasPII).toBe(true);
    expect(result.redactedCount).toBe(1);
  });

  it("should redact phone numbers", () => {
    const result = redactPII("Call me at (555) 123-4567");
    expect(result.redacted).toBe("Call me at [PHONE_REDACTED]");
    expect(result.hasPII).toBe(true);
  });

  it("should redact SSN", () => {
    const result = redactPII("My SSN is 123-45-6789");
    expect(result.redacted).toBe("My SSN is [SSN_REDACTED]");
    expect(result.hasPII).toBe(true);
  });

  it("should redact credit card numbers", () => {
    const result = redactPII("Card: 4111-1111-1111-1111");
    expect(result.redacted).toBe("Card: [CC_REDACTED]");
    expect(result.hasPII).toBe(true);
  });

  it("should handle text with no PII", () => {
    const result = redactPII("Hello, how are you doing today?");
    expect(result.redacted).toBe("Hello, how are you doing today?");
    expect(result.hasPII).toBe(false);
    expect(result.redactedCount).toBe(0);
  });

  it("should handle multiple PII instances", () => {
    const result = redactPII("Email: a@b.com, Phone: 555-123-4567");
    expect(result.redacted).toBe("Email: [EMAIL_REDACTED], Phone: [PHONE_REDACTED]");
    expect(result.hasPII).toBe(true);
    expect(result.redactedCount).toBe(2);
  });

  it("should handle empty string", () => {
    const result = redactPII("");
    expect(result.redacted).toBe("");
    expect(result.hasPII).toBe(false);
    expect(result.redactedCount).toBe(0);
  });
});
