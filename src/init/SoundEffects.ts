/**
 * Converts a readable stream to a blob.
 *
 * @param {ReadableStream} readableStream The readable stream to convert to a blob.
 * @returns {Promise<Blob>} A promise that resolves with the blob.
 */
async function readableStreamToBlob(readableStream: ReadableStream): Promise<Blob> {
    const reader: ReadableStreamDefaultReader<any> = readableStream.getReader();
    const chunks: any[] = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        chunks.push(value);
    }
    return new Blob(chunks);
}

/**
 * The audio context.
 */
const audioCtx = new AudioContext();

namespace exports {
    /**
     * Get the volume of a volume category.
     *
     * @param {typeof volumeCategories[number]} category The volume category to get the volume of.
     * @returns {number} The volume of the volume category. Between 0 and 100 (inclusive).
     */
    export function getAudioCategoryVolume(category: (typeof volumeCategories)[number]): number {
        if (!volumeCategories.includes(category)) {
            throw new TypeError("Invalid Audio Volume Category: " + JSON.stringify(category));
        }
        if (category === "master") {
            return config.volume.master;
        }
        return config.volume[category] * (config.volume.master / 100);
    }
    /**
     * A class for playing sound effects.
     *
     * @hideconstructor
     */
    export class SoundEffects {
        private constructor() {}
        static audioElements = {
            pop: new Audio("resource://sounds/ui/click/Click_stereo.ogg.mp3"),
            release: new Audio("resource://sounds/ui/click/Release.ogg.mp3"),
            toast: new Audio("resource://sounds/ui/Toast.ogg"),
        };
        static dataURLs: { pop: string; release: string; toast: string } = {} as any;
        static audioElementsB = {
            get pop(): HTMLAudioElement {
                return new Audio(SoundEffects.dataURLs.pop);
            },
            get release(): HTMLAudioElement {
                return new Audio(SoundEffects.dataURLs.release);
            },
            get toast(): HTMLAudioElement {
                return new Audio(SoundEffects.dataURLs.toast);
            },
        };
        /**
         * @type {{pop: AudioBuffer; release: AudioBuffer; toast: AudioBuffer;}}
         */
        static audioBuffers: { pop: AudioBuffer; release: AudioBuffer; toast: AudioBuffer } = {} as any;
        /**
         * Plays the pop sound effect.
         *
         * @param {object} [options = {volumeCategory: "ui", volume: undefined}] The options to use.
         * @param {typeof volumeCategories[number]} [options.volumeCategory = "ui"] The volume category to use.
         * @param {number} [options.volume = undefined] The volume to use. If undefined, the volume of the volume category will be used. If specified it will override the volume of the volume category. Should be a float between 0 and 100 (inclusive).
         * @returns {Promise<void>} A promise that resolves when the audio has finished playing.
         */
        static async pop(
            options: { volumeCategory?: (typeof volumeCategories)[number]; volume?: number } = { volumeCategory: "ui", volume: undefined }
        ): Promise<void> {
            const volume: number = (options?.volume ?? getAudioCategoryVolume(options?.volumeCategory ?? "ui")) / 100;
            const audioElement: HTMLAudioElement = this.audioElementsB.pop;
            audioElement.volume = volume;
            return await audioElement.play();
        }
        /**
         * Plays the pop sound effect using an audio buffer.
         *
         * @param {object} [options = {volumeCategory: "ui", volume: undefined}] The options to use.
         * @param {typeof volumeCategories[number]} [options.volumeCategory = "ui"] The volume category to use.
         * @param {number} [options.volume = undefined] The volume to use. If undefined, the volume of the volume category will be used. If specified it will override the volume of the volume category. Should be a float between 0 and 100 (inclusive).
         * @returns {Promise<{source: AudioScheduledSourceNode; ev: Event;}>} A promise that resolves with the audio source and event when the audio buffer has finished playing.
         */
        static async popB(
            options: { volumeCategory?: (typeof volumeCategories)[number]; volume?: number } = { volumeCategory: "ui", volume: undefined }
        ): Promise<{ source: AudioScheduledSourceNode; ev: Event }> {
            return await this.playBuffer(this.audioBuffers.pop, options);
        }
        /**
         * Plays the release sound effect.
         *
         * @param {object} [options = {volumeCategory: "ui", volume: undefined}] The options to use.
         * @param {typeof volumeCategories[number]} [options.volumeCategory = "ui"] The volume category to use.
         * @param {number} [options.volume = undefined] The volume to use. If undefined, the volume of the volume category will be used. If specified it will override the volume of the volume category. Should be a float between 0 and 100 (inclusive).
         * @returns {Promise<void>} A promise that resolves when the audio has finished playing.
         */
        static async release(
            options: { volumeCategory?: (typeof volumeCategories)[number]; volume?: number } = { volumeCategory: "ui", volume: undefined }
        ): Promise<void> {
            const volume: number = (options?.volume ?? getAudioCategoryVolume(options?.volumeCategory ?? "ui")) / 100;
            const audioElement: HTMLAudioElement = this.audioElementsB.release;
            audioElement.volume = volume;
            return await audioElement.play();
        }
        /**
         * Plays the release sound effect using an audio buffer.
         *
         * @param {object} [options = {volumeCategory: "ui", volume: undefined}] The options to use.
         * @param {typeof volumeCategories[number]} [options.volumeCategory = "ui"] The volume category to use.
         * @param {number} [options.volume = undefined] The volume to use. If undefined, the volume of the volume category will be used. If specified it will override the volume of the volume category. Should be a float between 0 and 100 (inclusive).
         * @returns {Promise<{source: AudioScheduledSourceNode; ev: Event;}>} A promise that resolves with the audio source and event when the audio buffer has finished playing.
         */
        static async releaseB(
            options: { volumeCategory?: (typeof volumeCategories)[number]; volume?: number } = { volumeCategory: "ui", volume: undefined }
        ): Promise<{ source: AudioScheduledSourceNode; ev: Event }> {
            return await this.playBuffer(this.audioBuffers.release, options);
        }
        /**
         * Plays the toast sound effect.
         *
         * @param {object} [options = {volumeCategory: "ui", volume: undefined}] The options to use.
         * @param {typeof volumeCategories[number]} [options.volumeCategory = "ui"] The volume category to use.
         * @param {number} [options.volume = undefined] The volume to use. If undefined, the volume of the volume category will be used. If specified it will override the volume of the volume category. Should be a float between 0 and 100 (inclusive).
         * @returns {Promise<void>} A promise that resolves when the audio has finished playing.
         */
        static async toast(
            options: { volumeCategory?: (typeof volumeCategories)[number]; volume?: number } = { volumeCategory: "ui", volume: undefined }
        ): Promise<void> {
            const volume: number = (options?.volume ?? getAudioCategoryVolume(options?.volumeCategory ?? "ui")) / 100;
            const audioElement: HTMLAudioElement = this.audioElementsB.toast;
            audioElement.volume = volume;
            return await audioElement.play();
        }
        /**
         * Plays the toast sound effect using an audio buffer.
         *
         * @param {object} [options = {volumeCategory: "ui", volume: undefined}] The options to use.
         * @param {typeof volumeCategories[number]} [options.volumeCategory = "ui"] The volume category to use.
         * @param {number} [options.volume = undefined] The volume to use. If undefined, the volume of the volume category will be used. If specified it will override the volume of the volume category. Should be a float between 0 and 100 (inclusive).
         * @returns {Promise<{source: AudioScheduledSourceNode; ev: Event;}>} A promise that resolves with the audio source and event when the audio buffer has finished playing.
         */
        static async toastB(
            options: { volumeCategory?: (typeof volumeCategories)[number]; volume?: number } = { volumeCategory: "ui", volume: undefined }
        ): Promise<{ source: AudioScheduledSourceNode; ev: Event }> {
            return await this.playBuffer(this.audioBuffers.toast, options);
        }
        /**
         * Play an audio buffer.
         *
         * @param {AudioBuffer | null} audioBuffer The audio buffer to play.
         * @param {object} [options = {volumeCategory: "ui", volume: undefined}] The options to use.
         * @param {typeof volumeCategories[number]} [options.volumeCategory = "ui"] The volume category to use.
         * @param {number} [options.volume = undefined] The volume to use. If undefined, the volume of the volume category will be used. If specified it will override the volume of the volume category. Should be a float between 0 and 100 (inclusive).
         * @returns {Promise<{source: AudioScheduledSourceNode, ev: Event}>} A promise that resolves with the audio source and event when the audio buffer has finished playing.
         */
        static playBuffer(
            audioBuffer: AudioBuffer | null,
            options: { volumeCategory?: (typeof volumeCategories)[number]; volume?: number } = { volumeCategory: "ui", volume: undefined }
        ): Promise<{ source: AudioScheduledSourceNode; ev: Event }> {
            const volume: number = -1 + (options?.volume ?? getAudioCategoryVolume(options?.volumeCategory ?? "ui")) / 100;
            // create an AudioBufferSourceNode
            const source: AudioBufferSourceNode = audioCtx.createBufferSource();

            // set the AudioBuffer
            source.buffer = audioBuffer;

            const sourceB: GainNode = audioCtx.createGain();
            sourceB.gain.value = volume;
            source.connect(sourceB);
            sourceB.connect(audioCtx.destination);

            // connect it to the default sound output
            source.connect(audioCtx.destination);

            // start playback
            source.start();
            return new Promise(
                (resolve: (value: { source: AudioScheduledSourceNode; ev: Event }) => void) => (source.onended = (ev) => resolve({ source, ev }))
            );
        }
    }
    (async (): Promise<typeof SoundEffects.audioBuffers> => ({
        pop: await audioCtx.decodeAudioData(await (await fetch("resource://sounds/ui/click/Click_stereo.ogg.mp3")).arrayBuffer()),
        release: await audioCtx.decodeAudioData(await (await fetch("resource://sounds/ui/click/Release.ogg.mp3")).arrayBuffer()),
        toast: await audioCtx.decodeAudioData(await (await fetch("resource://sounds/ui/Toast.ogg")).arrayBuffer()),
    }))().then((o: typeof SoundEffects.audioBuffers): typeof SoundEffects.audioBuffers => (SoundEffects.audioBuffers = o));
    (async (): Promise<void> => {
        const file: Blob = await (await fetch("resource://sounds/ui/click/Click_stereo.ogg.mp3")).blob();
        const reader = new FileReader();

        reader.addEventListener(
            "load",
            (): void => {
                // convert image file to base64 string
                SoundEffects.dataURLs.pop = reader.result as string;
            },
            false
        );

        if (file) {
            reader.readAsDataURL(file);
        }
    })();
    (async (): Promise<void> => {
        const file: Blob = await (await fetch("resource://sounds/ui/click/Release.ogg.mp3")).blob();
        const reader = new FileReader();

        reader.addEventListener(
            "load",
            (): void => {
                // convert image file to base64 string
                SoundEffects.dataURLs.release = reader.result as string;
            },
            false
        );

        if (file) {
            reader.readAsDataURL(file);
        }
    })();
    (async (): Promise<void> => {
        const file: Blob = await (await fetch("resource://sounds/ui/Toast.ogg")).blob();
        const reader = new FileReader();

        reader.addEventListener(
            "load",
            (): void => {
                // convert image file to base64 string
                SoundEffects.dataURLs.toast = reader.result as string;
            },
            false
        );

        if (file) {
            reader.readAsDataURL(file);
        }
    })();
}

Object.defineProperties(globalThis, {
    SoundEffects: {
        value: exports.SoundEffects,
        configurable: true,
        enumerable: true,
        writable: false,
    },
    getAudioCategoryVolume: {
        value: exports.getAudioCategoryVolume,
        configurable: true,
        enumerable: true,
        writable: false,
    },
});

declare global {
    export import SoundEffects = exports.SoundEffects;
    export import getAudioCategoryVolume = exports.getAudioCategoryVolume;
}
