import pino from "pino";
import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import { LOG_OUTPUT_DIR } from "../config/config.js";

if (!fs.existsSync(LOG_OUTPUT_DIR)) {
  fs.mkdirSync(LOG_OUTPUT_DIR, { recursive: true });
}

const date = dayjs().format("YYYYMMDD");

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",

  transport: {
    targets: [
      {
        target: "pino-pretty",
        level: "debug",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
      {
        target: "pino/file",
        level: "debug",
        options: {
          destination: path.join(LOG_OUTPUT_DIR, `application-${date}.log`),
          mkdir: true,
        },
      },
    ],
  },
});
