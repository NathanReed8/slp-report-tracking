# SLP Report Tracking

A small Electron desktop app for tracking SLP client progress reports and evaluations. Client data, report history, scheduling preferences, and appearance settings are stored locally on the device.

## Features

- Track separate progress-report and evaluation due dates for Medicaid and non-Medicaid clients.
- Add new clients from an initial evaluation or establish schedules from existing report history.
- Record submissions, preserve submission history, and use one-time due-date overrides without changing the recurring schedule.
- Review deadlines in weekly or monthly calendar views.
- Configure schedules, themes, and action colors.

## Development

Install Node.js 20 or newer, then from this directory run:

```sh
npm install
npm test
npm start
```

## Build a macOS app

```sh
npm run package
```

The packaged `.app` and `.dmg` files are written to `dist/`. They are generated output and are intentionally not tracked in Git. The app stores its data in Electron's per-user application data directory, so records remain available after restarting or rebuilding the app.
