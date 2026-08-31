import { Injectable, OnModuleInit, OnModuleDestroy, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

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

  /** Resolved once: the filesystem does not change under a running process. */
  private resolvedExecutable?: string | null;

  /**
   * Whether a path is a real browser rather than a stub that only complains.
   *
   * On Ubuntu `/usr/bin/chromium-browser` is not Chromium: it is a tiny shell script
   * that exits with «requires the chromium snap to be installed». It EXISTS, so any
   * check that merely asks whether the file is there picks it, and the launch then
   * fails with an error that looks like a browser crash. A real browser is an ELF
   * executable, so the first four bytes settle it without spawning anything.
   */
  private isRealBrowser(candidate: string): boolean {
    try {
      const fd = fs.openSync(candidate, 'r');
      const head = Buffer.alloc(4);
      fs.readSync(fd, head, 0, 4, 0);
      fs.closeSync(fd);
      // 0x7F 'E' 'L' 'F'
      if (head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46) return true;

      // Not a binary. A wrapper script is only a stub if it points at the snap.
      const text = fs.readFileSync(candidate, 'utf-8').slice(0, 4096);
      if (/snap/i.test(text)) {
        this.logger.warn(`Chromium: ${candidate} is a snap stub, not a browser — skipping it.`);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Finds a real browser on this machine, wherever the host happens to put one.
   *
   * Naming the binary in an environment variable is the usual advice, and it is the
   * first thing tried — but it fails silently in the way that is hardest to debug:
   * if the path is wrong, or the package landed under a different name, puppeteer
   * reports only that it could not find a browser, and nothing says which path it
   * looked at. So the configured path is CHECKED to exist, and when it does not the
   * usual install locations and then PATH are searched before giving up.
   *
   * The result is logged once at the level that matters: which browser will be used,
   * or that none exists and PDFs will fall back to HTML.
   */
  private resolveExecutablePath(): string | undefined {
    if (this.resolvedExecutable !== undefined) return this.resolvedExecutable || undefined;

    const configured = (process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || '').trim();
    if (configured) {
      if (fs.existsSync(configured) && this.isRealBrowser(configured)) {
        this.logger.log(`Chromium: using configured binary ${configured}`);
        this.resolvedExecutable = configured;
        return configured;
      }
      this.logger.warn(
        `Chromium: PUPPETEER_EXECUTABLE_PATH points at ${configured}, which is missing or is not a real browser. Searching the machine instead.`,
      );
    }

    const candidates = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/lib/chromium/chromium',
      '/opt/google/chrome/chrome',
      '/snap/bin/chromium',
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && this.isRealBrowser(candidate)) {
        this.logger.log(`Chromium: found ${candidate}`);
        this.resolvedExecutable = candidate;
        return candidate;
      }
    }

    // Puppeteer's own download, kept inside the project by .puppeteerrc.cjs so it
    // survives from the build into the running image. Preferred over anything on
    // PATH: it is a known-good build, matched to this puppeteer version.
    const bundled = this.findBundledChrome();
    if (bundled) {
      this.logger.log(`Chromium: using puppeteer's own build at ${bundled}`);
      this.resolvedExecutable = bundled;
      return bundled;
    }

    // Nix-based images put the binary in a store path no list can predict, so PATH
    // is walked directly rather than shelling out to `which`.
    const names = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
    for (const dir of String(process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
      for (const name of names) {
        const full = path.join(dir, name);
        try {
          if (fs.existsSync(full) && this.isRealBrowser(full)) {
            this.logger.log(`Chromium: found ${full} on PATH`);
            this.resolvedExecutable = full;
            return full;
          }
        } catch {
          /* an unreadable PATH entry is not a reason to stop looking */
        }
      }
    }

    // Nothing found: let puppeteer try its own bundled download. If that is absent
    // too the launch fails, and the statement is delivered as HTML instead.
    this.logger.warn(
      'Chromium: no system browser found. Falling back to puppeteer\'s bundled build; if it was not downloaded, PDFs will be unavailable and statements will be sent as HTML.',
    );
    this.resolvedExecutable = null;
    return undefined;
  }

  /**
   * Puppeteer stores its download under `<cacheDir>/chrome/<build>/chrome-linux64/chrome`.
   * The build folder is named after a version that changes with every upgrade, so it
   * is discovered rather than hard-coded.
   */
  private findBundledChrome(): string | null {
    const roots = [
      process.env.PUPPETEER_CACHE_DIR,
      path.join(process.cwd(), '.cache', 'puppeteer'),
      path.join(process.env.HOME || '/root', '.cache', 'puppeteer'),
    ].filter((dir): dir is string => Boolean(dir));

    for (const root of roots) {
      for (const product of ['chrome', 'chrome-headless-shell', 'chromium']) {
        const dir = path.join(root, product);
        let builds: string[];
        try {
          builds = fs.readdirSync(dir);
        } catch {
          continue;
        }
        // Newest build first, so an upgrade does not leave the old one in use.
        for (const build of builds.sort().reverse()) {
          for (const rel of [
            ['chrome-linux64', 'chrome'],
            ['chrome-linux', 'chrome'],
            ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
          ]) {
            const full = path.join(dir, build, ...rel);
            if (fs.existsSync(full) && this.isRealBrowser(full)) return full;
          }
        }
      }
    }
    return null;
  }

  /**
   * What the server can actually do, for the diagnostics endpoint — so «why is there
   * no PDF» is answered by looking, not by guessing.
   */
  browserDiagnostics() {
    const resolved = this.resolveExecutablePath();
    return {
      configuredPath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || null,
      configuredPathExists: (() => {
        const configured = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
        return configured ? fs.existsSync(configured) : null;
      })(),
      resolvedPath: resolved || null,
      usingBundled: !resolved,
      browserConnected: Boolean(this.browser && this.browser.connected),
    };
  }

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
      // Vector PDF: hinting + LCD subpixel AA make Arabic look soft/fringed in viewers.
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--force-color-profile=srgb',
    ];
    // --single-process (with --no-zygote) halves memory but is a known source of
    // deadlocks inside page.pdf(). Off by default; opt in only on tiny instances.
    if (process.env.PDF_SINGLE_PROCESS === '1') {
      args.push('--single-process', '--no-zygote');
    }
    return args;
  }

  async onModuleInit() {
    try {
      await this.getBrowser();
      this.logger.log('Puppeteer browser launched successfully');
    } catch (error: any) {
      // Boot must not fail because Chromium is missing — the first PDF request retries.
      this.logger.error(`Failed to launch Puppeteer browser at boot: ${error?.message || error}`);
    }
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
      const executablePath = this.resolveExecutablePath();
      this.launching = withDeadline(
        puppeteer.launch({
          headless: true,
          args: this.getPuppeteerArgs(),
          ...(executablePath ? { executablePath } : {}),
        }),
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

  /**
   * Print media + A4 CSS pixels at 2× so logos/QR stay crisp while text stays vector.
   */
  private async loadPrintDocument(
    page: puppeteer.Page,
    html: string,
    opts: { settleImages: boolean },
  ) {
    await page.emulateMediaType('print');
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: SET_CONTENT_TIMEOUT_MS,
    });
    await this.settleFonts(page);
    if (opts.settleImages) await this.settleImages(page);
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
                -moz-osx-font-smoothing: grayscale !important;
                text-rendering: geometricPrecision !important;
                font-kerning: normal !important;
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
        await this.loadPrintDocument(page, fullHtml, { settleImages: false });

        const isHeaderFooter = !!(options.headerHtml || options.footerHtml);

        const pdfBuffer = await page.pdf({
          format: (options.format || 'A4') as puppeteer.PaperFormat,
          landscape: options.landscape || false,
          printBackground: true,
          displayHeaderFooter: isHeaderFooter,
          timeout: RENDER_TIMEOUT_MS,
          scale: 1,
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
        await this.loadPrintDocument(page, html, { settleImages: true });

        // Template owns @page { size: A4; margin: 0 }. Extra Puppeteer margins
        // shrink the sheet and make type look like a scaled screenshot.
        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: false,
          printBackground: true,
          displayHeaderFooter: false,
          timeout: RENDER_TIMEOUT_MS,
          margin: { top: '0', bottom: '0', left: '0', right: '0' },
          preferCSSPageSize: true,
          scale: 1,
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
