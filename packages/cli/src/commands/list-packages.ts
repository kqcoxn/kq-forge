import { defineCommand } from "citty";
import { consola } from "consola";
import { listPackages } from "@kq-forge/core";

export const listPackagesCommand = defineCommand({
  meta: {
    name: "list-packages",
    description: "列出可用场景包",
  },
  async run() {
    const packages = listPackages();

    consola.info("可用场景包:\n");

    for (const pkg of packages) {
      console.log(`  ${pkg.name}`);
      console.log(`    ${pkg.description}`);
      if (pkg.skills.length > 0) {
        console.log(`    Skills: ${pkg.skills.join(", ")}`);
      }
      if (pkg.workflows.length > 0) {
        console.log(`    Workflows: ${pkg.workflows.join(", ")}`);
      }
      console.log();
    }
  },
});
