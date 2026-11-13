const tz = 'Asia/Seoul';

export function fmtDay(ymd: string, ref?: Date) {
  const date = new Date(`${ymd}T03:00:00Z`);
  const label = new Intl.DateTimeFormat('ko-KR', { timeZone: tz, month: 'long', day: 'numeric', weekday: 'short' }).format(date);
  if (!ref) return label;
  const refYmd = new Date(ref.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const diffDays = Math.round((Date.parse(refYmd) - Date.parse(ymd)) / 86400_000);
  return diffDays === 0 ? `오늘, ${label}` : diffDays === 1 ? `어제, ${label}` : label;
}

export function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: tz,
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

// 브리핑 한 줄의 **굵게**만 살리고 나머지는 글자 그대로
export function briefingHtml(line: string) {
  const esc = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/^[-*]\s+/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
