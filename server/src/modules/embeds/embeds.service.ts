import { eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import type { Embed } from '@harmonium/shared';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';

// ===== Constants =====

const URL_REGEX = /https?:\/\/[^\s<>]+/g;
const MAX_URLS_PER_MESSAGE = 5;
const FETCH_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1024 * 1024; // 1MB
const USER_AGENT = 'HarmoniumBot/1.0 (+https://harmonium.chat)';

// Private/reserved IP ranges for SSRF prevention
const PRIVATE_IP_RANGES = [
  // IPv4
  { prefix: '127.', exact: false },       // 127.0.0.0/8
  { prefix: '10.', exact: false },        // 10.0.0.0/8
  { prefix: '0.', exact: false },         // 0.0.0.0/8
  { prefix: '169.254.', exact: false },   // 169.254.0.0/16
  // 172.16.0.0/12 — checked separately
  // 192.168.0.0/16
  { prefix: '192.168.', exact: false },
  // IPv6
  { prefix: '::1', exact: true },
  { prefix: '::ffff:127.', exact: false },
  { prefix: 'fe80:', exact: false },      // link-local
];

function isPrivateIp(ip: string): boolean {
  // Normalize IPv6-mapped IPv4
  const normalized = ip.replace(/^::ffff:/, '');

  for (const range of PRIVATE_IP_RANGES) {
    if (range.exact) {
      if (normalized === range.prefix) return true;
    } else {
      if (normalized.startsWith(range.prefix)) return true;
    }
  }

  // Check 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
  const parts = normalized.split('.');
  if (parts.length === 4 && parts[0] === '172') {
    const second = parseInt(parts[1], 10);
    if (second >= 16 && second <= 31) return true;
  }

  // Check fc00::/7 (IPv6 unique local addresses)
  if (normalized.toLowerCase().startsWith('fc') || normalized.toLowerCase().startsWith('fd')) {
    return true;
  }

  return false;
}

async function isUrlSafe(urlString: string): Promise<boolean> {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname;

    // If hostname is an IP literal, check directly
    if (net.isIP(hostname)) {
      return !isPrivateIp(hostname);
    }

    // Resolve hostname and check all IPs
    try {
      const addresses = await dns.resolve4(hostname);
      for (const addr of addresses) {
        if (isPrivateIp(addr)) return false;
      }
    } catch {
      // If IPv4 resolution fails, try IPv6
    }

    try {
      const addresses = await dns.resolve6(hostname);
      for (const addr of addresses) {
        if (isPrivateIp(addr)) return false;
      }
    } catch {
      // If both fail, we'll let the fetch attempt handle it
    }

    return true;
  } catch {
    return false;
  }
}

// ===== HTML Meta Tag Parsing =====

function extractMetaContent(html: string, property: string): string | null {
  // Match <meta property="og:title" content="..." /> or <meta name="twitter:title" content="..." />
  // Also handle content before property/name attribute
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRegex(property)}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escapeRegex(property)}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }

  return null;
}

function extractThemeColor(html: string): string | null {
  const patterns = [
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']theme-color["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const color = match[1].trim();
      // Validate hex color format
      if (/^#[0-9a-fA-F]{6}$/.test(color) || /^#[0-9a-fA-F]{3}$/.test(color)) {
        return color.length === 4
          ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
          : color;
      }
    }
  }

  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (match?.[1]) {
    return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'");
}

function parseMetaTags(html: string, url: string): {
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  color: string | null;
} {
  // Only parse the <head> section for efficiency
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch?.[1] ?? html.slice(0, 50000); // Fallback to first 50K chars

  // Extract OG tags first, fall back to Twitter cards, then basic HTML
  const title =
    extractMetaContent(headHtml, 'og:title') ??
    extractMetaContent(headHtml, 'twitter:title') ??
    extractTitle(headHtml);

  const description =
    extractMetaContent(headHtml, 'og:description') ??
    extractMetaContent(headHtml, 'twitter:description') ??
    extractMetaContent(headHtml, 'description');

  const siteName = extractMetaContent(headHtml, 'og:site_name');

  let imageUrl =
    extractMetaContent(headHtml, 'og:image') ??
    extractMetaContent(headHtml, 'twitter:image');

  // Resolve relative image URLs
  if (imageUrl && !imageUrl.startsWith('http')) {
    try {
      imageUrl = new URL(imageUrl, url).href;
    } catch {
      imageUrl = null;
    }
  }

  const color = extractThemeColor(headHtml);

  return { title, description, siteName, imageUrl, color };
}

