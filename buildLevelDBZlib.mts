import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

writeFileSync(
    "./node_modules/leveldb-zlib/leveldb-mcpe/CMakeLists.txt",
    readFileSync("./node_modules/leveldb-zlib/leveldb-mcpe/CMakeLists.txt", "utf-8").replace(
        "cmake_minimum_required(VERSION 3.2)",
        "cmake_minimum_required(VERSION 3.5)"
    )
);

if (process.platform === "win32") {
    execSync("cd ./node_modules/leveldb-zlib/helpers && win-build.bat");
}

execSync("cd ./node_modules/leveldb-zlib && npm run install");

rmSync("./node_modules/leveldb-zlib/leveldb-mcpe", { force: true, recursive: true });

rmSync("./node_modules/leveldb-zlib/test", { force: true, recursive: true });

rmSync("./node_modules/leveldb-zlib/docs", { force: true, recursive: true });

rmSync("./node_modules/leveldb-zlib/helpers/win-vcpkg-export_unzipped.tar", { force: true, recursive: true });

rmSync("./node_modules/leveldb-zlib/helpers/win-vcpkg-export.tar.gz", { force: true, recursive: true });

rmSync("./node_modules/leveldb-zlib/helpers/win-build.bat", { force: true, recursive: true });

rmSync("./node_modules/leveldb-zlib/helpers/win-build.js", { force: true, recursive: true });

rmSync("./node_modules/leveldb-zlib/.github", { force: true, recursive: true });

