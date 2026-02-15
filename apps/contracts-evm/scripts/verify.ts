import * as fs from "fs";
import * as path from "path";

async function main() {
  const addressFile = path.resolve(
    __dirname,
    "../../../deploy/addresses.kasplex.testnet.json"
  );

  if (!fs.existsSync(addressFile)) {
    console.error("Address registry not found:", addressFile);
    process.exitCode = 1;
    return;
  }

  const registry = JSON.parse(fs.readFileSync(addressFile, "utf-8"));
  console.log("Address registry:", JSON.stringify(registry, null, 2));

  const contracts = registry.contracts || {};
  for (const [name, address] of Object.entries(contracts)) {
    if (!address || address === "0x_TO_BE_DEPLOYED") {
      console.log(`[SKIP] ${name}: not deployed yet`);
    } else {
      console.log(`[OK] ${name}: ${address}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
