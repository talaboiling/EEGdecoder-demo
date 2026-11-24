import NumberFlow from '@number-flow/react';
import { useI18n } from '../i18n';

/** Animated number (NumberFlow) in the UI language's locale. */
export default function Num({ value, digits = 0, suffix, prefix }: { value: number; digits?: number; suffix?: string; prefix?: string }) {
  const { lang } = useI18n();
  return (
    <NumberFlow
      value={value}
      locales={lang === 'ru' ? 'ru-RU' : 'en-US'}
      format={{ minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false }}
      suffix={suffix}
      prefix={prefix}
      className="num"
    />
  );
}
