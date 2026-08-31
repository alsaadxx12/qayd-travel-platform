import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';

const logger = new Logger('VoucherWrite');

/**
 * Prisma validation dumps (`Unknown argument`, `new Prisma.Decimal(...)`) must never
 * reach the browser. The client shows `error.message` as the notification body.
 */
export function rethrowVoucherWriteError(err: unknown, fallback: string): never {
  if (err instanceof BadRequestException || err instanceof NotFoundException) {
    throw err;
  }

  const anyErr = err as { code?: string; name?: string; message?: string };
  logger.error(anyErr?.message || err);

  if (anyErr?.code === 'P2002') {
    throw new BadRequestException(
      'رقم السند أو رقم القيد مستخدم مسبقاً في النظام. أعد الحفظ ليُعطى رقماً جديداً.',
    );
  }
  if (anyErr?.code === 'P2003') {
    throw new BadRequestException('أحد الحسابات أو الكيانات المحددة غير موجود في قاعدة البيانات.');
  }

  throw new BadRequestException(fallback);
}
