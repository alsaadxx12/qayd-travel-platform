import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    const connectionLimit = process.env.PRISMA_CONNECTION_LIMIT || '10';
    const poolTimeout = process.env.PRISMA_POOL_TIMEOUT || '20';
    const separator = databaseUrl?.includes('?') ? '&' : '?';
    const boundedDatabaseUrl = databaseUrl && !databaseUrl.includes('connection_limit=')
      ? `${databaseUrl}${separator}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`
      : databaseUrl;

    super(boundedDatabaseUrl
      ? { datasources: { db: { url: boundedDatabaseUrl } } }
      : undefined);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
