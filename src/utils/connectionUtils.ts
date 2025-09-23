import { lookup } from "node:dns";

export async function getConnectionStatus(): Promise<boolean> {
    return new Promise((resolve: (value: boolean) => void): void => {
        lookup("www.google.com", (err: NodeJS.ErrnoException | null): void => {
            resolve(!err);
        });
    });
}
