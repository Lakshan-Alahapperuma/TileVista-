import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'brutalist';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  style,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 14px 0 rgba(79, 70, 229, 0.4)',
        };
      case 'secondary':
        return {
          background: 'rgba(255, 255, 255, 0.08)',
          color: '#f3f4f6',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(8px)',
        };
      case 'accent':
        return {
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.4)',
        };
      case 'danger':
        return {
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.4)',
        };
      case 'brutalist':
        return {
          background: '#1A1A1A',
          color: '#ffffff',
          border: '1px solid #1A1A1A',
          borderRadius: '0px',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.1em',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { padding: '8px 16px', fontSize: '0.875rem' };
      case 'md':
        return { padding: '12px 24px', fontSize: '1rem' };
      case 'lg':
        return { padding: '16px 32px', fontSize: '1.125rem' };
    }
  };

  const baseStyles: React.CSSProperties = {
    fontFamily: "'Outfit', 'Inter', sans-serif",
    fontWeight: 600,
    borderRadius: '12px',
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    userSelect: 'none',
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style,
  };

  return (
    <button className={`tv-btn ${className}`} style={baseStyles} {...props}>
      {children}
    </button>
  );
};
