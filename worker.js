/**
 * Worker الموقع: يقدّم ملفات الواجهة من frontend/dist، ويمرّر كل ما تحت /api إلى
 * الخادم (Railway) كما هو — الطريقة والترويسات والجسم دون تغيير.
 *
 * السبب: Webhook واتساب عند Meta يجب أن يكون على دومن الموقع نفسه
 * (https://…workers.dev/api/whatsapp/webhook)، والخادم يعيش على عنوانٍ آخر.
 * تمرير الجسم دون مساس شرطٌ لا زينة: توقيع Meta (X-Hub-Signature-256) يُحسب على
 * البايتات الخام، وأي إعادة تسلسل تُبطله.
 *
 * ويعني هذا أيضاً أن الواجهة تستطيع مناداة /api على دومنها إن أُريد لاحقاً.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const origin = (env.API_ORIGIN || 'https://qayd-travel-platform-production.up.railway.app').replace(/\/+$/, '');
    const target = `${origin}${url.pathname}${url.search}`;

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('x-forwarded-host', url.host);
    headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) headers.set('x-forwarded-for', clientIp);

    const hasBody = !['GET', 'HEAD'].includes(request.method);
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
    });

    // الاستجابة تُعاد كما جاءت؛ تُحذف ترويسات النقل التي لا معنى لها بعد الوسيط.
    const out = new Headers(upstream.headers);
    out.delete('content-encoding');
    out.delete('content-length');
    out.delete('transfer-encoding');
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
  },
};
