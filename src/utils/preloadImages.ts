export let defaultWorldIconDataURI: string | null = null;
fetch("resource://images/ui/misc/CreateNewWorld.png").then(
    async (response: Response): Promise<void> =>
        void (defaultWorldIconDataURI = `data:image/png;base64,${Buffer.from(await (await response.blob()).arrayBuffer()).toString("base64")}`)
);

export function preloadImage(url: string): void {
    new Image().src = url;
}

// TODO
const imagesToPreload: string[] = [];

for (const imageURI of imagesToPreload) {
    preloadImage(imageURI);
}
