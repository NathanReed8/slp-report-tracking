function parseDateParts(value) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function toUtcDayNumber(value) {
  const { year, month, day } = parseDateParts(value);
  return Date.UTC(year, month - 1, day) / 86400000;
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDuration(creationDate, duration, unit) {
  const { year, month, day } = parseDateParts(creationDate);
  if (unit === 'days' || unit === 'weeks') {
    const offset = unit === 'weeks' ? duration * 7 : duration;
    const result = new Date(Date.UTC(year, month - 1, day + offset));
    return result.toISOString().slice(0, 10);
  }

  const targetMonthIndex = month - 1 + duration;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function daysRemaining(expiryDate, today = formatLocalDate()) {
  return toUtcDayNumber(expiryDate) - toUtcDayNumber(today);
}

function statusForDays(days) {
  if (days <= 0) return { className: 'status-overdue', label: days < 0 ? 'Report overdue' : 'Report due today' };
  if (days <= 7) return { className: 'status-warning', label: 'Report due within 7 days' };
  if (days <= 30) return { className: 'status-soon', label: 'Report due within 30 days' };
  return { className: 'status-safe', label: 'More than 30 days until report' };
}

if (typeof module !== 'undefined') module.exports = { addDuration, daysRemaining, formatLocalDate, statusForDays };
