const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

// Always preserve console output in development mode
// In production, we'll selectively enable specific debug logs
if (process.env.NODE_ENV !== 'development') {
  // In production mode, only keep error logs by default
  //console.log = () => {};
  //console.debug = () => {};
  //console.info = () => {};
  //console.warn = () => {};
  // Keep error logging enabled
  //console.error = () => {};
} else {
  //console.log('Development mode: All console output preserved');
}

// Start Electron with the main.js file
const electronProcess = spawn(electron, [path.join(__dirname, 'main.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_START_URL: 'http://localhost:8080',
    NODE_ENV: 'development',
    FORCE_CLI_LOGGING: 'true' // Force CLI logging in any mode
  }
});

electronProcess.on('close', (code) => {
  //console.log(`Electron process exited with code ${code}`);
  process.exit(code);
});
