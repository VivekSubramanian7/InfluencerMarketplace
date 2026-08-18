import { describe, it, expect } from "vitest";
import {
  parseYouTubeChannels,
  parseYouTubeUploadsPlaylist,
  parseYouTubePlaylistItems,
  parseYouTubeVideoStats,
} from "@/lib/social/providers/youtube";
import {
  parseTikTokProfile,
  parseInstagramProfile,
  parseTikTokVideos,
  parseInstagramPosts,
} from "@/lib/social/providers/scrapecreators";

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

describe("parseTikTokVideos", () => {
  it("maps aweme_list statistics to video stats", () => {
    expect(
      parseTikTokVideos({
        aweme_list: [
          { statistics: { play_count: 141567, digg_count: 18651, comment_count: 152, share_count: 237 } },
          { statistics: { play_count: 900, digg_count: 45, comment_count: 3, share_count: 1 } },
        ],
      })
    ).toEqual([
      { views: 141567, likes: 18651, comments: 152, shares: 237 },
      { views: 900, likes: 45, comments: 3, shares: 1 },
    ]);
  });

  it("returns empty for malformed payloads", () => {
    expect(parseTikTokVideos({})).toEqual([]);
    expect(parseTikTokVideos(null)).toEqual([]);
    expect(parseTikTokVideos({ aweme_list: [{ no_stats: true }] })).toEqual([]);
  });
});

describe("parseInstagramPosts", () => {
  it("maps items to video stats, photo posts get null views", () => {
    expect(
      parseInstagramPosts({
        items: [
          { like_count: 387, comment_count: 12, play_count: 35499, media_type: 2 },
          { like_count: 120, comment_count: 4, media_type: 1 },
          { like_count: 50, comment_count: 2, ig_play_count: 8000 },
        ],
      })
    ).toEqual([
      { views: 35499, likes: 387, comments: 12 },
      { views: null, likes: 120, comments: 4 },
      { views: 8000, likes: 50, comments: 2 },
    ]);
  });

  it("returns empty for malformed payloads", () => {
    expect(parseInstagramPosts({})).toEqual([]);
    expect(parseInstagramPosts(null)).toEqual([]);
  });
});

describe("YouTube uploads chain parsers", () => {
  it("extracts the uploads playlist id", () => {
    expect(
      parseYouTubeUploadsPlaylist({
        items: [{ contentDetails: { relatedPlaylists: { uploads: "UUabc123" } } }],
      })
    ).toBe("UUabc123");
    expect(parseYouTubeUploadsPlaylist({ items: [] })).toBeNull();
    expect(parseYouTubeUploadsPlaylist({})).toBeNull();
  });

  it("extracts recent video ids", () => {
    expect(
      parseYouTubePlaylistItems({
        items: [
          { contentDetails: { videoId: "vid1" } },
          { contentDetails: { videoId: "vid2" } },
          { contentDetails: {} },
        ],
      })
    ).toEqual(["vid1", "vid2"]);
    expect(parseYouTubePlaylistItems({})).toEqual([]);
  });

  it("extracts per-video statistics", () => {
    expect(
      parseYouTubeVideoStats({
        items: [
          { statistics: { viewCount: "5000", likeCount: "250", commentCount: "30" } },
          { statistics: { viewCount: "abc" } },
        ],
      })
    ).toEqual([
      { views: 5000, likes: 250, comments: 30 },
      { views: null, likes: null, comments: null },
    ]);
    expect(parseYouTubeVideoStats({})).toEqual([]);
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