// ===== Embed Fetching =====

async function fetchUrlMetadata(url: string): Promise<{
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  color: string | null;
  type: 'link' | 'image';
} | null> {
  try {
    // SSRF check
    const safe = await isUrlSafe(url);
    if (!safe) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html, application/xhtml+xml',
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!response.ok) return null;

      const contentType = response.headers.get('content-type') ?? '';

      // Direct image URL
      if (contentType.startsWith('image/')) {
        return {
          title: null,
          description: null,
          siteName: null,
          imageUrl: url,
          color: null,
          type: 'image',
        };
      }

      // Only parse HTML responses
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        return null;
      }

      // Read response body with size limit
      const reader = response.body?.getReader();
      if (!reader) return null;

      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        totalSize += value.length;

        if (totalSize >= MAX_RESPONSE_BYTES) {
          reader.cancel();
          break;
        }
      }

      const decoder = new TextDecoder('utf-8', { fatal: false });
      const html = decoder.decode(Buffer.concat(chunks));

      const meta = parseMetaTags(html, url);

      // Skip if no useful metadata found
      if (!meta.title && !meta.description && !meta.imageUrl) {
        return null;
      }

      return { ...meta, type: 'link' };
    } catch {
      clearTimeout(timeout);
      return null;
    }
  } catch {
    return null;
  }
}

// ===== Public API =====

function embedToResponse(row: typeof schema.embeds.$inferSelect): Embed {
  return {
    id: row.id.toString(),
    url: row.url,
    type: row.type as Embed['type'],
    title: row.title ?? null,
    description: row.description ?? null,
    siteName: row.siteName ?? null,
    imageUrl: row.imageUrl ?? null,
    imageWidth: row.imageWidth ?? null,
    imageHeight: row.imageHeight ?? null,
    color: row.color ?? null,
  };
}

export async function fetchAndStoreEmbeds(
  messageId: bigint,
  content: string,
  channelId: string,
  serverId: string,
): Promise<void> {
  // Extract URLs from content
  const urlMatches = content.match(URL_REGEX);
  if (!urlMatches || urlMatches.length === 0) return;

  // Deduplicate and limit
  const uniqueUrls = [...new Set(urlMatches)].slice(0, MAX_URLS_PER_MESSAGE);

  // Fetch metadata for all URLs in parallel
  const results = await Promise.allSettled(
    uniqueUrls.map((url) => fetchUrlMetadata(url)),
  );

  const db = getDb();
  const embedRows: Embed[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status !== 'fulfilled' || !result.value) continue;

    const meta = result.value;
    const embedId = generateId();

    await db.insert(schema.embeds).values({
      id: embedId,
      messageId,
      url: uniqueUrls[i],
      type: meta.type,
      title: meta.title ? meta.title.slice(0, 256) : null,
      description: meta.description ? meta.description.slice(0, 4000) : null,
      siteName: meta.siteName ? meta.siteName.slice(0, 100) : null,
      imageUrl: meta.imageUrl ? meta.imageUrl.slice(0, 2048) : null,
      imageWidth: null,
      imageHeight: null,
      color: meta.color ?? null,
    });

    embedRows.push({
      id: embedId.toString(),
      url: uniqueUrls[i],
      type: meta.type,
      title: meta.title ? meta.title.slice(0, 256) : null,
      description: meta.description ? meta.description.slice(0, 4000) : null,
      siteName: meta.siteName ? meta.siteName.slice(0, 100) : null,
      imageUrl: meta.imageUrl ? meta.imageUrl.slice(0, 2048) : null,
      imageWidth: null,
      imageHeight: null,
      color: meta.color ?? null,
    });
  }

  if (embedRows.length === 0) return;

  // Broadcast MESSAGE_EMBED_UPDATE via pubsub
  const pubsub = getPubSubManager();
  pubsub.publishToServer(serverId, {
    op: 'MESSAGE_EMBED_UPDATE',
    d: {
      channelId,
      messageId: messageId.toString(),
      embeds: embedRows,
    },
  });
}

export async function getEmbedsForMessages(messageIds: bigint[]): Promise<Map<string, Embed[]>> {
  if (messageIds.length === 0) return new Map();

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.embeds)
    .where(inArray(schema.embeds.messageId, messageIds));

  const map = new Map<string, Embed[]>();
  for (const row of rows) {
    const key = row.messageId.toString();
    const existing = map.get(key);
    const embed = embedToResponse(row);
    if (existing) {
      existing.push(embed);
    } else {
      map.set(key, [embed]);
    }
  }

  return map;
}
