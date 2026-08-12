import type { MainDesktopTrpcRouter } from "../../src/shared/contracts/desktop-trpc";
import { createDesktopTrpcClient } from "./desktop-trpc-client";

export const desktopTrpc = createDesktopTrpcClient<MainDesktopTrpcRouter>();
