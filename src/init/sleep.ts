namespace exports {
    /**
     * Waits for the specified number of milliseconds.
     *
     * @param ms The number of milliseconds to wait.
     * @returns A promise that resolves after the specified number of milliseconds.
     */
    export async function sleep(ms: number): Promise<void> {
        return void (await new Promise((resolve) => {
            setTimeout(resolve, ms);
        }));
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
