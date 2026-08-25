import React, { useState, useEffect } from 'react';
import { TextInput, TextInputProps } from '@mantine/core';

interface FormattedNumberInputProps extends Omit<TextInputProps, 'onChange' | 'value'> {
  value: string | number;
  onChange: (value: string) => void;
  allowDecimals?: boolean;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  onChange,
  allowDecimals = true,
  ...props
}) => {
  const formatNumber = (val: string | number): string => {
    if (val === undefined || val === null || val === '') return '';
    const rawStr = String(val).replace(/,/g, '');
    if (isNaN(Number(rawStr)) && rawStr !== '-' && rawStr !== '.') return rawStr;

    const parts = rawStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return allowDecimals && parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
  };

  const [displayValue, setDisplayValue] = useState<string>(formatNumber(value));

  useEffect(() => {
    setDisplayValue(formatNumber(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const cleanValue = inputValue.replace(/,/g, '');

    // Allow empty or partial inputs like "-" or "12."
    if (cleanValue === '' || cleanValue === '-' || (allowDecimals && cleanValue.endsWith('.'))) {
      setDisplayValue(inputValue);
      onChange(cleanValue);
      return;
    }

    if (!isNaN(Number(cleanValue))) {
      const formatted = formatNumber(cleanValue);
      setDisplayValue(formatted);
      onChange(cleanValue);
    }
  };

  return (
    <TextInput
      {...props}
      value={displayValue}
      onChange={handleChange}
      className={`tabular-nums font-mono font-bold ${props.className || ''}`}
    />
  );
};
