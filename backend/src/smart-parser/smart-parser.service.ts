import { Injectable } from '@nestjs/common';
import { chatModelParams, DEFAULT_PARSE_MODEL } from '../common/openai-models';

export interface ParsedPassengerDto {
  name: string;
  ticketType: 'ADULT' | 'CHILD' | 'INFANT';
  ticketNumber: string;
  documentNumber?: string;
  fareBuy: number;
  fareSell: number;
  tax1: number;
  tax2: number;
  charge: number;
}

export interface ParsedTicketDataDto {
  pnr: string;
  bookingRef?: string;
  passengers: ParsedPassengerDto[];
  routeFrom?: string;
  routeTo?: string;
  routeStops?: string[];
  airline?: string;
  travelDate?: string;
  returnDate?: string;
  issueDate?: string;
  tripType?: 'ONE_WAY' | 'ROUND_TRIP';
  travelClass?: string;
  flightNumber?: string;
  currency?: string;
  aiEngineUsed?: string;
}

// English prompt works much better with Llama & GPT models
// Fast OpenAI extraction prompt. Do NOT include real-looking sample ticket numbers —
// models copy them onto every passenger when the PDF text is messy.
const TICKET_PARSER_PROMPT = `You are a senior travel-document reader for an Iraqi travel agency.

Read ANY layout: airline e-ticket, GDS itinerary, agency voucher, screenshot, Arabic / English / Persian. Designs differ. Do not assume one template.

PRIMARY SOURCE = attached page images. SECONDARY = OCR/text (may be jumbled).

Copy ONLY what is printed. If a field is not visible, use "" or 0 for money. Never invent e-ticket numbers, names, or amounts.

Fields:
- pnr / record locator / رمز الحجز
- bookingRef (agency ref like FL-xxxxxx if printed)
- airline (Arabic name if shown, else English, else IATA code)
- routeFrom / routeTo: 3-letter IATA. routeStops: via airports
- issueDate, travelDate, returnDate: YYYY-MM-DD
- tripType: ONE_WAY or ROUND_TRIP
- travelClass: Economy / Business / First if printed
- flightNumber e.g. QB 1234
- currency: IQD or USD if printed next to fares
- passengers in table order:
  name (without MR/MRS unless that is the only form)
  ticketType: ADULT | CHILD | INFANT (بالغ/طفل/رضيع)
  ticketNumber: e-ticket / رقم التذكرة / التذكرة الإلكترونية / شماره بلیت EXACTLY as printed (digits, hyphens). NOT PNR, NOT passport, NOT phone (07… / +964…)
  documentNumber: passport/ID
  fareBuy: cost/شراء/fare if printed, else 0
  fareSell: sale/مبيع if printed, else 0
  tax1, tax2, charge: only if printed, else 0

Each passenger keeps THEIR own ticket number from their row.

JSON only:
{"pnr":"","bookingRef":"","airline":"","routeFrom":"","routeTo":"","routeStops":[],"issueDate":"","travelDate":"","returnDate":"","tripType":"ONE_WAY","travelClass":"","flightNumber":"","currency":"","passengers":[{"name":"","ticketType":"ADULT","ticketNumber":"","documentNumber":"","fareBuy":0,"fareSell":0,"tax1":0,"tax2":0,"charge":0}]}`;

export interface ParsedVisaPassengerDto {
  name: string;
  passportNumber?: string;
  orderNumber?: string;
  visaType?: string;
  personType?: 'ADT' | 'CHD' | 'INF';
  supplierName?: string;
  customerName?: string;
  buyPrice?: number;
  salePrice?: number;
  issueDate?: string;
  employeeName?: string;
  notes?: string;
}

export interface ParsedVisaDataDto {
  passengers: ParsedVisaPassengerDto[];
  supplierName?: string;
  customerName?: string;
  issueDate?: string;
  employeeName?: string;
  detectedCurrency?: 'IQD' | 'USD';
  aiEngineUsed?: string;
}

