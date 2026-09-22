# SLP Report Tracking

A desktop app for tracking SLP client progress reports and evaluations. Client data, report history, scheduling preferences, and appearance settings are stored locally on each device.

## Download and install

Download the newest installer from the [GitHub Releases page](https://github.com/NathanReed8/slp-report-tracking/releases):

- **Windows:** Download and run the `.exe` installer for your version of Windows.
- **Mac:** Download the `.dmg`, open it, then drag **SLP Report Tracking** to Applications.

The first public release is an **unsigned beta**. Windows may show a Microsoft Defender SmartScreen “unknown publisher” warning and macOS may show a Gatekeeper warning. Download only from the Releases page above and follow your computer’s standard “open anyway” process if you choose to install the beta. Signed installers will replace these beta builds before the stable release.

## Updates

When the installed app starts, it checks the GitHub Releases page for a newer compatible version. If one is available, it asks before downloading it and asks again before restarting to install it. The app continues to work normally if an update check or download fails.

## Privacy and local data

SLP Report Tracking does not include cloud sync, accounts, analytics, or telemetry. The app stores its client records and settings as unencrypted local files on the device. Those records remain when the app is updated, but users are responsible for securing their devices and backups appropriately for the client data they enter.

The app only contacts GitHub when checking for a software update. For help or to report a problem, [open a GitHub issue](https://github.com/NathanReed8/slp-report-tracking/issues).

## Features

- Track separate progress-report and evaluation due dates for Medicaid and non-Medicaid clients.
- Add new clients from an initial evaluation or establish schedules from existing report history.
- Record submissions, preserve submission history, and use one-time due-date overrides without changing the recurring schedule.
- Review deadlines in weekly or monthly calendar views.
- Configure schedules, themes, and action colors.

## Development

Use Node.js 20.19+ or 22.12+ for development and packaging, then from this directory run:

```sh
npm install
npm test
npm start
```

## Create local installers

```sh
# Windows x64 installer (run on Windows)
npm run package:win

# Universal macOS DMG and ZIP (run on macOS)
npm run package:mac
```

The generated files are written to `dist/` and are intentionally not tracked in Git.

## Publish a beta release

The GitHub Actions workflow tests every change to `main` and pull request. Pushing a version tag beginning with `v` builds the Windows and universal macOS installers, then attaches their update metadata to a GitHub Release.

```sh
npm version prerelease --preid=beta
git push origin main --follow-tags
```

For the first release, use the version and tag `1.0.0-beta.1` / `v1.0.0-beta.1`.

## Signing a stable release

Before releasing a stable version, add these repository secrets in GitHub Actions:

- `CSC_LINK` and `CSC_KEY_PASSWORD`: Apple Developer ID Application certificate for macOS signing.
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`: Apple notarization credentials.
- `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`: Windows Authenticode certificate.

With those secrets in place, the existing workflow signs and notarizes macOS builds and signs Windows installers. A custom app icon should also be added before the signed stable release.
