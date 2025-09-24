import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig, ResolvedForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { type ChildProcess, spawn } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const config: ForgeConfig = {
    packagerConfig: {
        asar: {
            unpack: "**/leveldb-zlib/**",
        },
        name: "Bedrock World Editor",
        executableName: "bedrock-world-editor",
        protocols: [
            {
                name: "Bedrock World Editor",
                schemes: ["bedrock-world-editor"],
            },
        ],
        icon: "./resources/icon.ico",
        overwrite: true,
        extraResource: ["./resources"],
    },
    rebuildConfig: { extraModules: ["@electron/remote"] /* , ignoreModules: ["@8crafter/leveldb-zlib"] */, disablePreGypCopy: false },
    makers: [
        new MakerSquirrel((arch: string) => ({
            setupIcon: "resources/icon.ico",
            setupExe: `bedrock-world-editor_${(require("./package.json") as typeof import("./package.json")).version}-win32-${arch} Setup.exe`,
            // setupMsi: `bedrock-world-editor_${arch}_${(require("./package.json") as typeof import("./package.json")).version} Setup.msi`,
            iconUrl: "https://raw.githubusercontent.com/8Crafter-Studios/Bedrock-World-Editor/refs/heads/main/resources/icon.ico",
        })),
        new MakerZIP({}, ["darwin"]),
        new MakerRpm(
            {
                options: {
                    icon: "resources/icon.png",
                    mimeType: ["x-scheme-handler/bedrock-world-editor"],
                },
            },
            ["linux"]
        ),
        new MakerDeb({
            options: {
                icon: "resources/icon.png",
                mimeType: ["x-scheme-handler/bedrock-world-editor"],
            },
        }),
    ],
    publishers: [
        {
            name: "@electron-forge/publisher-github",
            config: {
                repository: {
                    owner: "8Crafter-Studios",
                    name: "Bedrock-World-Editor",
                },
                prerelease: true,
                generateReleaseNotes: true,
                draft: true,
            },
        },
    ],
    plugins: [
        new VitePlugin({
            // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
            // If you are familiar with Vite configuration, it will look really familiar.
            build: [
                {
                    // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
                    entry: "src/main.ts",
                    config: "vite.main.config.ts",
                    target: "main",
                },
                {
                    entry: "src/preload.ts",
                    config: "vite.preload.config.ts",
                    target: "preload",
                },
                { entry: "node_modules/monaco-editor/esm/vs/editor/editor.worker.js", config: "vite.misc.worker.config.ts" },
                { entry: "node_modules/monaco-editor/esm/vs/language/json/json.worker", config: "vite.misc.worker.config.ts" },
                { entry: "node_modules/monaco-editor/esm/vs/language/css/css.worker", config: "vite.misc.worker.config.ts" },
                { entry: "node_modules/monaco-editor/esm/vs/language/html/html.worker", config: "vite.misc.worker.config.ts" },
                { entry: "node_modules/monaco-editor/esm/vs/language/typescript/ts.worker", config: "vite.misc.worker.config.ts" },
            ],
            renderer: [
                {
                    name: "main_window",
                    config: "vite.renderer.config.ts",
                },
            ],
        }),
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
    hooks: {
        packageAfterPrune: async (config: ResolvedForgeConfig, build_path: string): Promise<void> => {
            const vite_config = await import("./vite.main.config.ts");
            let external: Exclude<NonNullable<NonNullable<ReturnType<typeof vite_config.default>["build"]>["rollupOptions"]>["external"], undefined> | [] =
                vite_config?.default({ command: "build", mode: "production" } as any)?.build?.rollupOptions?.external || [];
            const commands: string[] = [
                "install",
                "--no-package-lock",
                "--no-save",
                ...(typeof external === "string"
                    ? external.endsWith(".node")
                        ? []
                        : [external]
                    : external instanceof Array
                    ? external.filter((external: string | RegExp): external is string => typeof external === "string" && !external.endsWith(".node"))
                    : []),
            ];

            return new Promise((resolve: (value: void) => void, reject: (reason?: any) => void): void => {
                const npm: ChildProcess = spawn("npm", commands, {
                    cwd: build_path,
                    stdio: "inherit",
                    shell: true,
                });

                npm.on("close", (code: number | null): void => {
                    if (0 === code) {
                        /* writeFileSync(
                            path.join(build_path, "node_modules/leveldb-zlib/binding.js"),
                            `const helper = require('./helpers/buildPath.js')
const path = require('path')
const debug = require('debug')('leveldb')

if (!process.versions.electron) {
  // Electron has its own crash handler, and segfault-handler
  // uses NAN which is a hassle, so only load outside electron
  try {
    const SegfaultHandler = require('segfault-handler')
    SegfaultHandler.registerHandler('crash.log')
  } catch (e) {
    debug('[leveldb] segfault handler is not installed. If you run into crashing issues, install it with \`npm i -D segfault-handler\` to get debug info on native crashes')
  }
}

let bindings
const pathToSearch = helper.getPath()
console.log(5768.1029, pathToSearch, bindings, helper, __dirname);
if (pathToSearch) {
  const rpath = path.join(__dirname, pathToSearch, '/node-leveldb.node')
  try {
    bindings = require(rpath)
  } catch (e) {
    debug(e)
    debug('[leveldb] did not find lib in ', rpath)
  }
}
if (!bindings) {
  bindings = require('bindings')('node-leveldb.node')
}

module.exports = bindings
`
                        ); */
                        // const cleanedModulePath: string = path.resolve(__dirname, "node_modules", "@8crafter/leveldb-zlib");
                        // const targetModulePath: string = path.join(build_path, "node_modules", "@8crafter/leveldb-zlib");

                        // try {
                        //     if (existsSync(cleanedModulePath)) {
                        //         console.log(`Replacing leveldb-zlib with cleaned version...`);

                        //         // Remove the bloated version
                        //         rmSync(targetModulePath, { recursive: true, force: true });

                        //         // Copy the cleaned version
                        //         cpSync(cleanedModulePath, targetModulePath, { recursive: true });

                        //         console.log(`✔ leveldb-zlib replaced successfully`);
                        //     } else {
                        //         console.warn(`⚠ Cleaned module not found at ${cleanedModulePath}`);
                        //     }
                        // } catch (err) {
                        //     console.error(`❌ Failed to replace leveldb-zlib:`, err);
                        // }
                        resolve();
                        return;
                    }

                    reject(`Process exited with code: ${code}`);
                });

                npm.on("error", reject);
            });
        } /* 
        postMake: async (forgeConfig: ResolvedForgeConfig, results: ForgeMakeResult[]): Promise<void> => {
            const version = require("./package.json").version;

            for (const result of results) {
                if (result.arch && result.platform === "win32") {
                    const arch = result.arch;
                    const outputPath = result.artifacts;
                    console.log(`Arch: ${arch}`, `Output Path: ${outputPath}`);
                      for (const file of result.artifacts) {
                        if (file.includes('Setup') || file.includes('full.nupkg')) {
                          const oldPath = path.join(outputPath, file);
                          const ext = path.extname(file);
                          const base = path.basename(file, ext);
                          const newName = `${base}-${arch}-${version}${ext}`;
                          const newPath = path.join(outputPath, newName);
                          fs.renameSync(oldPath, newPath);
                          console.log(`Renamed ${file} → ${newName}`);
                        }
                }
            }
        }, */,
    },
};

export default config;

