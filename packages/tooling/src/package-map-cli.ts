import { formatTsconfigAliasConfig, writeTsconfigAliasConfig } from "./package-map.js";

if (process.argv.includes("--write")) writeTsconfigAliasConfig();
else process.stdout.write(formatTsconfigAliasConfig());
