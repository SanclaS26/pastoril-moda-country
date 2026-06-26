const DEFAULT_SITE_URL = 'https://pastoril-moda-country.vercel.app';

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function getPublicSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) {
    return DEFAULT_SITE_URL;
  }

  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return DEFAULT_SITE_URL;
    }

    return normalizeUrl(parsed.toString());
  } catch {
    return DEFAULT_SITE_URL;
  }
}
