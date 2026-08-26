import { Injectable, OnModuleInit, OnModuleDestroy, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

export interface PdfGenerateOptions {
  html: string;
  lang?: 'ar' | 'en';
  format?: 'A4' | 'Letter';
  landscape?: boolean;
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
  headerHtml?: string;
  footerHtml?: string;
  printBackground?: boolean;
}

/** Hard ceiling for one PDF request. Nothing in this service may outlive it. */
const PDF_DEADLINE_MS = Number(process.env.PDF_TIMEOUT_MS || 40_000);
/** Chromium launch must not block a request forever either. */
const LAUNCH_TIMEOUT_MS = Number(process.env.PDF_LAUNCH_TIMEOUT_MS || 45_000);
/** setContent / page.pdf step budgets. */
const SET_CONTENT_TIMEOUT_MS = 20_000;
const RENDER_TIMEOUT_MS = 25_000;
/** In-page waits for webfonts and images — bounded so a blocked asset can't stall the render. */
const FONTS_WAIT_MS = 2_500;
const IMAGES_WAIT_MS = 4_000;

class PdfTimeoutError extends Error {
  constructor(public readonly step: string, public readonly ms: number) {
    super(`PDF timeout at "${step}" after ${ms}ms`);
    this.name = 'PdfTimeoutError';
  }
}

/**
 * Rejects when `ms` elapses instead of waiting forever.
 * Every Puppeteer await in this file goes through here: a wedged Chromium
 * (or an asset URL that never answers) must surface as an error, never as a
 * request that hangs and leaves the caller's UI spinning.
 */
function withDeadline<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new PdfTimeoutError(step, ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private browser: puppeteer.Browser | null = null;
  private launching: Promise<puppeteer.Browser> | null = null;
  private readonly logger = new Logger(PdfService.name);

  private getPuppeteerArgs(): string[] {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--hide-scrollbars',
      '--mute-audio',
      '--font-render-hinting=none',
    ];
    // --single-process (with --no-zygote) halves memory but is a known source of
    // deadlocks inside page.pdf(). Off by default; opt in only on tiny instances.
    if (process.env.PDF_SINGLE_PROCESS === '1') {
      args.push('--single-process', '--no-zygote');
    }
    return args;
  }

  onModuleInit() {
    // Warm up in the BACKGROUND. Chromium can take tens of seconds to launch — or
    // stall outright when it was never downloaded — and Nest does not start
    // listening until onModuleInit resolves. Awaiting it here would leave the whole
    // API unreachable (every route answering 502 through a dev proxy) until the
    // browser settles. PDF requests launch it on demand anyway.
    void this.getBrowser()
      .then(() => this.logger.log('Puppeteer browser launched successfully'))
      .catch((error: any) =>
        this.logger.error(
          `Puppeteer warm-up failed — PDF export will retry on demand: ${error?.message || error}`,
        ),
      );
  }

  async onModuleDestroy() {
    await this.disposeBrowser();
  }

  private async disposeBrowser() {
    const browser = this.browser;
    this.browser = null;
    this.launching = null;
    if (!browser) return;
    try {
      await withDeadline(browser.close(), 5_000, 'browser.close');
    } catch {
      try {
        browser.process()?.kill('SIGKILL');
      } catch {
        /* already gone */
      }
    }
    this.logger.log('Puppeteer browser closed');
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    // Concurrent requests share one launch instead of spawning several Chromiums.
    if (!this.launching) {
      this.launching = withDeadline(
        puppeteer.launch({ headless: true, args: this.getPuppeteerArgs() }),
        LAUNCH_TIMEOUT_MS,
        'browser.launch',
      )
        .then((browser) => {
          this.browser = browser;
          browser.once('disconnected', () => {
            if (this.browser === browser) this.browser = null;
          });
          return browser;
        })
        .finally(() => {
          this.launching = null;
        });
    }
    return this.launching;
  }

  /**
   * Opens a page, runs `work`, and always tears the page down.
   * A timeout is treated as a poisoned browser: it is destroyed so the next
   * request starts from a clean Chromium instead of queueing behind a stuck one.
   */
  private async onPage<T>(step: string, work: (page: puppeteer.Page) => Promise<T>): Promise<T> {
    const browser = await this.getBrowser();
    const page = await withDeadline(browser.newPage(), 15_000, 'browser.newPage');
    page.setDefaultTimeout(RENDER_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(SET_CONTENT_TIMEOUT_MS);

    try {
      return await withDeadline(work(page), PDF_DEADLINE_MS, step);
    } catch (err: any) {
      if (err instanceof PdfTimeoutError) {
        this.logger.error(`${err.message} — recycling Chromium`);
        void this.disposeBrowser();
        throw new HttpException(
          'تعذر توليد ملف PDF: تجاوزت عملية الطباعة المهلة المسموحة. أعد المحاولة، وإن تكرر الأمر تحقق من شعار الشركة أو الصور الخارجية في قالب الطباعة.',
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      throw err;
    } finally {
      try {
        await withDeadline(page.close(), 5_000, 'page.close');
      } catch {
        /* page already gone with the browser */
      }
    }
  }

  /** Wait for webfonts, but never longer than FONTS_WAIT_MS. */
  private async settleFonts(page: puppeteer.Page) {
    try {
      await withDeadline(
        page.evaluate(async (budget: number) => {
          await Promise.race([
            document.fonts.ready.then(() => undefined),
            new Promise<void>((resolve) => setTimeout(resolve, budget)),
          ]);
          return true;
        }, FONTS_WAIT_MS),
        FONTS_WAIT_MS + 2_000,
        'fonts.ready',
      );
    } catch (err: any) {
      this.logger.warn(`Font settle skipped: ${err?.message || err}`);
    }
  }

  /** Wait for images, but never longer than IMAGES_WAIT_MS (a blocked logo URL used to hang here). */
  private async settleImages(page: puppeteer.Page) {
    try {
      await withDeadline(
        page.evaluate(async (budget: number) => {
          const images = Array.from(document.querySelectorAll('img'));
          const pending = images
            .filter((img) => !img.complete)
            .map(
              (img) =>
                new Promise<void>((resolve) => {
                  img.addEventListener('load', () => resolve(), { once: true });
                  img.addEventListener('error', () => resolve(), { once: true });
                }),
            );
          if (!pending.length) return true;
          await Promise.race([
            Promise.all(pending).then(() => undefined),
            new Promise<void>((resolve) => setTimeout(resolve, budget)),
          ]);
          return true;
        }, IMAGES_WAIT_MS),
        IMAGES_WAIT_MS + 2_000,
        'images.load',
      );
    } catch (err: any) {
      this.logger.warn(`Image settle skipped: ${err?.message || err}`);
    }
  }

  async generatePdf(options: PdfGenerateOptions): Promise<Buffer> {
    const isEn = options.lang === 'en';
    const dir = isEn ? 'ltr' : 'rtl';
    const langAttr = isEn ? 'en' : 'ar';

    const fullHtml = `
        <!DOCTYPE html>
        <html lang="${langAttr}" dir="${dir}">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&family=Tajawal:wght@400;500;700;800;900&family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
            <style>
              *, *::before, *::after {
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                width: 100% !important;
                font-smooth: always !important;
                -webkit-font-smoothing: antialiased !important;
                text-rendering: optimizeLegibility !important;
              }
              body {
                font-family: 'IBM Plex Sans Arabic', 'Tajawal', 'Cairo', sans-serif;
              }
              table { width: 100%; border-collapse: collapse; }
              thead { display: table-header-group; }
              tbody { display: table-row-group; }
              tfoot { display: table-footer-group; }
              tr { page-break-inside: avoid; break-inside: avoid; }
              .print-summary-block,
              .print-summary-footer-block {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            </style>
          </head>
          <body>
            ${options.html}
          </body>
        </html>
      `;

    return this.onPage('generatePdf', async (page) => {
      try {
        await page.setContent(fullHtml, {
          waitUntil: 'domcontentloaded',
          timeout: SET_CONTENT_TIMEOUT_MS,
        });

        await this.settleFonts(page);

        const isHeaderFooter = !!(options.headerHtml || options.footerHtml);

        const pdfBuffer = await page.pdf({
          format: (options.format || 'A4') as puppeteer.PaperFormat,
          landscape: options.landscape || false,
          printBackground: true,
          displayHeaderFooter: isHeaderFooter,
          timeout: RENDER_TIMEOUT_MS,
          headerTemplate: options.headerHtml
            ? `<div style="font-size: 10px; width: 100%; padding: 0 4mm; box-sizing: border-box; font-family: 'IBM Plex Sans Arabic', 'Tajawal', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #ffffff;">
              ${options.headerHtml}
            </div>`
            : '<span></span>',
          footerTemplate: options.footerHtml
            ? `<div style="font-size: 9px; width: 100%; padding: 0 4mm; box-sizing: border-box; font-family: 'IBM Plex Sans Arabic', 'Tajawal', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              ${options.footerHtml}
            </div>`
            : '<span></span>',
          margin: {
            top: options.marginTop || (options.headerHtml ? '48mm' : '10mm'),
            bottom: options.marginBottom || (options.footerHtml ? '25mm' : '10mm'),
            left: options.marginLeft || '6mm',
            right: options.marginRight || '6mm',
          },
          preferCSSPageSize: false,
        });

        return Buffer.from(pdfBuffer);
      } catch (err: any) {
        if (err instanceof PdfTimeoutError || err instanceof HttpException) throw err;
        this.logger.error(`Puppeteer generatePdf failed: ${err?.message || err}`, err?.stack);
        throw new HttpException(`PDF generation failed: ${err?.message || err}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  }

  /**
   * Generate PDF from a complete HTML string (template-based).
   * The HTML already contains header/footer via CSS table-header-group/table-footer-group.
   * No Puppeteer headerTemplate/footerTemplate needed.
   */
  async generateFromHtml(html: string): Promise<Buffer> {
    return this.onPage('generateFromHtml', async (page) => {
      try {
        await page.setContent(html, {
          waitUntil: 'domcontentloaded',
          timeout: SET_CONTENT_TIMEOUT_MS,
        });

        await this.settleFonts(page);
        await this.settleImages(page);

        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: false,
          printBackground: true,
          displayHeaderFooter: false,
          timeout: RENDER_TIMEOUT_MS,
          margin: { top: '4mm', bottom: '4mm', left: '4mm', right: '4mm' },
          preferCSSPageSize: false,
        });

        return Buffer.from(pdfBuffer);
      } catch (err: any) {
        if (err instanceof PdfTimeoutError || err instanceof HttpException) throw err;
        this.logger.error(`Puppeteer generateFromHtml failed: ${err?.message || err}`, err?.stack);
        throw new HttpException(`PDF generation failed: ${err?.message || err}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  }
}
