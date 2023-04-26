import * as dotenv from "dotenv";
import fetch from "node-fetch";
import pino from "pino";

dotenv.config({ path: "./config/.env" });
// FIXME change log level based on NODE_ENV
const logger = pino();

const SCORE_SERVICE_HOST = process.env.SCORE_SERVICE_HOST;
if (!SCORE_SERVICE_HOST) {
  logger.error(`SCORE_SERVICE_HOST not defined`);
  process.exit(1);
}
const SCORE_SERVICE_PORT = process.env.SCORE_SERVICE_PORT;
if (!SCORE_SERVICE_PORT) {
  logger.error(`SCORE_SERVICE_PORT not defined`);
  process.exit(1);
}

const scoreServiceUrl = `${SCORE_SERVICE_HOST}:${SCORE_SERVICE_PORT}`;
logger.info(`Connecting to Score on ${scoreServiceUrl}`);

export async function postCurrentScore(playerId, playerName, operationType) {
  try {
    const stringifyBody = JSON.stringify({
      operationType: operationType,
      name: playerName,
    });
    // FIXME thrown exceptions will kill the process!
    await fetch(`http://${scoreServiceUrl}/api/score/${playerId}`, {
      method: "PUT",
      headers: { "Content-type": "application/json" },
      body: stringifyBody,
    });
  } catch (error) {
    logger.error(error.message);
    return { score: 0 };
  }
}

export async function deleteCurrentScore(playerId) {
  try {
    await fetch(`http://${scoreServiceUrl}/api/score/${playerId}`, {
      method: "DELETE",
      headers: { "Content-type": "application/json" },
    });
  } catch (error) {
    logger.error(error.message);
    return;
  }
}
