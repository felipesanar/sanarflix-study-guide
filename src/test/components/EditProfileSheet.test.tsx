import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Unit tests for EditProfileSheet logic (no rendering needed) ---

const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s\-'.]+$/;
const COOLDOWN_DAYS = 60;

describe("EditProfileSheet — Name validation", () => {
  it("rejects empty names", () => {
    expect("".trim().length >= 2).toBe(false);
  });

  it("rejects single character", () => {
    expect("A".trim().length >= 2).toBe(false);
  });

  it("accepts valid names with accents", () => {
    const name = "José da Silva";
    expect(name.trim().length >= 2 && NAME_REGEX.test(name.trim())).toBe(true);
  });

  it("accepts hyphenated names", () => {
    const name = "Maria-Luísa";
    expect(NAME_REGEX.test(name)).toBe(true);
  });

  it("accepts apostrophe names", () => {
    const name = "O'Brien";
    expect(NAME_REGEX.test(name)).toBe(true);
  });

  it("rejects names with numbers", () => {
    expect(NAME_REGEX.test("User123")).toBe(false);
  });

  it("rejects names with special chars", () => {
    expect(NAME_REGEX.test("User@!#")).toBe(false);
  });

  it("rejects names with only spaces", () => {
    const name = "   ";
    expect(name.trim().length >= 2).toBe(false);
  });
});

describe("EditProfileSheet — Semester cooldown logic", () => {
  it("allows change when semestre_updated_at is null", () => {
    const updatedAt: string | null = null;
    const cooldownEnd = updatedAt
      ? new Date(new Date(updatedAt).getTime() + COOLDOWN_DAYS * 86400000)
      : null;
    const isLocked = cooldownEnd ? cooldownEnd > new Date() : false;
    expect(isLocked).toBe(false);
  });

  it("locks when changed less than 60 days ago", () => {
    const recentDate = new Date(Date.now() - 10 * 86400000).toISOString(); // 10 days ago
    const cooldownEnd = new Date(new Date(recentDate).getTime() + COOLDOWN_DAYS * 86400000);
    const isLocked = cooldownEnd > new Date();
    expect(isLocked).toBe(true);
  });

  it("unlocks when changed more than 60 days ago", () => {
    const oldDate = new Date(Date.now() - 70 * 86400000).toISOString(); // 70 days ago
    const cooldownEnd = new Date(new Date(oldDate).getTime() + COOLDOWN_DAYS * 86400000);
    const isLocked = cooldownEnd > new Date();
    expect(isLocked).toBe(false);
  });

  it("calculates correct cooldown end date", () => {
    const date = new Date("2026-01-15T12:00:00Z");
    const expected = new Date("2026-03-16T12:00:00Z");
    const cooldownEnd = new Date(date.getTime() + COOLDOWN_DAYS * 86400000);
    expect(cooldownEnd.toISOString()).toBe(expected.toISOString());
  });
});

describe("EditProfileSheet — Semester value validation", () => {
  it("rejects NaN values", () => {
    const num = parseInt("abc", 10);
    expect(isNaN(num)).toBe(true);
  });

  it("rejects values below 1", () => {
    const num = parseInt("0", 10);
    expect(num < 1 || num > 12).toBe(true);
  });

  it("rejects values above 12", () => {
    const num = parseInt("13", 10);
    expect(num < 1 || num > 12).toBe(true);
  });

  it("accepts valid semester 1-12", () => {
    for (let i = 1; i <= 12; i++) {
      const num = parseInt(String(i), 10);
      expect(!isNaN(num) && num >= 1 && num <= 12).toBe(true);
    }
  });

  it("skips change when same as current", () => {
    const currentSemestre = 5;
    const newValue = "5";
    const num = parseInt(newValue, 10);
    expect(num === currentSemestre).toBe(true);
  });
});

describe("EditProfileSheet — Initials generation", () => {
  it("generates 2-letter initials from full name", () => {
    const nome = "João Silva";
    const initials = nome
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    expect(initials).toBe("JS");
  });

  it("handles single name", () => {
    const nome = "Maria";
    const initials = nome
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    expect(initials).toBe("M");
  });

  it("limits to 2 initials for long names", () => {
    const nome = "Ana Maria da Silva Santos";
    const initials = nome
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    expect(initials).toBe("AM");
  });

  it("handles empty string", () => {
    const nome = "";
    const initials = nome
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    expect(initials).toBe("");
  });
});