const VISA_PARSER_PROMPT = `You extract visa / travel-authorization passenger rows from pasted Excel, WhatsApp, or free text.

RULES:
1. ONLY extract data that exists. Never invent names, passport numbers, or amounts.
2. Skip header rows, totals, and empty lines.
3. Dates as YYYY-MM-DD.
4. Amounts as numbers only (no currency symbols). Detect currency: IQD if amounts look like dinars (typically > 2000) or the text contains د.ع / IQD; otherwise USD.
5. personType: ADT (بالغ), CHD (طفل), INF (رضيع). Default ADT.
6. Map Arabic/English columns:
   - name: اسم المسافر / المسافر / النزيل
   - passportNumber: رقم الجواز / الجواز / الوثيقة
   - orderNumber: رقم الطلب / voucher / ref
   - visaType: نوع الفيزا / التأشيرة
   - supplierName: قطعت من / المورد
   - customerName: قطعت الى / العميل
   - buyPrice: شراء / التكلفة
   - salePrice: مبيع / البيع
   - issueDate: تاريخ التقديم / الإصدار
   - employeeName: موظف الإصدار
   - notes: ملاحظات

Return ONLY valid JSON:
{"detectedCurrency":"IQD","passengers":[{"name":"","passportNumber":"","orderNumber":"","visaType":"","personType":"ADT","supplierName":"","customerName":"","buyPrice":0,"salePrice":0,"issueDate":"","employeeName":"","notes":""}]}`;

@Injectable()
export class SmartParserService {
  /** Vision + layout-agnostic extraction. Use the same OpenAI model as Copilot unless overridden. */
  private readonly parseModel = process.env.AI_PARSE_MODEL || process.env.AI_MODEL || DEFAULT_PARSE_MODEL;

  /**
   * Ticket parser: OpenAI (text + page images) first, local rules only if OpenAI fails.
   */
  async parseTicketFile(
    fileBuffer: Buffer,
    mimetype: string,
    textContent?: string,
    pageImages?: Array<{ buffer: Buffer; mimetype: string }>,
  ): Promise<ParsedTicketDataDto> {
    const openaiKey = process.env.OPENAI_API_KEY;
    const content = this.preprocessTicketText(textContent || fileBuffer.toString('utf-8'));
    const images = this.collectParseImages(fileBuffer, mimetype, pageImages);

    if (openaiKey && openaiKey.trim().startsWith('sk-')) {
      try {
        const result = await this.parseTicketWithOpenAi(openaiKey.trim(), content, images);
        if (result) {
          const refined = await this.refineMissingTicketNumbers(openaiKey.trim(), result, images, content);
          refined.passengers = this.uniqueTicketNumbers(refined.passengers, content);
          this.backfillHeaderFromText(refined, content);
          return { ...refined, aiEngineUsed: `OpenAI ${this.parseModel}` };
        }
      } catch (err: any) {
        console.warn('OpenAI ticket parsing failed:', err?.message || err);
      }
    }

    const localResult = this.parseWithRuleEngine(content);
    localResult.passengers = this.uniqueTicketNumbers(localResult.passengers, content);
    return { ...localResult, aiEngineUsed: 'المحرك المحلي (OpenAI غير متاح)' };
  }

  async parseVisaText(params: {
    textContent: string;
    defaultVisaType?: string;
    availableVisaTypes?: string[];
  }): Promise<ParsedVisaDataDto> {
    const openaiKey = process.env.OPENAI_API_KEY;
    const content = (params.textContent || '').trim();
    if (!content) {
      return { passengers: [], aiEngineUsed: 'empty' };
    }

    if (openaiKey && openaiKey.trim().startsWith('sk-')) {
      try {
        const result = await this.parseVisaWithOpenAi(openaiKey.trim(), content, params.defaultVisaType, params.availableVisaTypes);
        if (result?.passengers?.length) {
          return { ...result, aiEngineUsed: `OpenAI ${this.parseModel}` };
        }
      } catch (err: any) {
        console.warn('OpenAI visa parsing failed:', err?.message || err);
      }
    }

    return { passengers: [], aiEngineUsed: 'openai-unavailable' };
  }

  /* ─── OpenAI ─── */
  private collectParseImages(
    fileBuffer: Buffer,
    mimetype: string,
    pageImages?: Array<{ buffer: Buffer; mimetype: string }>,
  ): Array<{ mime: string; data: string }> {
    const out: Array<{ mime: string; data: string }> = [];
    const push = (buf: Buffer, mime: string) => {
      if (!buf?.length) return;
      const normalized = (mime || 'image/jpeg').split(';')[0].toLowerCase();
      if (!normalized.startsWith('image/')) return;
      out.push({ mime: normalized, data: buf.toString('base64') });
    };
    push(fileBuffer, mimetype);
    for (const img of pageImages || []) push(img.buffer, img.mimetype);
    return out.slice(0, 4);
  }

