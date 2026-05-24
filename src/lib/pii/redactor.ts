const PII_PATTERNS: { regex: RegExp; replacement: string }[] = [
  { regex: /\b[\w.-]+@[\w.-]+\.\w+\b/g, replacement: "[EMAIL_REDACTED]" },
  {
    regex: /(?:\b|\()(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: "[PHONE_REDACTED]",
  },
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN_REDACTED]" },
  { regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: "[CC_REDACTED]" },
  { regex: /\b[A-Z]{2}\d{6,10}\b/g, replacement: "[DL_REDACTED]" },
  { regex: /\b\d{5}(?:-\d{4})?\b/g, replacement: "[ZIP_REDACTED]" },
];

export interface PIIResult {
  redacted: string;
  hasPII: boolean;
  redactedCount: number;
}

export function redactPII(text: string): PIIResult {
  let redactedCount = 0;
  let result = text;

  for (const { regex, replacement } of PII_PATTERNS) {
    const matches = result.match(regex);
    if (matches) {
      redactedCount += matches.length;
    }
    result = result.replace(regex, replacement);
  }

  return {
    redacted: result,
    hasPII: redactedCount > 0,
    redactedCount,
  };
}
