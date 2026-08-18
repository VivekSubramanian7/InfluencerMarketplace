import { describe, it, expect } from "vitest";
import { parseSocialHandle, suggestFromProfileUrl } from "@/lib/social/handle";

describe("parseSocialHandle", () => {
  it("accepts bare handles and strips @", () => {
    expect(parseSocialHandle("youtube", "caseyclips")).toBe("caseyclips");
    expect(parseSocialHandle("youtube", "@caseyclips")).toBe("caseyclips");
    expect(parseSocialHandle("tiktok", " @casey.clips ")).toBe("casey.clips");
  });

  it("lowercases input", () => {
    expect(parseSocialHandle("instagram", "CaseyClips")).toBe("caseyclips");
    expect(parseSocialHandle("youtube", "@MKBHD")).toBe("mkbhd");
  });

  it("extracts handles from profile URLs of the matching platform", () => {
    expect(parseSocialHandle("youtube", "https://www.youtube.com/@caseyclips")).toBe("caseyclips");
    expect(parseSocialHandle("tiktok", "https://www.tiktok.com/@casey.clips")).toBe("casey.clips");
    expect(parseSocialHandle("instagram", "https://instagram.com/caseyclips/")).toBe("caseyclips");
    expect(parseSocialHandle("instagram", "https://instagr.am/caseyclips")).toBe("caseyclips");
  });

  it("ignores query strings and trailing slashes in URLs", () => {
    expect(parseSocialHandle("youtube", "https://youtube.com/@caseyclips/?utm=x")).toBe("caseyclips");
    expect(parseSocialHandle("tiktok", "https://www.tiktok.com/@casey?lang=en")).toBe("casey");
  });

  it("rejects URLs from a different platform", () => {
    expect(parseSocialHandle("instagram", "https://youtube.com/@caseyclips")).toBeNull();
    expect(parseSocialHandle("youtube", "https://tiktok.com/@caseyclips")).toBeNull();
  });

  it("rejects lookalike domains", () => {
    expect(parseSocialHandle("youtube", "https://notyoutube.com/@x")).toBeNull();
    expect(parseSocialHandle("youtube", "https://youtube.com.evil.com/@x")).toBeNull();
  });

  it("rejects invalid characters and length bounds", () => {
    expect(parseSocialHandle("youtube", "has spaces")).toBeNull();
    expect(parseSocialHandle("tiktok", "a")).toBeNull();
    expect(parseSocialHandle("tiktok", "a".repeat(25))).toBeNull();
    expect(parseSocialHandle("instagram", "a".repeat(31))).toBeNull();
    expect(parseSocialHandle("youtube", "")).toBeNull();
    expect(parseSocialHandle("youtube", "@")).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(parseSocialHandle("youtube", "https://")).toBeNull();
    expect(parseSocialHandle("youtube", "https://youtube.com/")).toBeNull();
  });
});

describe("suggestFromProfileUrl", () => {
  it("suggests the platform for a pasted profile URL", () => {
    expect(suggestFromProfileUrl("https://www.youtube.com/@caseyclips")).toEqual({
      platform: "youtube",
      handle: "caseyclips",
    });
    expect(suggestFromProfileUrl("https://www.tiktok.com/@casey.clips")).toEqual({
      platform: "tiktok",
      handle: "casey.clips",
    });
  });

  it("returns null for non-URLs and unknown hosts", () => {
    expect(suggestFromProfileUrl("caseyclips")).toBeNull();
    expect(suggestFromProfileUrl("https://vimeo.com/caseyclips")).toBeNull();
  });
});
