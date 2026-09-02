import React, { useEffect, useRef, useState } from 'react';

const VIDEO_URL =
  'https://res-a.cloneweb.ai/prompt/web-design/prompt-assets/prompt-040505207cb53470/hf-20260611-104107-121bfb5a-b1df-4e0d-8240-25b81f7cc85d.mp4';

export const ScrollVideo: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement | null>(null);

  const [frames, setFrames] = useState<ImageBitmap[]>([]);
  const [framesReady, setFramesReady] = useState(false);

  // Animation and progress refs
  const smoothedProgressRef = useRef<number>(0);
  const targetProgressRef = useRef<number>(0);
  const currentFrameIndexRef = useRef<number>(-1);
  const isSeekingRef = useRef<boolean>(false);
  const framesRef = useRef<ImageBitmap[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // Keep framesRef in sync
  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  // 1. Frame Extraction
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    let videoEl: HTMLVideoElement | null = null;
    const extractedBitmaps: ImageBitmap[] = [];

    const loadAndExtract = async () => {
      try {
        const response = await fetch(VIDEO_URL);
        if (!response.ok) throw new Error('Video fetch failed');
        const blob = await response.blob();
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        videoEl = document.createElement('video');
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.preload = 'auto';
        videoEl.src = objectUrl;

        await new Promise<void>((resolve, reject) => {
          if (!videoEl) return reject();
          videoEl.onloadedmetadata = () => resolve();
          videoEl.onerror = () => reject(new Error('Video metadata error'));
        });

        if (cancelled) return;

        const duration = videoEl.duration || 1;
        const videoWidth = videoEl.videoWidth || 1280;
        const videoHeight = videoEl.videoHeight || 720;

        // Scale to max width 1280
        const scale = Math.min(1, 1280 / videoWidth);
        const targetWidth = Math.round(videoWidth * scale);
        const targetHeight = Math.round(videoHeight * scale);

        // Frame count = clamp(round(duration * 24), 30, 120)
        const frameCount = Math.min(Math.max(Math.round(duration * 24), 30), 120);
        const effectiveDuration = Math.max(0.1, duration - 0.05);

        for (let i = 0; i < frameCount; i++) {
          if (cancelled) break;
          const time = (i / (frameCount - 1)) * effectiveDuration;

          await new Promise<void>((resolve) => {
            if (!videoEl) return resolve();
            videoEl.currentTime = time;
            videoEl.onseeked = () => resolve();
          });

          if (cancelled) break;

          const bitmap = await createImageBitmap(videoEl, {
            resizeWidth: targetWidth,
            resizeHeight: targetHeight,
            resizeQuality: 'medium',
          });

          extractedBitmaps.push(bitmap);
        }

        if (!cancelled && extractedBitmaps.length > 0) {
          setFrames(extractedBitmaps);
          setFramesReady(true);
        }
      } catch (err) {
        // In case of CORS or memory error, smoothly fallback to standard scrubbing
        console.warn('Frame pre-extraction fallback to video element:', err);
      }
    };

    loadAndExtract();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      extractedBitmaps.forEach((bmp) => bmp.close());
      framesRef.current.forEach((bmp) => bmp.close());
    };
  }, []);

  // 2. Scroll Progress & Animation Loop
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const innerHeight = window.innerHeight;
      const scrollRange = scrollHeight - innerHeight;
      const scrollY = window.scrollY || window.pageYOffset;
      const progress = scrollRange > 0 ? Math.min(Math.max(scrollY / scrollRange, 0), 1) : 0;
      targetProgressRef.current = progress;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // Canvas resize handling
    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        currentFrameIndexRef.current = -1; // Force redraw on resize
      }
    };

    window.addEventListener('resize', updateCanvasSize);
    updateCanvasSize();

    // Render loop
    const renderLoop = () => {
      // Smooth progress: smoothed += (target - smoothed) * 0.1
      smoothedProgressRef.current +=
        (targetProgressRef.current - smoothedProgressRef.current) * 0.1;

      const smoothed = smoothedProgressRef.current;
      const activeFrames = framesRef.current;

      if (activeFrames.length > 0) {
        const frameIndex = Math.min(
          Math.max(Math.floor(smoothed * activeFrames.length), 0),
          activeFrames.length - 1
        );

        if (frameIndex !== currentFrameIndexRef.current) {
          currentFrameIndexRef.current = frameIndex;
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          const bitmap = activeFrames[frameIndex];

          if (canvas && ctx && bitmap) {
            const cw = canvas.width;
            const ch = canvas.height;
            const bw = bitmap.width;
            const bh = bitmap.height;

            // "Cover" math: max ratio, center the overflow
            const scale = Math.max(cw / bw, ch / bh);
            const sw = bw * scale;
            const sh = bh * scale;
            const sx = (cw - sw) / 2;
            const sy = (ch - sh) / 2;

            ctx.clearRect(0, 0, cw, ch);
            ctx.drawImage(bitmap, sx, sy, sw, sh);
          }
        }
      } else {
        // Fallback video scrubbing
        const video = fallbackVideoRef.current;
        if (video && video.duration && !isSeekingRef.current) {
          const targetTime = smoothed * (video.duration - 0.05);
          if (Math.abs(video.currentTime - targetTime) > 0.001) {
            isSeekingRef.current = true;
            video.currentTime = targetTime;
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateCanvasSize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 bg-[#0a0a0a] overflow-hidden">
      {/* Canvas for pre-extracted ImageBitmap frames */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          framesReady ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback video element while frames are extracting */}
      {!framesReady && (
        <video
          ref={fallbackVideoRef}
          src={VIDEO_URL}
          muted
          playsInline
          preload="auto"
          onSeeked={() => {
            isSeekingRef.current = false;
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Contrast Overlay with subtle brand warmth */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      {/* Brand Color Ambient Glow (Brand Orange warmth) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-35 mix-blend-screen"
        style={{
          background:
            'radial-gradient(circle at 80% 20%, rgba(244,90,10,0.18) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(221,79,5,0.12) 0%, transparent 50%)',
        }}
      />
    </div>
  );
};
