import React from 'react';

export default function CurrencyFlag({ code }) {
  if (code === 'JPY') return (
    <svg className="currency-flag" viewBox="0 0 24 16" role="img" aria-label="Japan">
      <rect width="24" height="16" rx="1" fill="#fff" />
      <circle cx="12" cy="8" r="4.4" fill="#BC002D" />
    </svg>
  );

  if (code === 'EUR') {
    const stars = Array.from({ length: 12 }, (_, index) => {
      const angle = (index * 30 - 90) * Math.PI / 180;
      return <circle key={index} cx={12 + Math.cos(angle) * 4.8} cy={8 + Math.sin(angle) * 4.8} r="0.65" fill="#FFCC00" />;
    });
    return (
      <svg className="currency-flag" viewBox="0 0 24 16" role="img" aria-label="European Union">
        <rect width="24" height="16" rx="1" fill="#003399" />
        {stars}
      </svg>
    );
  }

  return (
    <svg className="currency-flag" viewBox="0 0 24 16" role="img" aria-label="United States">
      <rect width="24" height="16" rx="1" fill="#fff" />
      {Array.from({ length: 7 }, (_, index) => <rect key={index} y={index * 32 / 13} width="24" height={16 / 13} fill="#B22234" />)}
      <rect width="10.5" height="8.6" fill="#3C3B6E" />
      {Array.from({ length: 9 }, (_, index) => <circle key={index} cx={1.8 + (index % 3) * 3.2} cy={1.7 + Math.floor(index / 3) * 2.5} r="0.45" fill="#fff" />)}
    </svg>
  );
}
