const BUTTON_COLOR_ROLES = ['primary', 'secondary', 'edit', 'delete', 'progress', 'evaluation', 'history', 'calendarNavigation'];
const THEME_PALETTES = {
  light: { primary: '#315ee8', secondary: '#ffffff', edit: '#315ee8', delete: '#d9363e', progress: '#198754', evaluation: '#7c4dba', history: '#ffffff', calendarNavigation: '#ffffff' },
  dark: { primary: '#7c9cff', secondary: '#252d3b', edit: '#6692ff', delete: '#ff6972', progress: '#39c98c', evaluation: '#bd92ff', history: '#2a233a', calendarNavigation: '#252d3b' }
};
function interval(value, unit) { return { value, unit }; }
function defaultSettings() { return { theme: 'light', colorOverrides: {}, schedules: { medicaid: { interval: interval(90, 'days'), cycle: ['progress', 'eval'] }, nonMedicaid: { interval: interval(90, 'days'), cycle: ['progress', 'progress', 'progress', 'eval'] } } }; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function isInterval(value) { return Boolean(value) && Number.isInteger(value.value) && value.value > 0 && ['days', 'weeks', 'months'].includes(value.unit); }
function isScheduleProfile(profile) { return Boolean(profile) && isInterval(profile.interval) && Array.isArray(profile.cycle) && profile.cycle.length > 0 && profile.cycle.every((task) => ['progress', 'eval'].includes(task)) && profile.cycle.includes('progress') && profile.cycle.includes('eval'); }
function isSettings(value) { return Boolean(value) && ['light', 'dark'].includes(value.theme) && value.colorOverrides && typeof value.colorOverrides === 'object' && BUTTON_COLOR_ROLES.every((role) => value.colorOverrides[role] === undefined || /^#[0-9a-f]{6}$/i.test(value.colorOverrides[role])) && value.schedules && isScheduleProfile(value.schedules.medicaid) && isScheduleProfile(value.schedules.nonMedicaid); }
function profileFor(medicaidClient) { return medicaidClient === 'yes' ? 'medicaid' : 'nonMedicaid'; }
function intervalLabel(value) { return `${value.value} ${value.unit.slice(0, -1)}${value.value === 1 ? '' : 's'}`; }
if (typeof module !== 'undefined') module.exports = { BUTTON_COLOR_ROLES, THEME_PALETTES, defaultSettings, clone, isInterval, isScheduleProfile, isSettings, profileFor, intervalLabel };
