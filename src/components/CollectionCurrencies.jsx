import React, { useEffect, useState } from 'react';
import CurrencyFlag from './CurrencyFlag';
import { convertUsd, fetchUsdRates, readCachedUsdRates } from '../services/exchangeRates';

function money(value, currency) {
  if (value === null) return '—';
  const options = currency === 'JPY'
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const symbols = { USD: '$', JPY: '¥', EUR: '€' };
  return `${symbols[currency]}${new Intl.NumberFormat('en-US', options).format(value)}`;
}

function rateDate(value) {
  const date = new Date(`${value || ''}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
}

export default function CollectionCurrencies({ usdTotal, hasKnownValue, partial }) {
  const [rateInfo, setRateInfo] = useState(() => readCachedUsdRates());

  useEffect(() => {
    let cancelled = false;
    fetchUsdRates().then((result) => { if (!cancelled && result) setRateInfo(result); });
    return () => { cancelled = true; };
  }, []);

  const usd = hasKnownValue ? Number(usdTotal) : null;
  const values = {
    USD: usd,
    JPY: rateInfo ? convertUsd(usd, rateInfo.rates.JPY) : null,
    EUR: rateInfo ? convertUsd(usd, rateInfo.rates.EUR) : null,
  };
  return (
    <div className="col-currency-rates" aria-label="Collection value in US dollars, Japanese yen, and euros">
      {['USD', 'JPY', 'EUR'].map((code) => (
        <div key={code} className={`col-currency-row col-currency-row--${code.toLowerCase()}`}>
          <CurrencyFlag code={code} />
          <span className="col-currency-value">{money(values[code], code)}{values[code] !== null && partial ? '+' : ''}</span>
          <span className="col-currency-code">{code}</span>
        </div>
      ))}
      <small className="col-currency-source">
        {rateInfo ? `ECB ${rateInfo.stale ? 'LAST RATE' : 'REFERENCE'} · ${rateDate(rateInfo.date)}` : 'LIVE RATE UNAVAILABLE'}
      </small>
    </div>
  );
}
