import nodeProcessAAAATEST from "node:process";
// DEBUG
// HACK
//@ts-ignore
globalThis.require = function require(module) {
    switch (module) {
        case "node:fs":
            return {
                existsSync(path) {
                    return false;
                },
            } as Partial<typeof import("node:fs")>;
        case "mime-types":
            return {
                lookup(filenameOrExt) {
                    return false;
                },
            } as Partial<typeof import("mime-types")>;
        case "@electron/remote":
            return {
                app: {
                    getGPUInfo(infoType) {
                        return new Promise(() => void 0);
                    },
                },
            } as Partial<typeof import("@electron/remote")>;
        case "node:process":
            return nodeProcessAAAATEST;
        case "node:os":
        case "node:v8":
        default:
            return {};
    }
};
