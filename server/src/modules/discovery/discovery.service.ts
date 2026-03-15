import { eq, and, sql, ilike, desc } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { NotFoundError } from '../../utils/errors.js';
import type { DiscoveryQuery } from './discovery.schemas.js';

function discoveryServerToResponse(server: typeof schema.servers.$inferSelect) {
  return {
    id: server.id.toString(),
    name: server.name,
    iconUrl: server.iconUrl,
    bannerUrl: server.bannerUrl,
    description: server.description,
    categories: server.categories ?? [],
    memberCount: server.memberCount ?? 0,
    primaryLanguage: server.primaryLanguage ?? 'en',
  };
}

export async function getDiscoverableServers(query: DiscoveryQuery) {
  const db = getDb();
  const { search, category, sort, page, limit } = query;
  const offset = (page - 1) * limit;

  const conditions = [eq(schema.servers.isDiscoverable, true)];

  if (category) {
    // Filter servers that have this category in their categories array
    conditions.push(sql`${schema.servers.categories} @> ARRAY[${category}]::text[]`);
  }

  if (search) {
    conditions.push(
      ilike(schema.servers.name, `%${search}%`),
    );
  }

  const whereClause = and(...conditions);

  const orderBy =
    sort === 'newest'
      ? desc(schema.servers.createdAt)
      : desc(schema.servers.memberCount);

  const servers = await db
    .select()
    .from(schema.servers)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.servers)
    .where(whereClause);

  return {
    servers: servers.map(discoveryServerToResponse),
    total: countResult.count,
    page,
    limit,
  };
}

export async function getDiscoveryServer(serverId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);

  const server = await db.query.servers.findFirst({
    where: and(
      eq(schema.servers.id, serverIdBigInt),
      eq(schema.servers.isDiscoverable, true),
    ),
  });

  if (!server) {
    throw new NotFoundError('Server not found or not discoverable');
  }

  return discoveryServerToResponse(server);
}
