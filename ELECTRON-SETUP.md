
# Electron Setup Instructions for PLYNK-IO

This document provides step-by-step instructions for integrating Electron with the PLYNK-IO project.

## Local Tasks (Execute on Local PC)

1. **Install Electron as a dev dependency**:
   ```
   npm install electron --save-dev
   ```

2. **Replace package.json**:
   - Delete the original `package.json` file
   - Rename `package-update.json` to `package.json`

3. **Install dependencies**:
   ```
   npm install
   ```

4. **Running the Application**:
   
   - **Browser mode** (continue using Lovable AI):
     ```
     npm run dev
     ```
   
   - **Electron mode** (desktop application):
     ```
     npm start
     ```

## Structure Overview

- `/electron/main.js` - The main Electron process file
- `/electron/preload.js` - Script that runs in the renderer process
- `/electron/start-electron.js` - Helper script to launch Electron with Vite dev server

## Development Workflow

1. Make UI changes in Lovable AI using browser mode (`npm run dev`)
2. Test changes in Electron using `npm start`

## Technical Details

- The Electron app connects to the Vite development server running on port 8080
- No UI/UX changes are needed as Electron simply renders the existing web application
- The project continues using mock data at this stage
