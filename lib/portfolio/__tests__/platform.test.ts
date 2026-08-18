import { describe, it, expect } from "vitest";
import { detectPlatform } from "@/lib/portfolio/platform";

describe("detectPlatform", () => {
  it("detects YouTube including short links and subdomains", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=abc").key).toBe("youtube");
    expect(detectPlatform("https://youtu.be/abc").key).toBe("youtube");
    expect(detectPlatform("https://m.youtube.com/shorts/abc").key).toBe("youtube");
  });

  it("detects TikTok", () => {
    expect(detectPlatform("https://www.tiktok.com/@user/video/123").key).toBe("tiktok");
    expect(detectPlatform("https://vm.tiktok.com/ZM123/").key).toBe("tiktok");
  });

  it("detects Instagram", () => {
    expect(detectPlatform("https://www.instagram.com/reel/abc/").key).toBe("instagram");
    expect(detectPlatform("https://instagr.am/p/abc").key).toBe("instagram");
  });

  it("does not match lookalike domains", () => {
    expect(detectPlatform("https://notyoutube.com/watch").key).toBe("other");
    expect(detectPlatform("https://youtube.com.evil.com/x").key).toBe("other");
  });

  it("falls back to Web for anything else or invalid input", () => {
    expect(detectPlatform("https://vimeo.com/123")).toEqual({ key: "other", label: "Web" });
    expect(detectPlatform("not a url").key).toBe("other");
  });
});
