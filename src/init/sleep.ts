namespace exports {
    export function sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}

Object.defineProperty(globalThis, "sleep", {
    configurable: true,
    enumerable: true,
    writable: false,
    value: exports.sleep,
});

declare global {
    export import sleep = exports.sleep;
}
