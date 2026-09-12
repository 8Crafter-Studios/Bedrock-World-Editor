import { lookup } from "node:dns";

/**
 * Checks if the device is connected to the internet.
 *
 * This function tries to lookup the DNS of {@link www.google.com} to check if the device is connected to the internet.
 *
 * @returns A promise that resolves with a boolean indicating whether the device is connected to the internet.
 */
export async function getConnectionStatus(): Promise<boolean> {
    return await new Promise((resolve: (value: boolean) => void): void => {
        lookup("www.google.com", (err: NodeJS.ErrnoException | null): void => {
            resolve(!err);
        });
    });
}

/**
 * Synchronously fetches text from a URL.
 *
 * @param url The URL to fetch.
 * @param method The HTTP method to use.
 * @param body The body to send with the request.
 * @param headers The headers to send with the request.
 * @returns The response text, or `null` if the request failed.
 */
export function fetchTextSync(url: string, method: string = "GET", body: any = null, headers: Record<string, string> = {}): string | null {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, false);

    for (const key in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, key)) {
            xhr.setRequestHeader(key, headers[key]!);
        }
    }

    try {
        xhr.send(body ? JSON.stringify(body) : null);

        if (xhr.status >= 200 && xhr.status < 300) {
            return xhr.responseText;
        }
        console.error(`Error: ${xhr.status} - ${xhr.statusText}`);
        return null;
    } catch (error) {
        console.error("Request failed:", error);
        return null;
    }
}
