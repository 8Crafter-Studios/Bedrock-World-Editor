export function preloadImage(url: string): void {
    new Image().src = url;
}

// TODO
const imagesToPreload: string[] = [];

for (const imageURI of imagesToPreload) {
    preloadImage(imageURI);
}
