import React from 'react';
import { clsx } from 'clsx';
import { useLanguageStore } from '../../store/useLanguageStore';

export interface TicketCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Main body content */
  children?: React.ReactNode;
  /** Stub / tear-off section content */
  stub?: React.ReactNode;
  /** Layout orientation: horizontal (side-by-side) or vertical (stacked) */
  orientation?: 'horizontal' | 'vertical';
  /** Position of the stub relative to main content */
  stubPosition?: 'end' | 'start' | 'bottom' | 'top';
  /** Width or percentage of the stub in horizontal mode (e.g. '180px', '28%') */
  stubSize?: string;
  /** Diameter of the circular cutouts/notches in pixels (default 22) */
  notchSize?: number;
  /** Card background color class (default 'bg-white') */
  bgClassName?: string;
  /** Card border color class (default 'border-slate-200') */
  borderClassName?: string;
  /** Show perforated dashed separator line (default true) */
  showPerforation?: boolean;
  /** Optional header ribbon or bar */
  headerRibbon?: React.ReactNode;
}

/**
 * TicketCard: A production-ready, reusable physical airline ticket / boarding pass container
 * Featuring authentic dual semi-circular cutouts, perforated tear line, and full RTL/LTR support.
 */
export const TicketCard: React.FC<TicketCardProps> = ({
  children,
  stub,
  orientation = 'horizontal',
  stubPosition = 'end',
  stubSize = '170px',
  notchSize = 22,
  bgClassName = 'bg-white',
  borderClassName = 'border-slate-200',
  showPerforation = true,
  headerRibbon,
  className,
  style,
  ...props
}) => {
  const { direction } = useLanguageStore();
  const isRtl = direction === 'rtl';

  const isHorizontal = orientation === 'horizontal';
  const halfNotch = notchSize / 2;

  // Determine flex direction based on stubPosition and RTL
  let flexDirectionClass = 'flex-row';
  let isStubAtEnd = stubPosition === 'end';

  if (isHorizontal) {
    if (stubPosition === 'start') {
      flexDirectionClass = isRtl ? 'flex-row' : 'flex-row-reverse';
    } else {
      flexDirectionClass = isRtl ? 'flex-row-reverse' : 'flex-row';
    }
  } else {
    flexDirectionClass = stubPosition === 'top' ? 'flex-col-reverse' : 'flex-col';
  }

  return (
    <div
      className={clsx(
        'relative rounded-2xl border shadow-sm select-none transition-all print:border-solid print:shadow-none',
        bgClassName,
        borderClassName,
        className
      )}
      style={{
        // Using isolation to ensure mask/notches render cleanly on any backdrop
        isolation: 'isolate',
        ...style,
      }}
      {...props}
    >
      {/* Optional Top Header Ribbon */}
      {headerRibbon && (
        <div className="w-full rounded-t-2xl overflow-hidden print:bg-slate-100">
          {headerRibbon}
        </div>
      )}

      {/* Main Ticket Layout Container */}
      <div className={clsx('relative flex w-full h-full', flexDirectionClass)}>
        {/* Main Content Area */}
        <div className="flex-1 p-4 sm:p-5 min-w-0 flex flex-col justify-between">
          {children}
        </div>

        {/* Perforated Separator with Real Semi-Circular Notches */}
        {stub && (
          <div
            className={clsx(
              'relative flex items-center justify-center shrink-0 z-10',
              isHorizontal ? 'flex-col' : 'flex-row'
            )}
            style={{
              [isHorizontal ? 'width' : 'height']: '1px',
            }}
          >
            {/* Top Notch (in Horizontal) or Left Notch (in Vertical) */}
            {isHorizontal ? (
              <>
                {/* Top Notch */}
                <div
                  className={clsx(
                    'absolute top-0 -translate-y-1/2 rounded-full border bg-slate-100/90 shadow-inner pointer-events-none print:hidden',
                    borderClassName
                  )}
                  style={{
                    width: notchSize,
                    height: notchSize,
                    left: `-${halfNotch}px`,
                    background: '#F8FAFC',
                  }}
                />

                {/* Perforated Dashed Tear Line */}
                {showPerforation && (
                  <div
                    className="w-px h-full my-3 border-r-2 border-dashed border-slate-300"
                    style={{
                      borderRightStyle: 'dashed',
                    }}
                  />
                )}

                {/* Bottom Notch */}
                <div
                  className={clsx(
                    'absolute bottom-0 translate-y-1/2 rounded-full border bg-slate-100/90 shadow-inner pointer-events-none print:hidden',
                    borderClassName
                  )}
                  style={{
                    width: notchSize,
                    height: notchSize,
                    left: `-${halfNotch}px`,
                    background: '#F8FAFC',
                  }}
                />
              </>
            ) : (
              <>
                {/* Left Notch */}
                <div
                  className={clsx(
                    'absolute left-0 -translate-x-1/2 rounded-full border bg-slate-100/90 shadow-inner pointer-events-none print:hidden',
                    borderClassName
                  )}
                  style={{
                    width: notchSize,
                    height: notchSize,
                    top: `-${halfNotch}px`,
                    background: '#F8FAFC',
                  }}
                />

                {/* Perforated Dashed Tear Line */}
                {showPerforation && (
                  <div
                    className="h-px w-full mx-3 border-b-2 border-dashed border-slate-300"
                    style={{
                      borderBottomStyle: 'dashed',
                    }}
                  />
                )}

                {/* Right Notch */}
                <div
                  className={clsx(
                    'absolute right-0 translate-x-1/2 rounded-full border bg-slate-100/90 shadow-inner pointer-events-none print:hidden',
                    borderClassName
                  )}
                  style={{
                    width: notchSize,
                    height: notchSize,
                    top: `-${halfNotch}px`,
                    background: '#F8FAFC',
                  }}
                />
              </>
            )}
          </div>
        )}

        {/* Stub / Tear-off Section */}
        {stub && (
          <div
            className="p-3.5 sm:p-4 bg-slate-50/75 rounded-2xl flex flex-col justify-between shrink-0"
            style={{
              [isHorizontal ? 'width' : 'height']: stubSize,
            }}
          >
            {stub}
          </div>
        )}
      </div>
    </div>
  );
};
