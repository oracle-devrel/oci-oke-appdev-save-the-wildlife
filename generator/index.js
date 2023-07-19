import { io } from "socket.io-client";
import * as dotenv from "dotenv";
import short from "shortid";
import pino from "pino";

dotenv.config({ path: "./config/.env" });
const logger = pino();

const { NODE_ENV } = process.env;
logger.info(`NODE_ENV: ${NODE_ENV}`);
const isProductionMode = NODE_ENV === "production";

const UPDATE_FREQUENCY_IN_SECONDS = parseInt(
  process.env.UPDATE_FREQUENCY_IN_SECONDS
);
logger.info(`Loop freq: ${UPDATE_FREQUENCY_IN_SECONDS}s`);

const WS_SERVER_SERVICE_HOST = process.env.WS_SERVER_SERVICE_HOST;
if (!WS_SERVER_SERVICE_HOST) {
  logger.error(`WS_SERVER_SERVICE_HOST not defined`);
  process.exit(1);
}
const WS_SERVER_SERVICE_PORT = process.env.WS_SERVER_SERVICE_PORT;
if (!WS_SERVER_SERVICE_PORT) {
  logger.error(`WS_SERVER_SERVICE_PORT not defined`);
  process.exit(1);
}

const webSocketServerUrl = `ws://${WS_SERVER_SERVICE_HOST}:${WS_SERVER_SERVICE_PORT}`;
logger.info(`Connecting to WS Server on ${webSocketServerUrl}`);
const socket = io(webSocketServerUrl);

let trashPoll = [];
let marineLifePoll = [];
let numberOfPlayers = 0;

socket.on("connect", () => {
  logger.info(`Connected to ${webSocketServerUrl}`);
});

socket.on("disconnect", () => {
  logger.error(`Disconnected from ${webSocketServerUrl}`);
});

socket.on("error", (error) => {
  logger.error(error);
});

socket.on("allPlayers", (players) => {
  numberOfPlayers = Object.keys(players).length;
});

setInterval(() => {
  const numberOfTrash = trashPoll.length;
  const numberOfMarineLife = marineLifePoll.length;
  const deltaOfDesiredNumberOfTrash = numberOfPlayers - numberOfTrash;
  const deltaOfDesiredNumberOfMarineLife =
    numberOfPlayers * 2 - numberOfMarineLife;
  if (deltaOfDesiredNumberOfTrash > 0) {
    const extraTrashPoll = [
      ...Array(deltaOfDesiredNumberOfTrash)
        .fill(0)
        .map((t) => createObject("trash")),
    ];
    trashPoll = [...trashPoll, ...extraTrashPoll];
  }
  if (deltaOfDesiredNumberOfMarineLife > 0) {
    const extraMarineLifePoll = [
      ...Array(deltaOfDesiredNumberOfMarineLife)
        .fill(0)
        .map((t) => createObject("turtle")),
    ];
    marineLifePoll = [...marineLifePoll, ...extraMarineLifePoll];
  }
  logger.info(
    `Trash ${trashPoll.length} / ${marineLifePoll.length} Marine Life`
  );
  socket.emit("items.gen", {
    data: { trash: trashPoll, marineLife: marineLifePoll },
  });
}, UPDATE_FREQUENCY_IN_SECONDS * 1000);

function createObject(type) {
  const x = Math.round(Math.random() * 90);
  const y = Math.round(Math.random() * 23);
  const z = 0;
  const size = (Math.random() * 5).toFixed(2);
  return { id: short.generate(), type, position: { x, y, z }, size };
}
