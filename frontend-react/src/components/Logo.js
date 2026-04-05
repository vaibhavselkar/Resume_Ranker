import React from 'react';

const Logo = ({ size = 40, showText = true, textClassName = '' }) => {
  return (
    <div className={`logo-container ${showText ? 'with-text' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: showText ? '0.5rem' : '0' }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        className="logo-svg"
        aria-label="AI Resume Screener Logo"
      >
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#2563eb', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#7c3aed', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        
        {/* Background circle */}
        <circle cx="50" cy="50" r="48" fill="url(#logoGradient)" />
        
        {/* Resume/document icon */}
        <rect x="28" y="22" width="44" height="56" rx="4" fill="white" opacity="0.95" />
        
        {/* Document lines */}
        <rect x="34" y="32" width="32" height="3" rx="1.5" fill="#2563eb" opacity="0.6" />
        <rect x="34" y="40" width="28" height="3" rx="1.5" fill="#2563eb" opacity="0.6" />
        <rect x="34" y="48" width="32" height="3" rx="1.5" fill="#2563eb" opacity="0.6" />
        <rect x="34" y="56" width="20" height="3" rx="1.5" fill="#2563eb" opacity="0.4" />
        
        {/* Checkmark/score badge */}
        <circle cx="68" cy="68" r="14" fill="#10b981" />
        <path d="M62 68 L66 72 L74 64" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        
        {/* AI sparkle */}
        <circle cx="78" cy="28" r="6" fill="#f59e0b" opacity="0.9" />
        <circle cx="78" cy="28" r="3" fill="white" />
      </svg>
      
      {showText && (
        <span className={`logo-text ${textClassName}`}>AI Resume Screener</span>
      )}
    </div>
  );
};

export default Logo;