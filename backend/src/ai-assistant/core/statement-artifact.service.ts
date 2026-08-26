import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface StatementArtifact {
  buffer: Buffer;
  companyId: string;
  userId: string;
  filename: string;
  expiresAt: number;
}

@Injectable()
export class StatementArtifactService {
  private readonly items = new Map<string, StatementArtifact>();
  private readonly ttlMs = 30 * 60 * 1000;

  put(params: { buffer: Buffer; companyId: string; userId: string; filename: string }): string {
    this.gc();
    const id = randomUUID();
    this.items.set(id, {
      buffer: params.buffer,
      companyId: params.companyId,
      userId: params.userId,
      filename: params.filename,
      expiresAt: Date.now() + this.ttlMs,
    });
    return id;
  }

  getOwned(id: string, companyId: string, userId: string): StatementArtifact {
    const item = this.items.get(id);
    if (!item || item.expiresAt < Date.now() || item.companyId !== companyId || item.userId !== userId) {
      throw new NotFoundException('انتهت صلاحية ملف الكشف. أعد توليد كشف PDF من المحادثة.');
    }
    return item;
  }

  private gc() {
    const now = Date.now();
    for (const [id, item] of this.items) {
      if (item.expiresAt < now) this.items.delete(id);
    }
  }
}
