import type { Metadata } from "next";

type OpenGraphMetadata = NonNullable<Metadata["openGraph"]>;
type TwitterMetadata = NonNullable<Metadata["twitter"]>;

const DEFAULT_SITE_URL = "http://localhost:3000";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function withProtocolIfMissing(value: string): string {
  return /^https?:\/\//.test(value) ? value : `https://${value}`;
}

export function resolveMetadataBase(): URL {
  const explicitSiteUrl = process.env.SITE_URL;
  const vercelSiteUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

  const siteUrl = explicitSiteUrl
    ? explicitSiteUrl
    : vercelSiteUrl
      ? withProtocolIfMissing(vercelSiteUrl)
      : DEFAULT_SITE_URL;

  return new URL(trimTrailingSlash(siteUrl));
}

export const sharedOpenGraph = {
  url: "/",
  siteName: "Narvis",
  locale: "ko_KR",
  type: "website",
  images: [
    {
      url: "/og-image.png",
      width: 1731,
      height: 909,
      alt: "Narvis AI 쇼핑 에이전트",
    },
  ],
} satisfies OpenGraphMetadata;

export const sharedTwitter = {
  card: "summary_large_image",
  images: ["/og-image.png"],
} satisfies TwitterMetadata;
