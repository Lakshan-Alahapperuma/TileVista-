import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  variant?: 'glass' | 'brutalist';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  variant,
  className = '',
  style,
  ...props
}) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    width: '100%',
  };

  const labelStyles: React.CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.7)',
  };

  const inputStyles: React.CSSProperties = variant === 'brutalist' ? {
    background: '#ffffff',
    border: error ? '1px solid #ef4444' : '1px solid #E5E5E3',
    borderRadius: '0px',
    padding: '12px 16px',
    color: '#1A1A1A',
    outline: 'none',
    fontSize: '1rem',
    transition: 'border-color 0.2s ease',
    ...style,
  } : {
    background: 'rgba(0, 0, 0, 0.2)',
    border: error ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '12px 16px',
    color: '#ffffff',
    outline: 'none',
    fontSize: '1rem',
    transition: 'border-color 0.2s ease',
    ...style,
  };

  const errorStyles: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#ef4444',
    fontWeight: 500,
  };

  return (
    <div style={containerStyles}>
      {label && <span style={labelStyles}>{label}</span>}
      <input className={`tv-input ${className}`} style={inputStyles} {...props} />
      {error && <span style={errorStyles}>{error}</span>}
    </div>
  );
};
