import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

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
  aiEngineUsed?: string;
}

// English prompt works much better with Llama & GPT models
const TICKET_PARSER_PROMPT = `You are an expert flight e-ticket and travel voucher parser. Your job is to extract structured data from PDF-extracted text.

IMPORTANT RULES:
1. ONLY extract data that actually exists in the text. Never invent or guess data.
2. If a field is not found, use empty string "".
3. Return date in standard ISO format YYYY-MM-DD (e.g. 2026-08-13).

FIELD EXTRACTION GUIDE:
- pnr: A 5-8 character alphanumeric code after "PNR" label (e.g., E7A9G51978, NNRSF2, B5M7QP).
- bookingRef: Booking reference like FL-C4D4AD or FL-89EDF8.

- issueDate: Date of issuance (تاريخ الإصدار). Convert to YYYY-MM-DD (e.g., "2026/08/08" -> "2026-08-08").
- travelDate: The departure flight date (تاريخ السفر / الذهاب). Convert Arabic month names:
  * "الخميس، 13 أغسطس 2026" -> "2026-08-13"
  * "13/08/2026" -> "2026-08-13"
- returnDate: Return flight date if round-trip (تاريخ العودة).
  * "السبت، 29 أغسطس 2026" -> "2026-08-29"
- tripType: "ONE_WAY" or "ROUND_TRIP"

- Arabic Month Translation Reference:
  * يناير = 01, فبراير = 02, مارس = 03, أبريل = 04, مايو = 05, يونيو = 06
  * يوليو = 07, أغسطس/آب = 08, سبتمبر/أيلول = 09, أكتوبر/تشرين الأول = 10, نوفمبر/تشرين الثاني = 11, ديسمبر/كانون الأول = 12

- airline: Identify the airline from flight code (e.g. "ME 318" -> طيران الشرق الأوسط) or Arabic airline name.
  * ME = طيران الشرق الأوسط (Middle East Airlines)
  * IA/1A = الخطوط الجوية العراقية (Iraqi Airways)
  * QB = طيران قشم (Qeshm Air)
  * AXV = آفا إيرلاينز (Ava Airlines)
  * CPN/IV = كاسبيان إيرلاين (Caspian Airlines)
  * TK = الخطوط التركية (Turkish Airlines)
  * PC = طيران بيغاسوس (Pegasus Airlines)
  * FZ = فلاي دبي (Flydubai)
  * G9 = العربية للطيران (Air Arabia)
  * W5 = ماهان إير (Mahan Air)
  * JI/J1 = طيران معراج (Meraj Airlines)
  * IF = فلاي بغداد (Fly Baghdad)
  * EK = طيران الإمارات (Emirates)
  * QR = الخطوط القطرية (Qatar Airways)
  * SV = الخطوط السعودية (Saudia)
  * RJ = الملكية الأردنية (Royal Jordanian)

- routeFrom: 3-letter IATA departure airport (e.g., BEY, BGW, NJF, BSR, EBL, IKA, MHD, IST, DXB).
- routeTo: 3-letter IATA arrival airport (e.g., BGW, BEY, IKA, MHD, IST).

- passengers: Array of passenger objects in the EXACT table row order:
  * name: Full passenger name without title, or with title (e.g. "Mrs ZAHRA ALKHODARI" -> "ZAHRA ALKHODARI" or "Mrs ZAHRA ALKHODARI").
  * ticketType: "ADULT" (بالغ), "CHILD" (طفل), or "INFANT" (رضيع). Look at the النوع column!
  * documentNumber: Passport/ID number from الوثيقة column (e.g., "LR4429416" or "P - LR4429416" -> "LR4429416").
  * ticketNumber: E-Ticket number from التذكرة الإلكترونية column (e.g., "0762300332188", "076-2300332188").

CRITICAL WARNINGS:
1. NEVER USE PHONE NUMBERS (like +964 7847132050, 9647847132050, 078..., 077..., 075...) AS TICKET NUMBERS. Phone numbers are agency contact info!
2. Match EACH passenger to their OWN ticket number and document number on the same row. Do not shift ticket numbers!
3. If passenger is labeled "طفل", set ticketType = "CHILD". If "بالغ", set ticketType = "ADULT".

Return ONLY valid JSON:
{"pnr":"","bookingRef":"","airline":"","routeFrom":"","routeTo":"","issueDate":"YYYY-MM-DD","travelDate":"YYYY-MM-DD","returnDate":"YYYY-MM-DD","tripType":"ONE_WAY","passengers":[{"name":"","ticketType":"ADULT","ticketNumber":"","documentNumber":""}]}`;

