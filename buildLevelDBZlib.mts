import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

console.log("Fixing leveldb-zlib CMakeLists...");

writeFileSync(
    "./node_modules/leveldb-zlib/leveldb-mcpe/CMakeLists.txt",
    readFileSync("./node_modules/leveldb-zlib/leveldb-mcpe/CMakeLists.txt", "utf-8").replace(
        "cmake_minimum_required(VERSION 3.2)",
        "cmake_minimum_required(VERSION 3.5)"
    )
);

if (process.platform === "win32") {
    console.log("Building leveldb-zlib helper...");

    execSync("cd ./node_modules/leveldb-zlib/helpers && win-build.bat");
}

console.log("Building leveldb-zlib...");

execSync("cd ./node_modules/leveldb-zlib && npm run install");

console.log("Cleaning leveldb-zlib...");

console.log("Removing ./node_modules/leveldb-zlib/leveldb-mcpe...");
rmSync("./node_modules/leveldb-zlib/leveldb-mcpe", { force: true, recursive: true });

console.log("Removing ./node_modules/leveldb-zlib/test...");
rmSync("./node_modules/leveldb-zlib/test", { force: true, recursive: true });

console.log("Removing ./node_modules/leveldb-zlib/docs...");
rmSync("./node_modules/leveldb-zlib/docs", { force: true, recursive: true });

console.log("Removing ./node_modules/leveldb-zlib/helpers/win-vcpkg-export_unzipped.tar...");
rmSync("./node_modules/leveldb-zlib/helpers/win-vcpkg-export_unzipped.tar", { force: true, recursive: true });

console.log("Removing ./node_modules/leveldb-zlib/helpers/win-vcpkg-export.tar.gz...");
rmSync("./node_modules/leveldb-zlib/helpers/win-vcpkg-export.tar.gz", { force: true, recursive: true });

console.log("Removing ./node_modules/leveldb-zlib/helpers/win-build.bat...");
rmSync("./node_modules/leveldb-zlib/helpers/win-build.bat", { force: true, recursive: true });

console.log("Removing ./node_modules/leveldb-zlib/helpers/win-build.js...");
rmSync("./node_modules/leveldb-zlib/helpers/win-build.js", { force: true, recursive: true });

console.log("Removing ./node_modules/leveldb-zlib/.github...");
rmSync("./node_modules/leveldb-zlib/.github", { force: true, recursive: true });
