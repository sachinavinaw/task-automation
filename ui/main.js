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
  WAGERUNNERBAT: path.resolve(APPPATH, "..", "batch", "wage", "runner.bat"),
  MATERIALRUNNERBAT: path.resolve(
    APPPATH,
    "..",
    "batch",
    "material",
    "runner.bat",
  ),
  SEMISKILLEDRUNNERBAT: path.resolve(
    APPPATH,
    "..",
    "batch",
    "semiskilled",
    "runner.bat",
  ),
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
  //process.env.IS_DEV ||
  // if (!app.isPackaged) {
  //   mainWindow.webContents.openDevTools();
  // }

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
    taskTypes: env.TASK_TYPES
      ? env.TASK_TYPES.split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
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
    env.TASK_TYPES = Array.isArray(data.taskTypes)
      ? data.taskTypes.join(",")
      : "";
    await writeEnv(env);

    return {
      success: true,
    };
  } catch (error) {
    logger.error(error, "Failed to save UI selection");
    throw new Error("Unable to save selection.");
  }
});

// Execute batch files strictly in sequence: WAGE -> MATERIAL -> SEMISKILLED
ipcMain.handle("run-process", async () => {
  const env = await readEnv();

  // Parse TASK_TYPES from env
  const selectedTasks = env.TASK_TYPES
    ? env.TASK_TYPES.split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  if (selectedTasks.length === 0) {
    return {
      success: false,
      message: "No task types selected to run.",
    };
  }

  // Define the strict fixed order array
  const fixedOrderTasks = [
    { key: "WAGE_LIST", name: "Wage", path: PATHS.WAGERUNNERBAT },
    { key: "MATERIAL_LIST", name: "Material", path: PATHS.MATERIALRUNNERBAT },
    {
      key: "SEMI_SKILLED_LIST",
      name: "Semi-Skilled",
      path: PATHS.SEMISKILLEDRUNNERBAT,
    },
  ];

  // Filter only the tasks that were selected by the user,
  // but keep them strictly in the predefined sequence order.
  const tasksToRun = fixedOrderTasks.filter((task) =>
    selectedTasks.includes(task.key),
  );

  let combinedStdout = "";
  let combinedStderr = "";

  // Run each batch file sequentially in order
  for (const task of tasksToRun) {
    logger.info(`Starting task runner: ${task.name} (${task.path})`);

    const result = await runSingleBatch(task.path);
    combinedStdout += `\n--- [${task.name} Start] ---\n` + result.stdout;
    combinedStderr += `\n--- [${task.name} Error] ---\n` + result.stderr;

    // Terminate immediately if any task fails
    if (!result.success) {
      logger.error(
        `Task failed: ${task.name} with exit code ${result.exitCode}. Stopping execution sequence.`,
      );
      return {
        success: false,
        exitCode: result.exitCode,
        message: `Task '${task.name}' failed with exit code ${result.exitCode}. Execution stopped.`,
        stdout: combinedStdout,
        stderr: combinedStderr,
      };
    }
  }

  return {
    success: true,
    exitCode: 0,
    message:
      "All selected automation tasks completed successfully in sequence.",
    stdout: combinedStdout,
    stderr: combinedStderr,
  };
});

/**
 * Helper function to execute a single batch file via child_process.spawn
 */
function runSingleBatch(batchPath) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    activeChildProcess = spawn("cmd.exe", ["/c", batchPath], {
      cwd: APPBASEPATH,
      shell: true,
      env: {
        ...process.env,
        npm_config_loglevel: "warn", // Hides 'npm notice' lines, only shows warnings/errors
        npm_config_fund: "false",
      },
    });

    activeChildProcess.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      logger.debug(text.trim());
    });

    activeChildProcess.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;

      // Filter out harmless npm notices so they don't trigger error logs
      if (text.includes("npm notice")) {
        logger.debug(text.trim());
      } else {
        logger.error(text.trim());
      }
    });

    activeChildProcess.on("error", (error) => {
      logger.error(error, `Process start failed for ${batchPath}`);
      activeChildProcess = null;
      resolve({
        success: false,
        exitCode: -1,
        stdout,
        stderr: stderr + "\n" + error.message,
      });
    });

    activeChildProcess.on("close", (code) => {
      activeChildProcess = null;
      resolve({
        success: code === 0,
        exitCode: code,
        stdout,
        stderr,
      });
    });
  });
}
