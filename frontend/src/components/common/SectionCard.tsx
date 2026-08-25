import React from 'react';

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  children,
  className = '',
}) => {
  return (
    <section
      className={`bg-white border border-[#E5E7EB] rounded-[14px] p-5 md:p-6 shadow-xs select-none ${className}`}
    >
      {children}
    </section>
  );
};
