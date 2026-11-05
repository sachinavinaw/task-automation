import pino from "pino";
import fs from "fs";
import path from "path";
import dayjs from "dayjs";

const logDir = path.join(process.cwd(), "logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
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
          destination: path.join(logDir, `application-${date}.log`),
          mkdir: true,
        },
      },
    ],
  },
});
