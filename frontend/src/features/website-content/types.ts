export type MediaFraming = { fit: 'cover' | 'contain'; x: number; y: number };
export const DEFAULT_MEDIA_FRAMING: MediaFraming = { fit: 'cover', x: 50, y: 0 };
export interface LandingMedia {
  kind: 'image' | 'video';
  url: string;
  posterUrl: string | null;
  altText: string;
  framing?: MediaFraming;
}
export interface LandingAsset {
  kind: 'image' | 'video';
  publicId?: string;
  url: string;
  bytes: number;
  duration: number | null;
}
export interface LandingConfig {
  asset: LandingAsset | null;
  poster: LandingAsset | null;
  posterUrl?: string | null;
  altText: string;
  framing?: MediaFraming;
}
export interface WebsiteContent {
  revision: number;
  draft: LandingConfig | null;
  published: LandingConfig | null;
  publishedAt: string | null;
}
export function toLandingMedia(config: LandingConfig | null): LandingMedia | null {
  return config?.asset
    ? {
        kind: config.asset.kind,
        url: config.asset.url,
        posterUrl: config.poster?.url ?? config.posterUrl ?? null,
        altText: config.altText,
        framing: config.framing,
      }
    : null;
}

export interface LandingGalleryItem extends LandingAsset {
  publicId: string;
  createdAt: string | null;
  posterUrl: string | null;
}
export interface LandingGalleryPage {
  items: LandingGalleryItem[];
  nextCursor: string | null;
}
