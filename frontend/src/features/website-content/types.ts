export interface LandingMedia {
  kind: 'image' | 'video';
  url: string;
  posterUrl: string | null;
  altText: string;
}
export interface LandingAsset {
  kind: 'image' | 'video';
  url: string;
  bytes: number;
  duration: number | null;
}
export interface LandingConfig {
  asset: LandingAsset | null;
  poster: LandingAsset | null;
  altText: string;
}
export interface WebsiteContent {
  revision: number;
  draft: LandingConfig | null;
  published: LandingConfig | null;
  publishedAt: string | null;
}
export function toLandingMedia(config: LandingConfig | null): LandingMedia | null {
  return config?.asset
    ? { kind: config.asset.kind, url: config.asset.url, posterUrl: config.poster?.url ?? null, altText: config.altText }
    : null;
}
