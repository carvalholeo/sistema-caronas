// utils/quiet-hours.ts
export function shouldNotifyNow(nowUtc: Date, prefs: {
  startMinute: number; endMinute: number; weekMask: number; timezone: string;
}): boolean {
  // Use uma lib de tz (ex.: luxon, date-fns-tz) para converter UTC -> local do usuário
  // Exemplo com Intl API (para obter hora/minuto local aprox.; para produção use date-fns-tz/luxon)
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: prefs.timezone,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
  const parts = fmt.formatToParts(nowUtc);
  const wd = parts.find(p => p.type === 'weekday')?.value; // Sun, Mon, ...
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  const weekdayIndex = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].indexOf(wd || 'Dom');
  const minuteOfDay = hour * 60 + minute;

  const dayBit = 1 << weekdayIndex;
  const dayAllowed = (prefs.weekMask & dayBit) !== 0;

  const { startMinute, endMinute } = prefs;
  const inWindow = startMinute <= endMinute
    ? minuteOfDay >= startMinute && minuteOfDay < endMinute
    : // janela cruza meia-noite: ex. 22:00–07:00
      (minuteOfDay >= startMinute || minuteOfDay < endMinute);

  return dayAllowed && inWindow;
}
