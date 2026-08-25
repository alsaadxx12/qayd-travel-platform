import React, { useState, useEffect, useRef, useMemo } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number; // Optional explicit duration overriding auto-calculation
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration,
  decimals = 2,
  prefix = '',
  suffix = '',
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const startValueRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Dynamic duration calculation:
  // Base duration: 2500ms for values <= 10,000.
  // For values > 10,000, duration scales down dynamically so larger numbers animate faster!
  const effectiveDuration = useMemo(() => {
    if (duration) return duration;
    const abs = Math.abs(value);
    if (abs <= 10000) return 2500;
    const factor = Math.log10(abs / 10000);
    return Math.max(700, Math.round(2500 - factor * 750));
  }, [value, duration]);

  useEffect(() => {
    const startVal = displayValue;
    const endVal = value;
    startValueRef.current = startVal;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / effectiveDuration, 1);

      // Ease-out cubic formula for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, effectiveDuration]);

  const formatted = displayValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {prefix && <span className="me-1">{prefix}</span>}
      {formatted}
      {suffix && <span className="ms-1">{suffix}</span>}
    </span>
  );
};
