const { app, BrowserWindow, Menu, session, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;

// Prevent multiple instances (avoids port conflicts / duplicate backend)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Clear login/user localStorage so the next launch shows Register (fresh install)
async function clearAuthStorage() {
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
}

function buildAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reset Account (Sign Out)',
          accelerator: 'CmdOrCtrl+Shift+Delete',
          click: async () => {
            const choice = dialog.showMessageBoxSync(mainWindow, {
              type: 'warning',
              buttons: ['Cancel', 'Reset'],
              defaultId: 0,
              cancelId: 0,
              title: 'Reset Account',
              message: 'This will sign out and remove the saved login from this PC.\n\nThe billing data and prices will NOT be deleted.\n\nContinue?',
            });
            if (choice === 1) {
              await clearAuthStorage();
              mainWindow.reload();
            }
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    { label: 'Edit', role: 'editMenu' },
    { label: 'View', role: 'viewMenu' },
    { label: 'Window', role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../frontend/public/logo.ico'),
    title: 'Oliyaruvi Printers - Billing System',
  });

  buildAppMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (app.isPackaged) {
    const resourcesDir = path.dirname(app.getAppPath());
    const indexPath = path.join(resourcesDir, 'app.asar.unpacked', 'frontend', 'dist', 'index.html');
    const fileToLoad = fs.existsSync(indexPath) ? indexPath : path.join(__dirname, '../frontend/dist/index.html');
    // HashRouter needs #/ for root route when loading from file://
    const fileUrl = 'file:///' + fileToLoad.replace(/\\/g, '/').replace(/^\/+/, '');
    mainWindow.loadURL(fileUrl + '#/');
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    if (app.isPackaged && errorCode === -106) {
      mainWindow.loadURL('data:text/html,<h1>Starting...</h1><p>Please wait. If this persists, the backend may have failed to start.</p>');
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
  });
}

function waitForBackend(port, maxAttempts = 30) {
  return new Promise((resolve) => {
    let attempts = 0;
    const tryConnect = () => {
      const req = http.get(`http://localhost:${port}/api/health`, (res) => {
        resolve(true);
      });
      req.on('error', () => {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(tryConnect, 500);
        } else {
          resolve(false);
        }
      });
      req.setTimeout(2000, () => { req.destroy(); });
    };
    tryConnect();
  });
}

function startBackend() {
  process.env.PORT = '5000';
  process.env.ELECTRON_APP = 'true';
  const userDataPath = app.getPath('userData');
  const dbFileName = `oliyaruvi_${app.getVersion()}.db`;
  process.env.DATABASE_PATH = path.join(userDataPath, dbFileName);
  // Resolve frontend path: unpacked files are in app.asar.unpacked (sibling of app.asar)
  const appPath = app.getAppPath();
  const resourcesDir = path.dirname(appPath);
  process.env.FRONTEND_DIST = path.join(resourcesDir, 'app.asar.unpacked', 'frontend', 'dist');
  try {
    require('../backend/server.js');
  } catch (err) {
    console.error('Backend failed to start:', err);
  }
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    // If this is a fresh install (no DB yet), clear old localStorage so Register shows
    const dbPath = path.join(app.getPath('userData'), `oliyaruvi_${app.getVersion()}.db`);
    const isFreshInstall = !fs.existsSync(dbPath);
    if (isFreshInstall) {
      await clearAuthStorage();
    }

    // If backend is already running on 5000 (e.g., app reopened / dev server), reuse it.
    const alreadyRunning = await waitForBackend(5000, 2);
    if (!alreadyRunning) {
      startBackend();
    }
    const ready = await waitForBackend(5000);
    if (!ready) {
      console.error('Backend did not start in time');
    }
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
