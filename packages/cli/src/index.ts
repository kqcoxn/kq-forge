import { defineCommand, runMain } from "citty";
import { initCommand } from "./commands/init.js";
import { addPlatformCommand } from "./commands/add-platform.js";
import { addCommand } from "./commands/add.js";
import { listPackagesCommand } from "./commands/list-packages.js";
import { statusCommand } from "./commands/status.js";
import { validateCommand } from "./commands/validate.js";

const main = defineCommand({
  meta: {
    name: "kq-forge",
    version: "0.1.0",
    description: "模块化 AI 编码代理 Harness — 为人与 AI 的协作提供结构化协议层",
  },
  subCommands: {
    init: initCommand,
    "add-platform": addPlatformCommand,
    add: addCommand,
    "list-packages": listPackagesCommand,
    status: statusCommand,
    validate: validateCommand,
  },
});

runMain(main);