@Injectable()
export class SmartParserService {
  /**
   * AI-Only Ticket Parser
   * Priority: Groq (free, fast) → Google Gemini (free) → OpenAI GPT-4o (paid)
   */
  async parseTicketFile(fileBuffer: Buffer, mimetype: string, textContent?: string): Promise<ParsedTicketDataDto> {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const content = textContent || fileBuffer.toString('utf-8');

    // Log the text being sent to AI for debugging
    console.log('📄 Text content being sent to AI (first 500 chars):');
    console.log(content.substring(0, 500));
    console.log('---');

    // 1. Try Groq first (free, fastest, no regional restrictions)
    if (groqKey && groqKey.trim().length > 10) {
      try {
        console.log('🤖 Invoking Groq Llama 3.3 70B for E-Ticket Parsing...');
        const result = await this.parseWithGroq(groqKey.trim(), content);
        if (result) {
          return { ...result, aiEngineUsed: 'Groq Llama 3.3 70B' };
        }
      } catch (err: any) {
        console.warn('Groq parsing failed:', err?.message || err);
      }
    }

    // 2. Try Google Gemini (free)
    if (geminiKey && geminiKey.trim().length > 10) {
      try {
        console.log('🤖 Trying Google Gemini 2.0 Flash...');
        const result = await this.parseWithGemini(geminiKey.trim(), content, 'gemini-2.0-flash');
        if (result) {
          return { ...result, aiEngineUsed: 'Google Gemini 2.0 Flash' };
        }
      } catch (err: any) {
        console.warn('Gemini failed:', err?.message?.substring(0, 120) || err);
      }
    }

    // 3. Try OpenAI GPT-4o (paid)
    if (openaiKey && openaiKey.trim().startsWith('sk-')) {
      try {
        console.log('🤖 Invoking OpenAI GPT-4o for E-Ticket Parsing...');
        const result = await this.parseWithOpenAi(openaiKey.trim(), content);
        if (result) {
          return { ...result, aiEngineUsed: 'OpenAI GPT-4o' };
        }
      } catch (err: any) {
        console.warn('OpenAI parsing failed:', err?.message || err);
      }
    }

    // 4. Built-in Local Rule Engine (Zero-Failure Fallback)
    console.log('🤖 Invoking Built-in Smart Parser Engine (Zero-Failure Fallback)...');
    const localResult = this.parseWithRuleEngine(content);
    return { ...localResult, aiEngineUsed: 'المحرك الذكي المحلي المدمج (Rule Engine)' };
  }

  /* ─── Groq (Free — Llama 3.3 70B) ─── */
  private async parseWithGroq(apiKey: string, textContent: string): Promise<ParsedTicketDataDto | null> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an AI that extracts flight ticket data from PDF text into JSON. Only extract what exists in the text. Never invent data. Return only valid JSON.'
          },
          {
            role: 'user',
            content: `${TICKET_PARSER_PROMPT}\n\n--- RAW TICKET TEXT FROM PDF ---\n${textContent}\n--- END OF TICKET TEXT ---`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq: ${response.status} - ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Groq returned empty response');

    const parsedJson = JSON.parse(content);
    console.log('✅ Groq parsed result:', JSON.stringify(parsedJson, null, 2));
    return this.normalizeResult(parsedJson);
  }

  /* ─── Google Gemini ─── */
  private async parseWithGemini(apiKey: string, textContent: string, model: string): Promise<ParsedTicketDataDto | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${TICKET_PARSER_PROMPT}\n\n--- RAW TICKET TEXT FROM PDF ---\n${textContent}\n--- END OF TICKET TEXT ---` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.0,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini ${model}: ${response.status} - ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('Gemini returned empty response');

    const cleanJson = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsedJson = JSON.parse(cleanJson);
    console.log('✅ Gemini parsed successfully');
    return this.normalizeResult(parsedJson);
  }

  /* ─── OpenAI GPT-4o (Paid) ─── */
  private async parseWithOpenAi(apiKey: string, textContent: string): Promise<ParsedTicketDataDto | null> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an AI that extracts flight ticket data from PDF text into JSON. Only extract what exists in the text. Never invent data. Return only valid JSON.'
          },
          {
            role: 'user',
            content: `${TICKET_PARSER_PROMPT}\n\n--- RAW TICKET TEXT FROM PDF ---\n${textContent}\n--- END OF TICKET TEXT ---`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI: ${response.status} - ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty response');

    const parsedJson = JSON.parse(content);
    console.log('✅ OpenAI parsed successfully');
    return this.normalizeResult(parsedJson);
  }

  /* ─── Helper: Clean Ticket Number (Exclude Phone Numbers) ─── */
  private cleanTicketNumber(raw?: string): string {
    if (!raw) return '';
    const clean = raw.replace(/\D/g, '');
    // If it is an Iraqi / International phone number like 9647847132050 or 07847132050, discard it
    if (/^(?:964|00964)?(?:7\d{9})$/.test(clean) || clean.length < 8) {
      return '';
    }
    return clean;
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

    return {
      pnr: parsedJson.pnr || '',
      bookingRef: parsedJson.bookingRef || '',
      airline: parsedJson.airline || '',
      routeFrom: parsedJson.routeFrom || '',
      routeTo: parsedJson.routeTo || '',
      issueDate: issueDate,
      travelDate: travelDate,
      returnDate: returnDate,
      tripType: parsedJson.tripType || (returnDate ? 'ROUND_TRIP' : 'ONE_WAY'),
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
          fareBuy: 0,
          fareSell: 0,
          tax1: 0,
          tax2: 0,
          charge: 0,
        };
      }),
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

    // Extract valid 10-13 digit e-tickets, strictly ignoring phone numbers
    const allNumeric = fullText.match(/\b(\d{10,14})\b/g) || [];
    const validTkts = allNumeric
      .map(n => this.cleanTicketNumber(n))
      .filter(Boolean);

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
      airline: airline || 'طيران الشرق الأوسط',
      routeFrom: routeFrom || 'BEY',
      routeTo: routeTo || 'BGW',
      travelDate: travelDate || '',
      issueDate: issueDate || '',
      returnDate: returnDate || '',
      tripType: returnDate ? 'ROUND_TRIP' : 'ONE_WAY',
      passengers,
    };
  }
}

