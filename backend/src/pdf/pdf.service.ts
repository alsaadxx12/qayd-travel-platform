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

@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private browser: puppeteer.Browser | null = null;
  private readonly logger = new Logger(PdfService.name);

  private getPuppeteerArgs(): string[] {
    return [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
      '--no-first-run',
      '--font-render-hinting=none',
    ];
  }

  async onModuleInit() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: this.getPuppeteerArgs(),
      });
      this.logger.log('Puppeteer browser launched successfully');
    } catch (error) {
      this.logger.error('Failed to launch Puppeteer browser', error);
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.log('Puppeteer browser closed');
    }
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: this.getPuppeteerArgs(),
      });
    }
    return this.browser;
  }

  async generatePdf(options: PdfGenerateOptions): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
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

      await page.setContent(fullHtml, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });

      // Wait for fonts to load safely
      try {
        await page.evaluate(() => document.fonts.ready);
      } catch (e) {}

      const isHeaderFooter = !!(options.headerHtml || options.footerHtml);

      const pdfBuffer = await page.pdf({
        format: (options.format || 'A4') as puppeteer.PaperFormat,
        landscape: options.landscape || false,
        printBackground: true,
        displayHeaderFooter: isHeaderFooter,
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
      this.logger.error(`Puppeteer generatePdf failed: ${err?.message || err}`, err?.stack);
      throw new HttpException(`PDF generation failed: ${err?.message || err}`, HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      await page.close();
    }
  }

  /**
   * Generate PDF from a complete HTML string (template-based).
   * The HTML already contains header/footer via CSS table-header-group/table-footer-group.
   * No Puppeteer headerTemplate/footerTemplate needed.
   */
  async generateFromHtml(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });

      // Wait for fonts & images
      try {
        await page.evaluate(() => document.fonts.ready);
      } catch (e) {}
      try {
        await page.evaluate(() => {
          const images = Array.from(document.querySelectorAll('img'));
          return Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }));
        });
      } catch (e) {}

      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: false,
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: '4mm', bottom: '4mm', left: '4mm', right: '4mm' },
        preferCSSPageSize: false,
      });

      return Buffer.from(pdfBuffer);
    } catch (err: any) {
      this.logger.error(`Puppeteer generateFromHtml failed: ${err?.message || err}`, err?.stack);
      throw new HttpException(`PDF generation failed: ${err?.message || err}`, HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      await page.close();
    }
  }
}
