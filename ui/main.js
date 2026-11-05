import { app, BrowserWindow, ipcMain, Menu } from "electron";

import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { cwd } from "process";
const appBasePath = app.getAppPath();

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(appBasePath, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.openDevTools();

  Menu.setApplicationMenu(null);
  win.loadFile("index.html");

  win.once("ready-to-show", () => win.show());
}

app.whenReady().then(createWindow);

// Load UI config
ipcMain.handle("get-ui-config", async () => {
  const configPath = path.join(appBasePath, "config", "ui-data.json");

  return JSON.parse(fs.readFileSync(configPath, "utf8"));
});

// Run batch file
ipcMain.handle("run-process", async (event, data) => {
  const batFile = path.join(appBasePath, "runner.bat");

  console.log("batFile:", batFile);

  return new Promise((resolve, reject) => {
    const child = spawn("cmd.exe", ["/c", batFile], {
      shell: true,
      cwd: appBasePath,
    });

    child.stdout.on("data", (data) => {
      console.log(data.toString());
    });

    child.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    child.on("error", (err) => {
      console.error("SPAWN ERROR", err);
      reject(err.message);
    });

    child.on("close", (code) => {
      let message = `Finished with exit code ${code}`;

      if (code === 0) {
        message = `Task completed`;
      }

      resolve(message);
    });
  });
});

// Save user selection
ipcMain.handle("save-selection-csv", async (event, data) => {
  const filePath = path.join(appBasePath, "config", "selection.csv");

  console.log(cwd());
  const csvContent = `Panchayat,FinancialYear
"${data.panchayat}","${data.financialYear}"`;

  fs.writeFileSync(filePath, csvContent, "utf8");

  return filePath;
});
