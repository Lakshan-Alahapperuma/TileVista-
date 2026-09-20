import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  variant?: 'glass' | 'brutalist';
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverEffect = true,
  variant = 'glass',
  className = '',
  style,
  ...props
}) => {
  const cardStyles: React.CSSProperties = variant === 'brutalist' ? {
    background: '#ffffff',
    border: '1px solid #E5E5E3',
    borderRadius: '0px',
    padding: '24px',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    color: '#1A1A1A',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    transition: 'all 0.3s ease',
    ...style,
  } : {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    color: '#ffffff',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    transition: 'all 0.3s ease',
    ...style,
  };

  return (
    <div
      className={`tv-card ${hoverEffect ? 'hover:scale-[1.02] hover:border-[rgba(255,255,255,0.15)]' : ''} ${className}`}
      style={cardStyles}
      {...props}
    >
      {children}
    </div>
  );
};
