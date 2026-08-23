import { describe, expect, it } from "vitest";
import { validateDocument } from "./documents";

describe("validateDocument", () => {
  it("accepts a small PDF", () => {
    expect(validateDocument({ name: "notes.pdf", size: 1024, type: "application/pdf" })).toBeNull();
  });

  it("rejects unsupported and oversized files", () => {
    expect(validateDocument({ name: "script.exe", size: 1024, type: "application/octet-stream" })).toMatch(/Choose/);
    expect(validateDocument({ name: "slides.pdf", size: 11 * 1024 * 1024, type: "application/pdf" })).toMatch(/10 MB/);
  });
});
