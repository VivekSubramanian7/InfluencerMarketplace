// lib/notifications/telegram.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must stub fetch before importing the module
const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal("fetch", fetchSpy);

describe("sendTelegramMessage", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_CHAT_ID: "123" };
    fetchSpy.mockClear();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("calls Telegram API with correct payload", async () => {
    // Re-import to pick up env
    const { sendTelegramMessage } = await import("./telegram");
    await sendTelegramMessage("Hello agency");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
    expect(JSON.parse(opts.body)).toEqual({
      chat_id: "123",
      text: "Hello agency",
      parse_mode: "HTML",
    });
  });

  it("does nothing when env vars are missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    // Force re-import
    vi.resetModules();
    const { sendTelegramMessage } = await import("./telegram");
    await sendTelegramMessage("Should not send");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
