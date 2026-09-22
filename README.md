# Client Progress Report Tracker

A small macOS Electron app for tracking when client progress reports are due. It stores client metadata locally.

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

The packaged `.app` and `.dmg` files are written to `dist/`. The app stores its data in Electron's per-user application data directory, so records remain available after restarting or rebuilding the app.
