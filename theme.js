function contrastColor(hex) {
  const value = hex.slice(1);
  const [red, green, blue] = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  return ((red * 299) + (green * 587) + (blue * 114)) / 1000 > 150 ? '#172033' : '#ffffff';
}

function applyTheme(settings) {
  const activeSettings = isSettings(settings) ? settings : defaultSettings();
  const root = document.documentElement;
  root.dataset.theme = activeSettings.theme;
  const colors = { ...THEME_PALETTES[activeSettings.theme], ...activeSettings.colorOverrides };
  BUTTON_COLOR_ROLES.forEach((role) => {
    root.style.setProperty(`--color-${role}`, colors[role]);
    root.style.setProperty(`--on-${role}`, contrastColor(colors[role]));
  });
}

async function loadAndApplyTheme() {
  try {
    const saved = await window.tokenStore.loadSettings();
    const settings = isSettings(saved) ? saved : defaultSettings();
    const legacyColorMap = { primary: ['clientsAdd', 'calendarManageClients'], secondary: ['clientsReset', 'calendarToday'], edit: ['clientsEdit'], delete: ['clientsDelete'], progress: ['clientsProgress', 'calendarProgress'], evaluation: ['clientsEvaluation', 'calendarEvaluation'], history: ['clientsHistory'] };
    Object.entries(legacyColorMap).forEach(([oldRole, roles]) => {
      if (!settings.colorOverrides[oldRole]) return;
      roles.forEach((role) => { if (settings.colorOverrides[role] === undefined) settings.colorOverrides[role] = settings.colorOverrides[oldRole]; });
    });
    applyTheme(settings);
    return settings;
  } catch (_) {
    const settings = defaultSettings();
    applyTheme(settings);
    return settings;
  }
}
