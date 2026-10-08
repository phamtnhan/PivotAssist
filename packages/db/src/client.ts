import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

let prismaClient: PrismaClient | undefined;

/**
 * Create the native Prisma client only when a server request actually needs
 * the database. This keeps Next.js static generation from loading the native
 * query engine while preserving the existing `prisma.*` call sites.
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient =
      globalForPrisma.prisma ||
      new PrismaClient({
        // Query logging prints every SQL to the Next terminal (CPU + I/O on each navigation).
        log: process.env.PRISMA_LOG_QUERIES === "1" ? ["query", "error", "warn"] : ["error"],
      });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prismaClient;
    }
  }

  return prismaClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export * from "@prisma/client";
