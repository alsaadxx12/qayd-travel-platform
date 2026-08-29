import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Tooltip, Switch, SegmentedControl } from '@mantine/core';
import {
  Activity,
  AlertTriangle,
  Copy,
  Download,
  Gauge,
  RotateCcw,
  Timer,
  Zap,
} from 'lucide-react';
import {
  perfMonitor,
  SLOW_THRESHOLD_MS,
  CRITICAL_THRESHOLD_MS,
  fmtDuration,
} from '../../../utils/perfMonitor';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { showSuccessNotification, showErrorNotification } from '../../../utils/notifications';

/**
 * Network profiler panel.
 *
 * Reads from `perfMonitor`, which every `apiRequest` reports into. The point is to
 * replace "the app feels slow" with a table naming the endpoint, the screen it was
 * called from, and how many milliseconds it cost — and to hand that over as a
 * pasteable report.
 */
export const PerformanceInspector: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<'endpoints' | 'routes' | 'slowest'>('endpoints');
  const [onlySlow, setOnlySlow] = useState(true);
  // Bumping this is what re-reads the monitor; the samples live outside React.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Only subscribe while the panel is open — a closed panel must cost nothing.
    if (!opened) return;
    const unsubscribe = perfMonitor.subscribe(() => setTick((t) => t + 1));
    return () => {
      unsubscribe();
    };
  }, [opened]);

  // The badge needs the slow count even while closed, so it polls slowly.
  const [badgeCount, setBadgeCount] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setBadgeCount(perfMonitor.getSummary().slowCount);
    }, 4000);
    setBadgeCount(perfMonitor.getSummary().slowCount);
    return () => window.clearInterval(id);
  }, []);

  const summary = useMemo(() => perfMonitor.getSummary(), [tick, opened]);
  const endpoints = useMemo(() => perfMonitor.getEndpointStats(), [tick, opened]);
  const routes = useMemo(() => perfMonitor.getRouteStats(), [tick, opened]);
  const slowest = useMemo(
    () =>
      [...perfMonitor.getSamples()]
        .filter((s) => !s.cached)
        .sort((a, b) => b.ms - a.ms)
        .slice(0, 40),
    [tick, opened],
  );

  const visibleEndpoints = onlySlow
    ? endpoints.filter((e) => e.slow > 0 || e.max >= SLOW_THRESHOLD_MS)
    : endpoints;

  const copyReport = useCallback(async () => {
    const md = perfMonitor.toMarkdown();
    try {
      await navigator.clipboard.writeText(md);
      showSuccessNotification(
        isAr ? 'تم نسخ التقرير' : 'Report copied',
        isAr ? 'الصقه في المحادثة لأحلل المشاكل.' : 'Paste it into the chat for analysis.',
      );
    } catch {
      // Clipboard is blocked outside a secure context; fall back to a download.
      downloadReport('md');
      showErrorNotification(
        isAr ? 'تعذّر النسخ' : 'Copy blocked',
        isAr ? 'نزّلنا التقرير كملف بدلاً من ذلك.' : 'Downloaded the report as a file instead.',
      );
    }
  }, [isAr]);

  const downloadReport = useCallback((kind: 'md' | 'json') => {
    const content = kind === 'md' ? perfMonitor.toMarkdown() : perfMonitor.toJSON();
    const blob = new Blob([content], {
      type: kind === 'md' ? 'text/markdown;charset=utf-8' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qayd-performance-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${kind}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const tone = (ms: number) =>
    ms >= CRITICAL_THRESHOLD_MS
      ? 'text-rose-700 bg-rose-50 border-rose-200'
      : ms >= SLOW_THRESHOLD_MS
        ? 'text-amber-800 bg-amber-50 border-amber-200'
        : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  const Stat: React.FC<{ label: string; value: React.ReactNode; danger?: boolean }> = ({
    label,
    value,
    danger,
  }) => (
    <div
      className={`rounded-xl border px-3 py-2 ${
        danger ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
      }`}
    >
      <div className="text-[10px] font-bold text-slate-500 truncate">{label}</div>
      <div
        className={`font-mono font-black text-[15px] tabular-nums ${
          danger ? 'text-rose-700' : 'text-slate-900'
        }`}
        style={{ fontFeatureSettings: '"locl" 0' }}
        lang="en"
      >
        {value}
      </div>
    </div>
  );

  return (
    <>
      <Tooltip label={isAr ? 'فاحص الأداء' : 'Performance inspector'} withArrow position="bottom">
        <button
          type="button"
          onClick={() => setOpened(true)}
          aria-label={isAr ? 'فتح فاحص أداء الشبكة' : 'Open network performance inspector'}
          className="relative w-9 h-9 rounded-[9px] hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <Gauge size={18} />
          {badgeCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#F45A0A] text-white text-[9px] font-black flex items-center justify-center">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </button>
      </Tooltip>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        size="1080px"
        radius="16px"
        centered
        dir={direction}
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
              <Activity size={18} />
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-sm leading-tight">
                {isAr ? 'فاحص أداء الشبكة' : 'Network performance inspector'}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {isAr
                  ? `يُعتبر النداء بطيئاً عند تجاوزه ${SLOW_THRESHOLD_MS} مللي ثانية`
                  : `A call counts as slow past ${SLOW_THRESHOLD_MS}ms`}
              </div>
            </div>
          </div>
        }
      >
        <div className="space-y-3 font-sans" dir={direction}>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Stat label={isAr ? 'نداءات الشبكة' : 'Network calls'} value={summary.networkCalls} />
            <Stat
              label={isAr ? `بطيئة (≥${SLOW_THRESHOLD_MS}ms)` : `Slow (≥${SLOW_THRESHOLD_MS}ms)`}
              value={summary.slowCount}
              danger={summary.slowCount > 0}
            />
            <Stat
              label={isAr ? `حرجة (≥${CRITICAL_THRESHOLD_MS}ms)` : `Critical (≥${CRITICAL_THRESHOLD_MS}ms)`}
              value={summary.criticalCount}
              danger={summary.criticalCount > 0}
            />
            <Stat label={isAr ? 'المتوسط' : 'Average'} value={`${summary.avg}ms`} />
            <Stat label="p95" value={`${summary.p95}ms`} />
            <Stat
              label={isAr ? 'من الكاش' : 'From cache'}
              value={summary.cacheHits}
            />
          </div>

          {summary.networkCalls === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center">
              <Timer size={22} className="mx-auto text-slate-400 mb-1.5" />
              <p className="text-[13px] font-bold text-slate-700">
                {isAr ? 'لا توجد قياسات بعد' : 'No measurements yet'}
              </p>
              <p className="text-[11.5px] text-slate-500 font-medium">
                {isAr
                  ? 'تنقّل بين الصفحات قليلاً ثم افتح هذه النافذة مرة أخرى.'
                  : 'Move around the app for a moment, then reopen this panel.'}
              </p>
            </div>
          )}

          {summary.networkCalls > 0 && (
            <>
              {/* Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SegmentedControl
                  size="xs"
                  radius="10px"
                  value={tab}
                  onChange={(v) => setTab(v as any)}
                  data={[
                    { label: isAr ? 'حسب النداء' : 'By endpoint', value: 'endpoints' },
                    { label: isAr ? 'حسب الصفحة' : 'By page', value: 'routes' },
                    { label: isAr ? 'الأبطأ' : 'Slowest', value: 'slowest' },
                  ]}
                />

                <div className="flex items-center gap-2">
                  {tab === 'endpoints' && (
                    <Switch
                      size="xs"
                      color="orange"
                      checked={onlySlow}
                      onChange={(e) => setOnlySlow(e.currentTarget.checked)}
                      label={isAr ? 'البطيئة فقط' : 'Slow only'}
                    />
                  )}
                  <Tooltip label={isAr ? 'تصفير القياسات' : 'Reset measurements'} withArrow>
                    <button
                      type="button"
                      onClick={() => {
                        perfMonitor.clear();
                        setTick((t) => t + 1);
                      }}
                      aria-label={isAr ? 'تصفير القياسات' : 'Reset measurements'}
                      className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center cursor-pointer"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Tables */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="max-h-[46vh] overflow-auto">
                  {tab === 'endpoints' && (
                    <table className="w-full text-[11.5px] border-collapse">
                      <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:font-bold [&_th]:text-slate-600 [&_th]:text-center [&_th]:shadow-[inset_0_-1px_0_#e2e8f0]">
                        <tr>
                          <th className="text-start! ps-3!">{isAr ? 'النداء' : 'Endpoint'}</th>
                          <th>{isAr ? 'مرات' : 'Calls'}</th>
                          <th>{isAr ? 'كاش' : 'Cache'}</th>
                          <th>{isAr ? 'بطيء' : 'Slow'}</th>
                          <th>{isAr ? 'متوسط' : 'Avg'}</th>
                          <th>p95</th>
                          <th>{isAr ? 'الأقصى' : 'Max'}</th>
                          <th>{isAr ? 'الإجمالي' : 'Total'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleEndpoints.map((e) => (
                          <tr key={e.key} className="hover:bg-orange-50/30">
                            <td className="p-2 ps-3 font-mono text-slate-800 max-w-[330px] truncate" title={e.key} dir="ltr">
                              {e.key}
                            </td>
                            <td className="p-2 text-center font-mono tabular-nums">{e.calls}</td>
                            <td className="p-2 text-center font-mono tabular-nums text-emerald-700">
                              {e.cacheHits}
                            </td>
                            <td className="p-2 text-center font-mono tabular-nums font-bold">
                              {e.slow > 0 ? <span className="text-rose-700">{e.slow}</span> : '—'}
                            </td>
                            <td className="p-2 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded border font-mono font-bold tabular-nums ${tone(e.avg)}`}>
                                {e.avg}
                              </span>
                            </td>
                            <td className="p-2 text-center font-mono tabular-nums">{e.p95}</td>
                            <td className="p-2 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded border font-mono font-bold tabular-nums ${tone(e.max)}`}>
                                {e.max}
                              </span>
                            </td>
                            <td className="p-2 text-center font-mono tabular-nums font-bold text-slate-700">
                              {e.total}
                            </td>
                          </tr>
                        ))}
                        {visibleEndpoints.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-6 text-center text-slate-500 font-bold">
                              <Zap size={18} className="inline-block me-1.5 text-emerald-600" />
                              {isAr ? 'لا يوجد نداء بطيء — كل شيء تحت الحد.' : 'Nothing slow — all calls are under the threshold.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {tab === 'routes' && (
                    <table className="w-full text-[11.5px] border-collapse">
                      <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:font-bold [&_th]:text-slate-600 [&_th]:text-center [&_th]:shadow-[inset_0_-1px_0_#e2e8f0]">
                        <tr>
                          <th className="text-start! ps-3!">{isAr ? 'الصفحة' : 'Page'}</th>
                          <th>{isAr ? 'نداءات' : 'Calls'}</th>
                          <th>{isAr ? 'بطيئة' : 'Slow'}</th>
                          <th>{isAr ? 'الأبطأ' : 'Worst'}</th>
                          <th>{isAr ? 'إجمالي الانتظار' : 'Total wait'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {routes.map((r) => (
                          <tr key={r.route} className="hover:bg-orange-50/30">
                            <td className="p-2 ps-3 font-mono text-slate-800" dir="ltr">{r.route}</td>
                            <td className="p-2 text-center font-mono tabular-nums">{r.calls}</td>
                            <td className="p-2 text-center font-mono tabular-nums font-bold">
                              {r.slow > 0 ? <span className="text-rose-700">{r.slow}</span> : '—'}
                            </td>
                            <td className="p-2 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded border font-mono font-bold tabular-nums ${tone(r.max)}`}>
                                {r.max}
                              </span>
                            </td>
                            <td className="p-2 text-center font-mono tabular-nums font-bold text-slate-700">
                              {fmtDuration(r.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {tab === 'slowest' && (
                    <table className="w-full text-[11.5px] border-collapse">
                      <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:font-bold [&_th]:text-slate-600 [&_th]:text-center [&_th]:shadow-[inset_0_-1px_0_#e2e8f0]">
                        <tr>
                          <th>{isAr ? 'الزمن' : 'Time'}</th>
                          <th className="text-start!">{isAr ? 'النداء' : 'Endpoint'}</th>
                          <th className="text-start!">{isAr ? 'الصفحة' : 'Page'}</th>
                          <th>{isAr ? 'الحالة' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {slowest.map((s, i) => (
                          <tr key={`${s.at}-${i}`} className="hover:bg-orange-50/30">
                            <td className="p-2 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded border font-mono font-bold tabular-nums ${tone(s.ms)}`}>
                                {s.ms}ms
                              </span>
                            </td>
                            <td className="p-2 font-mono text-slate-800 max-w-[380px] truncate" title={`${s.method} ${s.endpoint}`} dir="ltr">
                              {s.method} {s.endpoint}
                            </td>
                            <td className="p-2 font-mono text-slate-500" dir="ltr">{s.route}</td>
                            <td className="p-2 text-center">
                              {s.ok ? (
                                <span className="text-emerald-700 font-bold">{isAr ? 'ناجح' : 'OK'}</span>
                              ) : (
                                <Tooltip label={s.error || ''} withArrow>
                                  <span className="text-rose-700 font-bold inline-flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    {isAr ? 'فشل' : 'Failed'}
                                  </span>
                                </Tooltip>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Export */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
            <p className="text-[11px] text-slate-500 font-medium max-w-[420px]">
              {isAr
                ? 'انسخ التقرير وألصقه في المحادثة — يحتوي على النداءات والصفحات والأزمنة.'
                : 'Copy the report and paste it into the chat — it carries endpoints, pages and timings.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadReport('json')}
                disabled={summary.total === 0}
                aria-label={isAr ? 'تنزيل التقرير بصيغة JSON' : 'Download report as JSON'}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download size={14} />
                JSON
              </button>
              <button
                type="button"
                onClick={() => downloadReport('md')}
                disabled={summary.total === 0}
                aria-label={isAr ? 'تنزيل التقرير كملف' : 'Download report file'}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download size={14} />
                {isAr ? 'ملف' : 'File'}
              </button>
              <button
                type="button"
                onClick={copyReport}
                disabled={summary.total === 0}
                aria-label={isAr ? 'نسخ ملخص الأداء' : 'Copy performance summary'}
                className="h-9 px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <Copy size={14} />
                {isAr ? 'نسخ الملخص' : 'Copy summary'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default PerformanceInspector;
