export function preloadImage(url: string): void {
    new Image().src = url;
}

// TO-DO
const imagesToPreload: string[] = [];

for (const imageURI of imagesToPreload) {
    preloadImage(imageURI);
}
