import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const packageJSONPath: string = path.join(import.meta.dirname, "../package.json");

writeFileSync(packageJSONPath, readFileSync(packageJSONPath, "utf-8").replace(/"build":([\s\n\r]*)"(?:[^"]*)"(,?)/, `"build":$1"BUILD.1"$2`));

console.log(`\x1b[38;2;0;255;136mNew version: \x1b[38;2;0;255;255m${process.env.npm_package_version!}+BUILD.1\x1b[0m`);
