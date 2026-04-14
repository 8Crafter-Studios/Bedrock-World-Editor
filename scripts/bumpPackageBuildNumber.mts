import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import semver from "semver";

const packageJSONPath: string = path.join(import.meta.dirname, "../package.json");

writeFileSync(
    packageJSONPath,
    readFileSync(packageJSONPath, "utf-8").replace(
        /"build":([\s\n\r]*)"([^"]*)"(,?)/,
        (_substring: string, ...args: [$1: string, $2: string, $3: string, number?, string?, ...any[]]): string => {
            const originalBuild: readonly string[] | undefined = semver.parse(`1.0.0+${args[1]}`)?.build;

            if (!originalBuild) throw new Error("Failed to parse build number");

            const build: string[] = [...originalBuild];
            const numberIndex: number = build.indexOf("BUILD");

            if (numberIndex === -1) throw new Error("Failed to find build number index");
            if (!build[numberIndex + 1] || !/^\d+$/.test(build[numberIndex + 1])) throw new Error("Failed to find build number");

            build[numberIndex + 1] = String(BigInt(build[numberIndex + 1]) + 1n);

            const newBuildNumber: string = build.join(".");

            console.log(`\x1b[38;2;0;255;136mNew version: \x1b[38;2;0;255;255m${process.env.npm_package_version!}+${newBuildNumber}\x1b[0m`);

            return `"build":${args[0]}"${newBuildNumber}"${args[2]}`;
        }
    )
);