  private async parseTicketWithOpenAi(
    apiKey: string,
    textContent: string,
    images: Array<{ mime: string; data: string }>,
  ): Promise<ParsedTicketDataDto | null> {
        const clipped = (textContent || '').slice(0, 14000);
    const userContent: any[] = [
      {
        type: 'text',
        text: `${TICKET_PARSER_PROMPT}

PRIMARY SOURCE: the attached page image(s) of the actual ticket/voucher (any design).
SECONDARY: selectable text which may be incomplete or out of order.

--- DOCUMENT TEXT ---
${clipped || '(no selectable text — read the images)'}
--- END ---`,
      },
    ];
    for (const img of images) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${img.mime};base64,${img.data}`, detail: 'high' },
      });
    }
    const parsedJson = await this.callOpenAiJson(
      apiKey,
      'You are a travel-document reader. The attached images are the primary source; text is secondary and may be incomplete. Copy e-ticket numbers exactly as printed. Never invent a ticket number. Layouts vary — do not follow a single template. Return only JSON.',
      userContent,
    );
    return this.normalizeResult(parsedJson);
  }

  private async refineMissingTicketNumbers(
    apiKey: string,
    result: ParsedTicketDataDto,
    images: Array<{ mime: string; data: string }>,
    textContent: string,
  ): Promise<ParsedTicketDataDto> {
    const passengers = result.passengers || [];
    const missingTickets = passengers.some((p) => !p.ticketNumber);
    const missingNames = passengers.some((p) => !p.name);
    if ((!missingTickets && !missingNames) || (!images.length && !(textContent || '').trim())) {
      return result;
    }

    try {
      const userContent: any[] = [
        {
          type: 'text',
          text: `First pass missed some passenger names or e-ticket numbers.

Known passengers (table order):
${JSON.stringify(passengers.map((p) => ({ name: p.name, ticketNumber: p.ticketNumber })))}

Re-read the attached images as the primary source. Return the FULL passenger list in printed order.
Fill missing name / ticketNumber from what is printed. Each passenger keeps THEIR own e-ticket number.
Do not copy one number onto every row. Do not invent. Copy ticket numbers exactly as printed.

{"passengers":[{"name":"","ticketNumber":""}]}`,
        },
      ];
      for (const img of images) {
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:${img.mime};base64,${img.data}`, detail: 'high' },
        });
      }
      const parsed = await this.callOpenAiJson(
        apiKey,
        'You repair missing e-ticket numbers and names from travel-document images. Copy only what is printed. Return only JSON.',
        userContent,
      );
      const rows = Array.isArray(parsed?.passengers) ? parsed.passengers : [];
      if (!rows.length) return result;

      const merged = passengers.map((p, i) => {
        const extra =
          rows[i] ||
          rows.find((r: any) => this.namesLikelyMatch(String(r?.name || ''), p.name));
        const tkt = this.cleanTicketNumber(extra?.ticketNumber);
        const name = String(extra?.name || '')
          .replace(/^(?:MR|MRS|MS|MISS|MSTR)\s+/i, '')
          .trim();
        return {
          ...p,
          name: p.name || name,
          ticketNumber: p.ticketNumber || tkt,
        };
      });

      for (let i = merged.length; i < rows.length; i++) {
        const name = String(rows[i]?.name || '')
          .replace(/^(?:MR|MRS|MS|MISS|MSTR)\s+/i, '')
          .trim();
        if (!name) continue;
        merged.push({
          name,
          ticketType: 'ADULT',
          ticketNumber: this.cleanTicketNumber(rows[i]?.ticketNumber),
          documentNumber: '',
          fareBuy: 0,
          fareSell: 0,
          tax1: 0,
          tax2: 0,
          charge: 0,
        });
      }
      return { ...result, passengers: merged };
    } catch (err: any) {
      console.warn('OpenAI ticket refine skipped:', err?.message || err);
      return result;
    }
  }

  private namesLikelyMatch(a: string, b: string): boolean {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z\u0600-\u06ff]/g, '')
        .trim();
    const na = norm(a);
    const nb = norm(b);
    if (!na || !nb) return false;
    return na === nb || na.includes(nb) || nb.includes(na);
  }

  private money(v: any): number {
    if (v == null || v === '') return 0;
    const n = parseFloat(String(v).replace(/,/g, '').replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n >= 100 ? Math.round(n) : Math.round(n * 100) / 100;
  }

  private backfillHeaderFromText(result: ParsedTicketDataDto, text: string): void {
    const t = this.preprocessTicketText(text);
    if (!result.pnr) {
      const m = t.match(/(?:PNR|RECORD\s*LOCATOR|رمز\s*الحجز)[:\s#]*([A-Z0-9]{5,8})\b/i);
      if (m?.[1] && !/^\d+$/.test(m[1])) result.pnr = m[1].toUpperCase();
    }
    if (!result.bookingRef) {
      const m = t.match(/(?:مرجع\s*الحجز|BOOKING\s*REF)[:\s#]*([A-Z0-9-]{6,16})\b/i);
      if (m?.[1]) result.bookingRef = m[1].trim().toUpperCase();
    }
    if (!result.routeFrom || !result.routeTo) {
      const m = t.match(/\b([A-Z]{3})\s*(?:-|–|→|➔|to|TO|إلى)\s*([A-Z]{3})\b/);
      if (m) {
        if (!result.routeFrom) result.routeFrom = m[1];
        if (!result.routeTo) result.routeTo = m[2];
      }
    }
    if (!result.airline) {
      const m = t.match(/(?:Airline|Carrier|الناقل|شركة\s*الطيران)[:\s]+([^\n]{3,50})/i);
      if (m?.[1]) result.airline = m[1].replace(/\s+/g, ' ').trim();
    }
  }

  private async parseVisaWithOpenAi(
    apiKey: string,
    textContent: string,
    defaultVisaType?: string,
    availableVisaTypes?: string[],
  ): Promise<ParsedVisaDataDto | null> {
    const extra = [
      defaultVisaType ? `Default visa type if the row has none: "${defaultVisaType}".` : '',
      availableVisaTypes?.length ? `Prefer visa types from this list when matching: ${availableVisaTypes.join(' | ')}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const parsedJson = await this.callOpenAiJson(
      apiKey,
      'You extract visa passenger rows from pasted tables into JSON. Only extract what exists. Never invent data. Return only valid JSON.',
      `${VISA_PARSER_PROMPT}\n${extra}\n\n--- PASTED VISA TEXT ---\n${textContent}\n--- END ---`,
    );
    return this.normalizeVisaResult(parsedJson, defaultVisaType);
  }

  private async callOpenAiJson(apiKey: string, system: string, user: string | any[]): Promise<any> {
    const userMessage =
      typeof user === 'string'
        ? { role: 'user', content: user }
        : { role: 'user', content: user };
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.parseModel,
        messages: [
          { role: 'system', content: system },
          userMessage,
        ],
        response_format: { type: 'json_object' },
        ...chatModelParams(this.parseModel, { maxTokens: 5000, temperature: 0, reasoning: 'medium' }),
      }),
      signal: AbortSignal.timeout(50_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI: ${response.status} - ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty response');
    return JSON.parse(content);
  }

  private normalizeVisaResult(parsedJson: any, defaultVisaType?: string): ParsedVisaDataDto {
    const rows = Array.isArray(parsedJson?.passengers) ? parsedJson.passengers : [];
    const passengers: ParsedVisaPassengerDto[] = rows
      .map((p: any) => {
        const name = String(p?.name || '').trim();
        if (!name) return null;
        const personRaw = String(p?.personType || '').toUpperCase();
        const personType: 'ADT' | 'CHD' | 'INF' =
          personRaw.includes('CHD') || personRaw.includes('CHILD') || String(p?.personType || '').includes('طفل')
            ? 'CHD'
            : personRaw.includes('INF') || String(p?.personType || '').includes('رضيع')
              ? 'INF'
              : 'ADT';
        const buyPrice = Number(p?.buyPrice) || 0;
        const salePrice = Number(p?.salePrice) || 0;
        return {
          name,
          passportNumber: String(p?.passportNumber || '').trim(),
          orderNumber: String(p?.orderNumber || '').trim(),
          visaType: String(p?.visaType || defaultVisaType || '').trim(),
          personType,
          supplierName: String(p?.supplierName || '').trim(),
          customerName: String(p?.customerName || '').trim(),
          buyPrice,
          salePrice,
          issueDate: this.normalizeDate(p?.issueDate) || String(p?.issueDate || '').trim(),
          employeeName: String(p?.employeeName || '').trim(),
          notes: String(p?.notes || '').trim(),
        } as ParsedVisaPassengerDto;
      })
      .filter(Boolean) as ParsedVisaPassengerDto[];

    const first = passengers[0];
    const hasHighAmounts = passengers.some((r) => (r.buyPrice || 0) > 2000 || (r.salePrice || 0) > 2000);
    const detectedCurrency: 'IQD' | 'USD' =
      parsedJson?.detectedCurrency === 'USD' && !hasHighAmounts ? 'USD' : hasHighAmounts || parsedJson?.detectedCurrency === 'IQD' ? 'IQD' : parsedJson?.detectedCurrency === 'USD' ? 'USD' : 'IQD';

    return {
      passengers,
      supplierName: first?.supplierName || parsedJson?.supplierName || '',
      customerName: first?.customerName || parsedJson?.customerName || '',
      issueDate: first?.issueDate || parsedJson?.issueDate || '',
      employeeName: first?.employeeName || parsedJson?.employeeName || '',
      detectedCurrency,
    };
  }

  /* ─── Keep the printed ticket serial; never force one airline template ─── */
  private preprocessTicketText(content: string): string {
    return String(content || '')
      .replace(/(\d{3})\s*[-–]\s*(\d{6,12})\b/g, '$1-$2')
      .replace(/(\d{3})\s+(\d{6,12})\b/g, '$1-$2');
  }

  private isPhoneNumber(digits: string): boolean {
    if (!digits) return false;
    if (/^(?:00)?9647\d{9}$/.test(digits)) return true;
    if (/^0?7\d{9}$/.test(digits)) return true;
    if (/^\+?964\s*7/.test(digits)) return true;
    return false;
  }

  private isPlaceholderTicket(digits: string): boolean {
    return digits === '0762300332188' || digits === '0762300332189';
  }

  private formatIataTicket(digits: string): string {
    if (digits.length === 13) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return digits;
  }

  private cleanTicketNumber(raw?: string): string {
    if (!raw) return '';
    const printed = this.preprocessTicketText(String(raw)).trim();
    if (!printed || printed === '-' || printed === '—') return '';
    const digits = printed.replace(/\D/g, '');
    if (this.isPhoneNumber(digits) || this.isPlaceholderTicket(digits)) return '';
    if (digits.length === 13) return this.formatIataTicket(digits);
    if (digits.length >= 8 && digits.length <= 16) return printed.replace(/\s+/g, '');
    const compact = printed.replace(/\s+/g, '').toUpperCase();
    if (/^[A-Z0-9][-A-Z0-9]{5,22}$/.test(compact) && !this.isPhoneNumber(digits)) return compact;
    return '';
  }

  private extractETicketNumbers(text: string): string[] {
    const normalized = this.preprocessTicketText(text);
    const found: string[] = [];
    const seen = new Set<string>();
    const labeled =
      /(?:e-?tickets?|ticket\s*(?:no\.?|number|#)|رقم\s*التذكرة(?:\s*الإلكترونية)?|التذكرة\s*الإلكترونية|شماره\s*(?:بلیت|بلیط))[:\s#]*([A-Z0-9][-A-Z0-9]{5,22})/gi;
    let match: RegExpExecArray | null;
    while ((match = labeled.exec(normalized)) !== null) {
      const cleaned = this.cleanTicketNumber(match[1]);
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        found.push(cleaned);
      }
    }
    return found;
  }

  private uniqueTicketNumbers(passengers: ParsedPassengerDto[], sourceText: string): ParsedPassengerDto[] {
    const rows = passengers.map((p) => ({
      ...p,
      ticketNumber: this.cleanTicketNumber(p.ticketNumber),
    }));

    const seen = new Set<string>();
    for (const p of rows) {
      if (!p.ticketNumber) continue;
      if (seen.has(p.ticketNumber)) {
        p.ticketNumber = '';
        continue;
      }
      seen.add(p.ticketNumber);
    }

    const extracted = this.extractETicketNumbers(sourceText);
    let i = 0;
    for (const p of rows) {
      if (p.ticketNumber) continue;
      while (i < extracted.length && seen.has(extracted[i])) i++;
      if (i < extracted.length) {
        p.ticketNumber = extracted[i];
        seen.add(extracted[i]);
        i++;
      }
    }

    if (extracted.length === 0) {
      const unlabeled = this.extractIataLookingSerials(sourceText);
      const emptyCount = rows.filter((p) => !p.ticketNumber).length;
      if (
        unlabeled.length &&
        (unlabeled.length === emptyCount || unlabeled.length === rows.length)
      ) {
        let j = 0;
        for (const p of rows) {
          if (p.ticketNumber) continue;
          while (j < unlabeled.length && seen.has(unlabeled[j])) j++;
          if (j < unlabeled.length) {
            p.ticketNumber = unlabeled[j];
            seen.add(unlabeled[j]);
            j++;
          }
        }
      }
    }

    if (rows.length === 1 && !rows[0].ticketNumber && extracted.length === 1) {
      rows[0].ticketNumber = extracted[0];
    }
    return rows;
  }

  private extractIataLookingSerials(text: string): string[] {
    const normalized = this.preprocessTicketText(text);
    const found: string[] = [];
    const seen = new Set<string>();
    const re = /\b(\d{3})-(\d{8,12})\b/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(normalized)) !== null) {
      const cleaned = this.cleanTicketNumber(`${match[1]}-${match[2]}`);
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        found.push(cleaned);
      }
    }
    return found;
  }

  /* ─── Helper: Normalize Date Strings (Supports ISO, DD/MM/YYYY, Arabic Months) ─── */
  private normalizeDate(raw?: string): string {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';

    // Check if format is YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = trimmed.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Check if format is DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Check Arabic textual date (e.g. "الخميس، 13 أغسطس 2026" or "13 آب 2026")
    const ARABIC_MONTHS: Record<string, string> = {
      'يناير': '01', 'كانون الثاني': '01', 'كانون ثاني': '01',
      'فبراير': '02', 'شباط': '02',
      'مارس': '03', 'آذار': '03', 'اذار': '03',
      'أبريل': '04', 'ابريل': '04', 'نيسان': '04',
      'مايو': '05', 'أيار': '05', 'ايار': '05',
      'يونيو': '06', 'حزيران': '06',
      'يوليو': '07', 'تموز': '07',
      'أغسطس': '08', 'اغسطس': '08', 'آب': '08', 'اب': '08',
      'سبتمبر': '09', 'أيلول': '09', 'ايلول': '09',
      'أكتوبر': '10', 'اكتوبر': '10', 'تشرين الأول': '10', 'تشرين اول': '10',
      'نوفمبر': '11', 'تشرين الثاني': '11', 'تشرين ثاني': '11',
      'ديسمبر': '12', 'كانون الأول': '12', 'كانون اول': '12',
    };

    for (const [monthName, monthNum] of Object.entries(ARABIC_MONTHS)) {
      if (trimmed.includes(monthName)) {
        const dMatch = trimmed.match(/\b(\d{1,2})\b/);
        const yMatch = trimmed.match(/\b(202\d)\b/);
        if (dMatch && yMatch) {
          return `${yMatch[1]}-${monthNum}-${dMatch[1].padStart(2, '0')}`;
        }
      }
    }

    return trimmed;
  }

  /* ─── Normalize AI Result ─── */
  private normalizeResult(parsedJson: any): ParsedTicketDataDto {
    const issueDate = this.normalizeDate(parsedJson.issueDate);
    const travelDate = this.normalizeDate(parsedJson.travelDate);
    const returnDate = this.normalizeDate(parsedJson.returnDate);

    const toIata = (raw: any): string => {
      const v = String(raw || '').trim().toUpperCase();
      return /^[A-Z]{3}$/.test(v) ? v : String(raw || '').trim();
    };
    const currencyRaw = String(parsedJson.currency || '').toUpperCase();
    const currency = currencyRaw.includes('USD') || currencyRaw.includes('$')
      ? 'USD'
      : currencyRaw.includes('IQD') || currencyRaw.includes('د.ع')
        ? 'IQD'
        : '';
    const routeStops = Array.isArray(parsedJson.routeStops)
      ? parsedJson.routeStops
          .map((s: any) => String(s || '').trim().toUpperCase())
          .filter((s: string) => /^[A-Z]{3}$/.test(s))
      : [];

    return {
      pnr: parsedJson.pnr || '',
      bookingRef: parsedJson.bookingRef || '',
      airline: parsedJson.airline || '',
      routeFrom: toIata(parsedJson.routeFrom),
      routeTo: toIata(parsedJson.routeTo),
      routeStops,
      issueDate: issueDate,
      travelDate: travelDate,
      returnDate: returnDate,
      tripType: parsedJson.tripType || (returnDate ? 'ROUND_TRIP' : 'ONE_WAY'),
      travelClass: String(parsedJson.travelClass || '').trim(),
      flightNumber: String(parsedJson.flightNumber || '').trim().toUpperCase(),
      currency,
      passengers: (parsedJson.passengers || []).map((p: any) => {
        let cleanDoc = (p.documentNumber || '').trim();
        cleanDoc = cleanDoc.replace(/^[Pp]\s*[-–]?\s*/, '').trim();

        const rawType = (p.ticketType || '').toLowerCase();
        const rawName = (p.name || '').trim();

        let pType: 'ADULT' | 'CHILD' | 'INFANT' = 'ADULT';
        if (
          rawType.includes('طفل') ||
          rawType.includes('chd') ||
          rawType.includes('child') ||
          rawType.includes('miss') ||
          rawType.includes('mstr') ||
          /\b(?:miss|mstr)\b/i.test(rawName)
        ) {
          pType = 'CHILD';
        } else if (
          rawType.includes('رضيع') ||
          rawType.includes('inf') ||
          rawType.includes('infant') ||
          /\b(?:infant|inf)\b/i.test(rawName)
        ) {
          pType = 'INFANT';
        }

        return {
          name: rawName.replace(/^(?:MR|MRS|MS|MISS|MSTR)\s+/i, '').trim() || rawName,
          ticketType: pType,
          ticketNumber: this.cleanTicketNumber(p.ticketNumber),
          documentNumber: cleanDoc,
          fareBuy: this.money(p.fareBuy),
          fareSell: this.money(p.fareSell),
          tax1: this.money(p.tax1),
          tax2: this.money(p.tax2),
          charge: this.money(p.charge),
        };
      }).filter((p: ParsedPassengerDto) => p.name || p.ticketNumber),
    };
  }

  /* ─── Robust Rule-Based Smart Parser (Zero-Failure) ─── */
  private parseWithRuleEngine(content: string): ParsedTicketDataDto {
    const fullText = content;

    // 1. PNR & Booking Ref Detection
    let pnr = '';
    let bookingRef = '';
    const pnrMatch = fullText.match(/(?:PNR|RECORD\s*LOCATOR|رمز\s*الحجز)[:\s#]*([A-Z0-9]{5,10})\b/i);
    if (pnrMatch && pnrMatch[1]) {
      pnr = pnrMatch[1].trim().toUpperCase();
    }

    const refMatch = fullText.match(/(?:مرجع\s*الحجز|BOOKING\s*REF)[:\s#]*([A-Z0-9-]{6,12})\b/i);
    if (refMatch && refMatch[1]) {
      bookingRef = refMatch[1].trim().toUpperCase();
      if (!pnr) pnr = bookingRef.replace(/^FL-/, '');
    }

    if (!pnr) {
      const genericPnr = fullText.match(/\b([A-Z0-9]{6,8})\b/);
      if (genericPnr && !genericPnr[1].match(/^\d+$/) && !['TICKET', 'FLIGHT', 'TRAVEL', 'PASSEN'].includes(genericPnr[1])) {
        pnr = genericPnr[1].toUpperCase();
      }
    }

    // 2. Airline Detection
    const AIRLINE_MAP: Record<string, string> = {
      'ME': 'طيران الشرق الأوسط',
      'IA': 'الخطوط الجوية العراقية',
      '1A': 'الخطوط الجوية العراقية',
      'QB': 'طيران قشم',
      'AXV': 'آفا إيرلاينز',
      'CPN': 'كاسبيان إيرلاين',
      'IV': 'كاسبيان إيرلاين',
      'PC': 'طيران بيغاسوس',
      'TK': 'الخطوط التركية',
      'EK': 'طيران الإمارات',
      'IF': 'فلاي بغداد',
      'JI': 'طيران معراج',
      'J1': 'طيران معراج',
      'IR': 'إيران إير',
      'B9': 'إيران إيرتور',
      'NV': 'إيران إيرتور',
      'EP': 'آسمان إيرلاينز',
      'W5': 'ماهان إير',
      'HH': 'طيران تابان',
      'ZV': 'طيران زاكروس',
      'Y9': 'كيش إير',
      'PRS': 'پارس إير',
      'IRZ': 'طيران ساها',
      'IS': 'طيران سبهران',
      'ISG': 'طيران سبهران',
      'TKN': 'فلاي كيش',
      'UD': 'أور إيرلاين',
      'QR': 'الخطوط القطرية',
      'FZ': 'فلاي دبي',
      'G9': 'العربية للطيران',
      'SV': 'الخطوط السعودية',
      'RJ': 'الملكية الأردنية',
      'MS': 'مصر للطيران',
      'KU': 'الخطوط الكويتية',
      'GF': 'طيران الخليج',
      'WY': 'الطيران العماني',
      'XY': 'طيران ناس',
    };

    let airline = '';
    for (const [code, name] of Object.entries(AIRLINE_MAP)) {
      const reg = new RegExp(`\\b${code}\\s*[-]?\\s*\\d{3,4}\\b`, 'i');
      if (reg.test(fullText) || fullText.includes(name)) {
        airline = name;
        break;
      }
    }
    if (!airline) {
      if (/الشرق الأوسط|Middle East/i.test(fullText)) airline = 'طيران الشرق الأوسط';
      else if (/العراقية|Iraqi/i.test(fullText)) airline = 'الخطوط الجوية العراقية';
      else if (/قشم|Qeshm/i.test(fullText)) airline = 'طيران قشم';
      else if (/معراج|Meraj/i.test(fullText)) airline = 'طيران معراج';
      else if (/فلاي دبي|Flydubai/i.test(fullText)) airline = 'فلاي دبي';
      else if (/التركية|Turkish/i.test(fullText)) airline = 'الخطوط التركية';
    }

    // 3. Route Detection (Airport codes)
    let routeFrom = '';
    let routeTo = '';
    const airportMatches = fullText.match(/\b(BEY|BGW|NJF|BSR|EBL|ISU|IKA|MHD|SYZ|IST|SAW|DXB|SHJ|DOH|AMM|CAI|JED|MED|KWI|THR)\b/gi);
    if (airportMatches && airportMatches.length >= 2) {
      routeFrom = airportMatches[0].toUpperCase();
      routeTo = airportMatches[1].toUpperCase();
    }

    // 4. Issue Date & Travel Date Detection
    let issueDate = '';
    const issueMatch = fullText.match(/(?:تاريخ\s*الإصدار|Issue\s*Date)[:\s]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i);
    if (issueMatch && issueMatch[1]) {
      issueDate = this.normalizeDate(issueMatch[1]);
    }

    let travelDate = '';
    let returnDate = '';
    // Look for Arabic flight date strings like "الخميس، 13 أغسطس 2026" or "13 أغسطس 2026" or "13/08/2026"
    const flightDateMatches = fullText.match(/(?:(?:السبت|الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة)[،,\s]*)?(\d{1,2})\s+(?:يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|آب|سبتمبر|أيلول|أكتوبر|نوفمبر|ديسمبر)\s+(202\d)|\b(202\d[-/.](?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12]\d|3[01]))\b|\b((?:0[1-9]|[12]\d|3[01])[-/.](?:0[1-9]|1[0-2])[-/.](202\d))\b/g);
    if (flightDateMatches && flightDateMatches.length > 0) {
      for (const fdm of flightDateMatches) {
        const norm = this.normalizeDate(fdm);
        if (norm && norm !== issueDate) {
          if (!travelDate) {
            travelDate = norm;
          } else if (!returnDate && norm !== travelDate) {
            returnDate = norm;
            break;
          }
        }
      }
      if (!travelDate && flightDateMatches[0]) {
        travelDate = this.normalizeDate(flightDateMatches[0]);
      }
    }

    // 5. Passengers Extraction
    const passengers: ParsedPassengerDto[] = [];
    const nameRegex = /(?:MR|MRS|MS|MISS|MSTR)[\s/]+([A-Z\s/-]{3,35})\b|\b([A-Z]{2,20}\/[A-Z]{2,20})\s+(?:MR|MRS|MS|MISS|MSTR)\b/gi;
    let match;
    const seenNames = new Set<string>();

    while ((match = nameRegex.exec(fullText)) !== null) {
      const rawName = (match[1] || match[2] || '').trim().replace(/[/]/g, ' ');
      if (rawName && rawName.length >= 3 && !seenNames.has(rawName)) {
        seenNames.add(rawName);
        const isChild = /CHD|CHILD|طفل|MISS|MSTR/i.test(match[0]) || /\b(?:MISS|MSTR)\b/i.test(rawName);
        const isInfant = /INF|INFANT|رضيع/i.test(match[0]);

        passengers.push({
          name: rawName.replace(/^(?:MR|MRS|MS|MISS|MSTR)\s+/i, '').trim() || rawName,
          ticketType: isInfant ? 'INFANT' : isChild ? 'CHILD' : 'ADULT',
          ticketNumber: '',
          documentNumber: '',
          fareBuy: 0,
          fareSell: 0,
          tax1: 0,
          tax2: 0,
          charge: 0,
        });
      }
    }

    // Only attach numbers that were labeled as e-tickets in the text
    const validTkts = this.extractETicketNumbers(fullText);

    validTkts.forEach((tkt, idx) => {
      if (passengers[idx]) {
        passengers[idx].ticketNumber = tkt;
      }
    });

    // Extract passport numbers (e.g. LR4429416 or P - LR4429416)
    const docMatches = fullText.match(/(?:P\s*[-–]\s*)?([A-Z]{1,2}\d{6,9})\b/gi) || [];
    docMatches.forEach((doc, idx) => {
      const cleanDoc = doc.replace(/^[Pp]\s*[-–]\s*/, '').trim();
      if (passengers[idx]) {
        passengers[idx].documentNumber = cleanDoc;
      }
    });

    // If no passengers detected, create 1 blank default
    if (passengers.length === 0) {
      passengers.push({
        name: '',
        ticketType: 'ADULT',
        ticketNumber: '',
        documentNumber: '',
        fareBuy: 0,
        fareSell: 0,
        tax1: 0,
        tax2: 0,
        charge: 0,
      });
    }

    return {
      pnr: pnr || '',
      bookingRef: bookingRef || '',
      airline: airline || '',
      routeFrom: routeFrom || '',
      routeTo: routeTo || '',
      travelDate: travelDate || '',
      issueDate: issueDate || '',
      returnDate: returnDate || '',
      tripType: returnDate ? 'ROUND_TRIP' : 'ONE_WAY',
      passengers,
    };
  }
}

