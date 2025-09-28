import { lookup } from "node:dns";

export async function getConnectionStatus(): Promise<boolean> {
    return new Promise((resolve: (value: boolean) => void): void => {
        lookup("www.google.com", (err: NodeJS.ErrnoException | null): void => {
            resolve(!err);
        });
    });
}

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
        } else {
            console.error(`Error: ${xhr.status} - ${xhr.statusText}`);
            return null;
        }
    } catch (error) {
        console.error("Request failed:", error);
        return null;
    }
}
