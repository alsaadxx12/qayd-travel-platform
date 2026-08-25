import { notifications } from '@mantine/notifications';
import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Sparkles } from 'lucide-react';

const isRtl = () => {
  if (typeof document !== 'undefined') {
    return document.documentElement.dir === 'rtl';
  }
  return true;
};

const baseRootStyle = (rtl: boolean, accentBorderColor: string) => ({
  direction: rtl ? ('rtl' as const) : ('ltr' as const),
  borderRadius: '16px',
  backgroundColor: '#FFFFFF',
  border: `1px solid ${accentBorderColor}`,
  boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.1), 0 4px 12px -2px rgba(15, 23, 42, 0.05)',
  padding: '14px 16px',
  fontFamily: rtl ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Inter', system-ui, sans-serif",
  transition: 'all 0.25s ease',
});

export const showSuccessNotification = (title: string, message: string) => {
  const rtl = isRtl();
  notifications.show({
    title,
    message,
    icon: React.createElement(CheckCircle2, { size: 18, className: 'text-[#F45A0A]' }),
    color: 'orange',
    autoClose: 3500,
    withCloseButton: true,
    styles: {
      root: baseRootStyle(rtl, '#FED7AA'),
      icon: {
        backgroundColor: '#FFF7ED',
        borderRadius: '12px',
        width: '32px',
        height: '32px',
      },
      title: {
        fontWeight: 800,
        fontSize: '13.5px',
        color: '#0F172A',
        marginBottom: '2px',
        textAlign: rtl ? 'right' : 'left',
      },
      description: {
        fontSize: '12px',
        color: '#475569',
        fontWeight: 500,
        lineHeight: 1.5,
        textAlign: rtl ? 'right' : 'left',
      },
      closeButton: {
        color: '#94A3B8',
        '&:hover': {
          backgroundColor: '#FFF7ED',
          color: '#F45A0A',
        },
      },
    },
  });
};

export const showErrorNotification = (title: string, message: string) => {
  const rtl = isRtl();
  notifications.show({
    title,
    message,
    icon: React.createElement(AlertCircle, { size: 18, className: 'text-rose-600' }),
    color: 'red',
    autoClose: 4500,
    withCloseButton: true,
    styles: {
      root: baseRootStyle(rtl, '#FECDD3'),
      icon: {
        backgroundColor: '#FFF1F2',
        borderRadius: '12px',
        width: '32px',
        height: '32px',
      },
      title: {
        fontWeight: 800,
        fontSize: '13.5px',
        color: '#9F1239',
        marginBottom: '2px',
        textAlign: rtl ? 'right' : 'left',
      },
      description: {
        fontSize: '12px',
        color: '#475569',
        fontWeight: 500,
        lineHeight: 1.5,
        textAlign: rtl ? 'right' : 'left',
      },
      closeButton: {
        color: '#94A3B8',
        '&:hover': {
          backgroundColor: '#FFE4E6',
          color: '#E11D48',
        },
      },
    },
  });
};

export const showInfoNotification = (title: string, message: string) => {
  const rtl = isRtl();
  notifications.show({
    title,
    message,
    icon: React.createElement(Info, { size: 18, className: 'text-sky-600' }),
    color: 'blue',
    autoClose: 3500,
    withCloseButton: true,
    styles: {
      root: baseRootStyle(rtl, '#BAE6FD'),
      icon: {
        backgroundColor: '#F0F9FF',
        borderRadius: '12px',
        width: '32px',
        height: '32px',
      },
      title: {
        fontWeight: 800,
        fontSize: '13.5px',
        color: '#0369A1',
        marginBottom: '2px',
        textAlign: rtl ? 'right' : 'left',
      },
      description: {
        fontSize: '12px',
        color: '#475569',
        fontWeight: 500,
        lineHeight: 1.5,
        textAlign: rtl ? 'right' : 'left',
      },
      closeButton: {
        color: '#94A3B8',
        '&:hover': {
          backgroundColor: '#E0F2FE',
          color: '#0284C7',
        },
      },
    },
  });
};

export const showWarningNotification = (title: string, message: string) => {
  const rtl = isRtl();
  notifications.show({
    title,
    message,
    icon: React.createElement(AlertTriangle, { size: 18, className: 'text-amber-600' }),
    color: 'yellow',
    autoClose: 4000,
    withCloseButton: true,
    styles: {
      root: baseRootStyle(rtl, '#FDE68A'),
      icon: {
        backgroundColor: '#FFFBEB',
        borderRadius: '12px',
        width: '32px',
        height: '32px',
      },
      title: {
        fontWeight: 800,
        fontSize: '13.5px',
        color: '#92400E',
        marginBottom: '2px',
        textAlign: rtl ? 'right' : 'left',
      },
      description: {
        fontSize: '12px',
        color: '#475569',
        fontWeight: 500,
        lineHeight: 1.5,
        textAlign: rtl ? 'right' : 'left',
      },
      closeButton: {
        color: '#94A3B8',
        '&:hover': {
          backgroundColor: '#FEF3C7',
          color: '#D97706',
        },
      },
    },
  });
};
