import { logger } from "../utils/logger.js";

export async function logStep(stepName, callback) {
  const start = Date.now();

  try {
    logger.info(`START : ${stepName}`);

    const result = await callback();

    logger.info(`PASS  : ${stepName} (${Date.now() - start} ms)`);

    return result;
  } catch (error) {
    logger.error(error, `FAIL  : ${stepName}`);
    throw error;
  }
}
