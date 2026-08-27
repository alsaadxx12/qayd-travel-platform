import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconPaperclip, IconPlayerStop, IconSend, IconX, IconMicrophone } from '@tabler/icons-react';

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1024;
        let width = img.width;
        let height = img.height;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Silence detection config
const SILENCE_THRESHOLD = 30;       // Audio level below this = silence (higher = less sensitive to noise)
const SILENCE_DURATION_MS = 2000;   // Stop after 2s of silence
const MIN_RECORDING_MS = 1200;      // Minimum recording before silence detection kicks in

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  loading: boolean;
  isArabic: boolean;
  attachedName?: string | null;
  attachedPreview?: string | null;
  onAttach: (file: File) => void;
  onClearAttach: () => void;
}

export const Composer: React.FC<Props> = ({
  value,
  onChange,
  onSend,
  onStop,
  loading,
  isArabic,
  attachedName,
  attachedPreview,
  onAttach,
  onClearAttach,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const stoppingRef = useRef(false);

  const onSendRef = useRef(onSend);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  onSendRef.current = onSend;
  onChangeRef.current = onChange;
  valueRef.current = value;

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          onAttach(file);
          break;
        }
      }
    }
  };

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (_) { /* */ }
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    setVoiceLevel(0);
    setRecordingSeconds(0);
    setSilenceCountdown(null);
    silenceStartRef.current = null;
    stoppingRef.current = false;
  }, []);

  // Send audio to Whisper backend
  const transcribeAndSend = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size < 1000) return; // too short
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice.webm');

      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai-assistant/transcribe', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Transcription failed');
      }

      const data = await res.json();
      const text = data.text?.trim();

      if (text) {
        const existing = valueRef.current.trim();
        const newText = existing ? existing + ' ' + text : text;
        onChangeRef.current(newText);
        // Auto-send
        setTimeout(() => {
          onSendRef.current();
        }, 250);
      }
    } catch (err: any) {
      console.error('Whisper transcription error:', err);
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  // Internal stop that triggers transcription
  const doStop = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    const recorder = mediaRecorderRef.current;
    const mimeType = recorder?.mimeType || 'audio/webm';

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        transcribeAndSend(blob);
      };
      recorder.stop();
    }

    // Stop mic tracks
    if (recorder?.stream) {
      recorder.stream.getTracks().forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    cleanup();
  }, [cleanup, transcribeAndSend]);

  // Voice level + silence detection loop
  const monitorAudio = useCallback(() => {
    if (!analyserRef.current || stoppingRef.current) return;

    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
    const level = Math.min(5, Math.floor(avg / 20));
    setVoiceLevel(level);

    const now = Date.now();
    const elapsed = now - recordingStartRef.current;

    // Silence detection (only after minimum recording time)
    if (elapsed > MIN_RECORDING_MS) {
      if (avg < SILENCE_THRESHOLD) {
        // Silence detected
        if (!silenceStartRef.current) {
          silenceStartRef.current = now;
        }
        const silenceDuration = now - silenceStartRef.current;
        const remaining = Math.max(0, Math.ceil((SILENCE_DURATION_MS - silenceDuration) / 1000));
        setSilenceCountdown(remaining);

        if (silenceDuration >= SILENCE_DURATION_MS) {
          // Auto-stop!
          doStop();
          return;
        }
      } else {
        // Speech detected, reset silence timer
        silenceStartRef.current = null;
        setSilenceCountdown(null);
      }
    }

    animFrameRef.current = requestAnimationFrame(monitorAudio);
  }, [doStop]);

  const startRecording = useCallback(async () => {
    if (loading || isRecording || isTranscribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      // Audio analyser
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      stoppingRef.current = false;
      silenceStartRef.current = null;
      setIsRecording(true);
      setRecordingSeconds(0);
      setSilenceCountdown(null);

      // Timer for display
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);

      // Start monitoring
      animFrameRef.current = requestAnimationFrame(monitorAudio);

    } catch (err: any) {
      console.error('Microphone error:', err);
      alert(isArabic ? 'لا يمكن الوصول للميكروفون. تأكد من إعطاء الإذن.' : 'Cannot access microphone.');
    }
  }, [loading, isRecording, isTranscribing, isArabic, monitorAudio]);

  const toggleVoice = useCallback(() => {
    if (isRecording) {
      doStop();
    } else {
      startRecording();
    }
  }, [isRecording, doStop, startRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        try { mediaRecorderRef.current.stop(); } catch (_) { /* */ }
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        }
      }
      cleanup();
    };
  }, [cleanup]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Voice level bars
  const voiceBars = (
    <div className="flex items-end gap-[2px] h-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-all duration-75"
          style={{
            height: voiceLevel > i ? `${6 + i * 3}px` : '3px',
            backgroundColor: voiceLevel > i ? '#EF4444' : '#FCA5A5',
          }}
        />
      ))}
    </div>
  );

  const isProcessing = isRecording || isTranscribing;

  return (
    <div className="border-t border-slate-200/80 bg-white px-2.5 pt-2 pb-2.5">
      {(attachedName || attachedPreview) && (
        <div className="flex items-center gap-2 text-[11px] mb-2 px-2 py-1.5 rounded-xl bg-[#FFF7F0] border border-orange-100">
          {attachedPreview?.startsWith('data:image/') && (
            <img src={attachedPreview} alt="" className="w-9 h-9 rounded-lg object-cover border border-orange-200" />
          )}
          <span className="truncate flex-1 font-semibold text-[#9A3412]">
            {attachedName || (isArabic ? 'صورة ملصوقة' : 'Pasted image')}
          </span>
          <button
            type="button"
            onClick={onClearAttach}
            className="shrink-0 w-5 h-5 grid place-items-center rounded-md text-[#C2410C] hover:bg-orange-100"
            title={isArabic ? 'إزالة' : 'Remove'}
          >
            <IconX size={12} stroke={2.5} />
          </button>
        </div>
      )}

      {/* Recording indicator with silence countdown */}
      {isRecording && (
        <div className="flex items-center gap-2.5 mb-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200">
          <div className="relative flex items-center justify-center shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping absolute opacity-75" />
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 relative" />
          </div>
          {voiceBars}
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-bold text-red-700 block">
              {silenceCountdown !== null && silenceCountdown <= 1
                ? (isArabic ? '\u062c\u0627\u0631\u064d \u0627\u0644\u0625\u0631\u0633\u0627\u0644...' : 'Sending...')
                : (isArabic ? '\u062a\u062d\u062f\u0651\u062b... \u064a\u062a\u0648\u0642\u0641 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u0639\u0646\u062f \u0627\u0644\u0635\u0645\u062a' : 'Speak... auto-stops on silence')
              }
            </span>
          </div>
          <span className="text-[12px] font-mono font-bold text-red-600 tabular-nums shrink-0" dir="ltr">
            {formatTime(recordingSeconds)}
          </span>
          <button
            type="button"
            onClick={doStop}
            className="text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg transition-colors cursor-pointer shadow-sm shrink-0"
          >
            {isArabic ? '\u0625\u064a\u0642\u0627\u0641 \u0648\u0625\u0631\u0633\u0627\u0644 \u23F9' : 'Stop & Send \u23F9'}
          </button>
        </div>
      )}

      {/* Transcribing indicator */}
      {isTranscribing && (
        <div className="flex items-center gap-2.5 mb-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200">
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] font-bold text-orange-700">
            {isArabic ? 'جارٍ تحويل الصوت بالذكاء الاصطناعي...' : 'AI transcribing audio...'}
          </span>
        </div>
      )}

      <div className="flex items-end gap-1 bg-white rounded-2xl ps-1.5 pe-1.5 py-1.5 border border-slate-200 transition-shadow focus-within:border-[#F45A0A] focus-within:ring-2 focus-within:ring-orange-100">
        <Tooltip label={isArabic ? 'إرفاق' : 'Attach'}>
          <ActionIcon variant="subtle" color="gray" onClick={() => fileRef.current?.click()}>
            <IconPaperclip size={16} />
          </ActionIcon>
        </Tooltip>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!loading) onSend();
            }
          }}
          rows={1}
          onPaste={handlePaste}
          placeholder={isArabic ? 'اسأل عن أي شيء…' : 'Ask anything…'}
          className="flex-1 bg-transparent resize-none outline-none text-[13px] leading-6 max-h-28 py-1.5 placeholder:text-slate-400"
        />

        {/* Microphone button */}
        <Tooltip label={
          isTranscribing
            ? (isArabic ? 'جارٍ التحويل...' : 'Transcribing...')
            : isRecording
            ? (isArabic ? 'إيقاف وإرسال' : 'Stop & send')
            : (isArabic ? '🎤 تحدث (يتوقف تلقائياً)' : '🎤 Voice (auto-stop)')
        }>
          <ActionIcon
            variant={isRecording ? 'filled' : 'subtle'}
            color={isRecording ? 'red' : 'gray'}
            onClick={toggleVoice}
            radius="xl"
            size={34}
            disabled={isTranscribing || loading}
            className={isRecording ? 'animate-pulse' : 'hover:text-[#F45A0A]'}
          >
            <IconMicrophone size={16} />
          </ActionIcon>
        </Tooltip>

        {loading ? (
          <ActionIcon color="orange" variant="filled" onClick={onStop} radius="xl" size={34} title={isArabic ? 'إيقاف' : 'Stop'}>
            <IconPlayerStop size={15} />
          </ActionIcon>
        ) : (
          <ActionIcon
            color="orange"
            variant="filled"
            onClick={onSend}
            radius="xl"
            size={34}
            title={isArabic ? 'إرسال' : 'Send'}
            disabled={(!value.trim() && !attachedName && !attachedPreview) || isProcessing}
          >
            <IconSend size={15} style={isArabic ? { transform: 'scaleX(-1)' } : undefined} />
          </ActionIcon>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.csv,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAttach(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
