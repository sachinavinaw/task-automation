import { app, BrowserWindow, ipcMain, Menu, dialog } from "electron";
import path from "path";
import { promises as fs } from "fs";
import { spawn } from "child_process";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";

const APPPATH = app.getAppPath();
const APPBASEPATH = path.resolve(APPPATH, "..");
const envPath = path.resolve(APPPATH, "..", ".env.dev");
// const env = dotenv.parse(await fs.readFile(envPath, "utf8"));

logger.info("Application started");

const PATHS = {
  PRELOAD: path.join(APPPATH, "preload.js"),
  UICONFIG: path.join(APPPATH, "config", "ui-data.json"),
  RUNNERBAT: path.resolve(APPPATH, "..", "runner.bat"),
};

async function readEnv() {
  try {
    const content = await fs.readFile(envPath, "utf8");

    return dotenv.parse(content);
  } catch (error) {
    logger.error("Failed to read .env.dev:", error);

    return {};
  }
}

async function writeEnv(envData) {
  await fs.writeFile(
    envPath,
    Object.entries(envData)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
    "utf8",
  );
}

let mainWindow = null;
let activeChildProcess = null; // Track the running automation process

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    webPreferences: {
      preload: PATHS.PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);

  if (process.env.IS_DEV || !app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.loadFile("index.html");

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    logger.info("Launching window");
  });

  // Intercept window close event to check for active background processes
  mainWindow.on("close", async (e) => {
    if (activeChildProcess) {
      e.preventDefault(); // Prevent window from closing immediately

      const { response } = await dialog.showMessageBox(mainWindow, {
        type: "warning",
        buttons: ["Cancel", "Stop & Close"],
        defaultIndex: 0,
        title: "Automation Running",
        message: "An automation task is currently running.",
        detail:
          "Closing the application will terminate the ongoing process. Are you sure you want to stop and exit?",
      });

      if (response === 1) {
        // User clicked "Stop & Close"
        try {
          activeChildProcess.kill();
        } catch (err) {
          logger.error(err, "Failed to kill active process");
        }
        activeChildProcess = null;
        app.quit();
      }
    }
  });

  return mainWindow;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("get-current-selection", async () => {
  const env = await readEnv();

  if (env.IS_DEV === "true") {
    console.log("ENV:", env);
  }

  return {
    blockName: env.BLOCK_NAME || "",
    financialYear: env.FINANCIAL_YEAR || "",
  };
});

// Load UI configuration
ipcMain.handle("get-ui-config", async () => {
  try {
    const content = await fs.readFile(PATHS.UICONFIG, "utf8");
    return JSON.parse(content);
  } catch (error) {
    logger.error(error, "Failed to load UI config");
    throw new Error("Unable to load UI configuration.");
  }
});

// Save selected values to env file
ipcMain.handle("save-selection-config", async (_event, data) => {
  try {
    const env = await readEnv();

    env.BLOCK_NAME = data.blockName;
    env.FINANCIAL_YEAR = data.financialYear;

    await writeEnv(env);

    return {
      success: true,
    };
  } catch (error) {
    logger.error(error, "Failed to save UI selection");
    throw new Error("Unable to save selection.");
  }
});

// Execute batch file
ipcMain.handle("run-process", async () => {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    activeChildProcess = spawn("cmd.exe", ["/c", PATHS.RUNNERBAT], {
      cwd: APPBASEPATH,
      shell: true,
    });

    activeChildProcess.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      logger.debug(text);
    });

    activeChildProcess.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      logger.error(text);
    });

    activeChildProcess.on("error", (error) => {
      logger.error(error, "Process start failed");
      activeChildProcess = null;
      reject({
        success: false,
        message: error.message,
      });
    });

    activeChildProcess.on("close", (code) => {
      activeChildProcess = null; // Clear reference when complete
      resolve({
        success: code === 0,
        exitCode: code,
        message:
          code === 0
            ? "Task completed successfully."
            : `Task failed with exit code ${code}.`,
        stdout,
        stderr,
      });
    });
  });
});
