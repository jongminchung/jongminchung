import {
  GIT_UTILITY_STORAGE_ROOT_ARGUMENT,
  GitUtilityStorageRootSchema,
} from "../../../src/shared/contracts/git-utility-process";
import { GitUtility } from "./git-utility";
import { GitUtilityProtocolServer } from "./utility-server";

function storageRootFromArguments(arguments_: readonly string[]): string {
  const positions = arguments_
    .map((argument, index) => (argument === GIT_UTILITY_STORAGE_ROOT_ARGUMENT ? index : -1))
    .filter((index) => index >= 0);
  if (positions.length !== 1) {
    throw new Error("Git utility requires exactly one storage root argument");
  }
  const position = positions[0];
  if (position === undefined) {
    throw new Error("Git utility storage root argument is missing");
  }
  return GitUtilityStorageRootSchema.parse(arguments_[position + 1]);
}

const parentPort = process.parentPort;
if (parentPort === undefined)
  throw new Error("Git utility entry requires an Electron utility process parent port");

const server = new GitUtilityProtocolServer(
  {
    postMessage: (message) => parentPort.postMessage(message),
    subscribe: (listener) => {
      const receive = (event: Electron.MessageEvent) => listener(event.data);
      parentPort.on("message", receive);
      return () => parentPort.off("message", receive);
    },
  },
  new GitUtility(undefined, undefined, storageRootFromArguments(process.argv)),
  {
    onDispose: () => {
      setImmediate(() => process.exit(0));
    },
  },
);

server.start();
