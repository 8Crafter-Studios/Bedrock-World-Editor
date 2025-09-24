import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

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
