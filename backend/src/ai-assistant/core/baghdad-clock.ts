const TZ = 'Asia/Baghdad';

function parts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const bag = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    y: Number(bag.year),
    m: Number(bag.month),
    d: Number(bag.day),
    hour: bag.hour,
    minute: bag.minute,
  };
}

export function baghdadYmd(date = new Date()): string {
  const p = parts(date);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function baghdadClock(date = new Date()): string {
  const p = parts(date);
  return `${p.hour}:${p.minute}`;
}

export function baghdadLongAr(date = new Date()): string {
  return new Intl.DateTimeFormat('ar-IQ', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function nowContextLine(date = new Date()): string {
  return `التاريخ والوقت الحالي (بغداد): ${baghdadLongAr(date)} — ${baghdadYmd(date)} ${baghdadClock(date)}`;
}

export function utcYmd(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}
