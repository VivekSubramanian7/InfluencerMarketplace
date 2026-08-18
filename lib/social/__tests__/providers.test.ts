import { describe, it, expect } from "vitest";
import { parseYouTubeChannels } from "@/lib/social/providers/youtube";
import { parseTikTokProfile, parseInstagramProfile } from "@/lib/social/providers/scrapecreators";

describe("parseYouTubeChannels", () => {
  it("reads subscriberCount from the first channel item", () => {
    expect(
      parseYouTubeChannels({
        items: [{ statistics: { subscriberCount: "45200", hiddenSubscriberCount: false } }],
      })
    ).toEqual({ followerCount: 45200, avgViews: null, engagementRate: null });
  });

  it("returns null follower count when the channel hides subscribers", () => {
    expect(
      parseYouTubeChannels({
        items: [{ statistics: { subscriberCount: "0", hiddenSubscriberCount: true } }],
      })
    ).toEqual({ followerCount: null, avgViews: null, engagementRate: null });
  });

  it("rejects empty results and malformed payloads", () => {
    expect(parseYouTubeChannels({ items: [] })).toBeNull();
    expect(parseYouTubeChannels({})).toBeNull();
    expect(parseYouTubeChannels(null)).toBeNull();
    expect(parseYouTubeChannels({ items: [{ statistics: { subscriberCount: "abc" } }] })).toBeNull();
    expect(parseYouTubeChannels({ items: [{ statistics: { subscriberCount: "-5" } }] })).toBeNull();
  });
});

describe("parseTikTokProfile", () => {
  it("reads stats.followerCount", () => {
    expect(
      parseTikTokProfile({ stats: { followerCount: 4100000, videoCount: 2017 }, user: {} })
    ).toEqual({ followerCount: 4100000, avgViews: null, engagementRate: null });
  });

  it("rejects malformed payloads", () => {
    expect(parseTikTokProfile({})).toBeNull();
    expect(parseTikTokProfile(null)).toBeNull();
    expect(parseTikTokProfile({ stats: {} })).toBeNull();
    expect(parseTikTokProfile({ stats: { followerCount: "many" } })).toBeNull();
  });
});

describe("parseInstagramProfile", () => {
  it("reads data.user.edge_followed_by.count", () => {
    expect(
      parseInstagramProfile({ data: { user: { edge_followed_by: { count: 25116 } } } })
    ).toEqual({ followerCount: 25116, avgViews: null, engagementRate: null });
  });

  it("rejects malformed payloads", () => {
    expect(parseInstagramProfile({})).toBeNull();
    expect(parseInstagramProfile({ data: {} })).toBeNull();
    expect(parseInstagramProfile({ data: { user: {} } })).toBeNull();
    expect(parseInstagramProfile({ data: { user: { edge_followed_by: {} } } })).toBeNull();
  });
});
