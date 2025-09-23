import type { JSX, RefObject } from "preact";
import _React, { useRef, useEffect, Component, hydrate } from "preact/compat";
import EventEmitter from "node:events";

/**
 * The options for a toast component.
 */
export interface ToastProps {
    /**
     * The title text of the toast.
     */
    title?: string | undefined;
    /**
     * The message text of the toast.
     */
    message?: string | undefined;
    /**
     * The image URI of the toast.
     */
    image?: string | undefined;
}

/**
 * The event map for the toast manager.
 */
interface ToastManagerEventMap {
    /**
     * Emitted when a toast is shown.
     */
    toastShown: [toast: ActiveToast];
    /**
     * Emitted when a toast starts the hiding animation.
     */
    toastHideStart: [toast: ActiveToast];
    /**
     * Emitted when a toast is hidden.
     */
    toastHidden: [toast: ActiveToast];
    /**
     * Emitted when a toast is queued.
     */
    toastQueued: [toast: ActiveToast];
    /**
     * Emitted when any toast-related update happens.
     */
    anyToastUpdate: [];
}

/**
 * The next toast ID.
 */
let nextToastID: bigint = 0n;

/**
 * The toast manager class.
 */
class ToastManager extends EventEmitter<ToastManagerEventMap> {
    public activeToasts: Map<bigint, ActiveToast> = new Map();
    public hidingToasts: ActiveToast[] = [];
    public toastQueue: ActiveToast[] = [];
    public visibleToasts: ActiveToast[] = [];
}

/**
 * The toast manager.
 */
export const toastManager = new ToastManager();

toastManager.on("toastShown", (): void => {
    toastManager.visibleToasts.forEach((toast: ActiveToast): void => toast.updatePosition());
});

toastManager.on("toastHideStart", (): void => {
    toastManager.visibleToasts.forEach((toast: ActiveToast): void => toast.updatePosition());
});

toastManager.on("toastHidden", (): void => {
    if (toastManager.toastQueue.length > 0 && toastManager.visibleToasts.filter((toast: ActiveToast): boolean => toast.options.mode === "queue").length === 0) {
        toastManager.toastQueue[0]!.show();
    }
});

toastManager.on("toastQueued", (toast: ActiveToast): void => {
    if (
        toastManager.visibleToasts.filter((toast: ActiveToast): boolean => toast.options.mode === "queue").length === 0 &&
        toastManager.hidingToasts.filter((toast: ActiveToast): boolean => toast.options.mode === "queue").length === 0
    ) {
        toast.show();
    }
});

/**
 * Creates a new toast.
 *
 * @param toastOptions The options for the toast.
 * @returns The created toast.
 */
export function createToast(toastOptions: ToastOptions): ActiveToast {
    const id: bigint = nextToastID++;
    const container: HTMLElement = document.createElement("div");
    container.style.position = "fixed";
    container.style.zIndex = "1200000";
    container.style.top = "calc((var(--top, -32) * var(--gui-scale)) * 1px)";
    container.style.setProperty("--top", "-32");
    container.classList.add("nsel", "ndrg");
    container.classList.add("toast-container");
    hydrate(<Toast {...toastOptions} />, container);
    document.body!.appendChild(container);
    return new ActiveToast(id, container, toastOptions);
}

// globalThis.createToast = createToast;

/**
 * Options for creating a toast.
 */
export interface ToastOptions {
    /**
     * The title text of the toast.
     *
     * @default undefined
     */
    title?: string | undefined;
    /**
     * The message text of the toast.
     *
     * @default undefined
     */
    message?: string | undefined;
    /**
     * The image URI of the toast.
     *
     * @default undefined
     */
    image?: string | undefined;
    /**
     * The duration the toast should be visible for in milliseconds.
     *
     * If set to -1, the toast will not close automatically.
     *
     * @default 3000
     */
    duration?: number | undefined;
    /**
     * The mode of the toast.
     *
     * - "stack": The toast will be stacked on below any other visible toasts.
     * - "queue": The toast will be queued to be shown after all other queue mode visible toasts have closed.
     * - "none": The toast will not be shown automatically.
     *
     * @default "queue"
     */
    mode?: "stack" | "queue" | "none";
    /**
     * The sound effect to play when the toast is shown.
     *
     * If set to "none", no sound effect will be played.
     *
     * @default "toast"
     */
    soundEffect?: keyof (typeof SoundEffects)["audioBuffers"] | "none" | undefined;
    /**
     * The volume category to use for the sound effect.
     *
     * @default "ui"
     */
    volumeCategory?: (typeof volumeCategories)[number];
    /**
     * The volume multiplier to use for the sound effect.
     *
     * This is multiplied by the volume of the volume category.
     *
     * `1` is regular volume.
     *
     * @default 1
     */
    volumeMultiplier?: number | undefined;
    /**
     * The volume override to use for the sound effect.
     *
     * This overrides the volume of the volume category.
     *
     * `100` is regular volume.
     *
     * @default undefined
     */
    volumeOverride?: number | undefined;
}

/**
 * A class representing an active toast.
 */
class ActiveToast {
    /**
     * The visibility of the toast.
     */
    public visibility: "hidden" | "visible" = "hidden";
    /**
     * Whether the toast is closed.
     */
    public get isClosed(): boolean {
        return toastManager.activeToasts.get(this.id) === undefined;
    }
    /**
     * Whether the toast is queued.
     */
    public get isQueued(): boolean {
        return toastManager.toastQueue.includes(this);
    }
    /**
     * Creates a new toast.
     *
     * @param id The ID of the toast.
     * @param container The container element of the toast.
     * @param options The options for the toast.
     */
    public constructor(public readonly id: bigint, public readonly container: HTMLElement, public options: ToastOptions = {}) {
        this.options = { duration: 3000, mode: "queue", soundEffect: "toast", ...this.options };
        toastManager.activeToasts.set(this.id, this);
        if (this.options.mode === "stack") {
            this.show();
        } else if (this.options.mode === "queue") {
            this.queue();
        }
    }
    /**
     * Updates the position of the toast.
     */
    public updatePosition(): void {
        if (this.visibility === "hidden" || this.isClosed) return;
        $(this.container).animateCSSVariable("--top", toastManager.visibleToasts.indexOf(this) * 36, 500, "linear");
    }
    /**
     * Shows the toast.
     */
    public show(): void {
        if (this.visibility === "visible" || this.isClosed) return;
        this.visibility = "visible";
        if (this.isQueued) {
            toastManager.toastQueue.splice(toastManager.toastQueue.indexOf(this), 1);
        }
        toastManager.visibleToasts.push(this);
        if (this.options.soundEffect !== "none") {
            SoundEffects[`${this.options.soundEffect ?? "toast"}B`]({
                volumeCategory: this.options.volumeCategory ?? "ui",
                volume:
                    this.options.volumeOverride ??
                    (this.options.volumeMultiplier !== undefined
                        ? (this.options.volumeMultiplier ?? 1) * getAudioCategoryVolume(this.options.volumeCategory ?? "ui")
                        : undefined),
            });
        }
        $(this.container).animateCSSVariable("--top", `${toastManager.visibleToasts.indexOf(this) * 36 - 4}`, 500, "linear");
        toastManager.emit("toastShown", this);
        toastManager.emit("anyToastUpdate");
        if ((this.options.duration ?? 3000) !== -1) {
            setTimeout((): void => {
                this.close();
            }, this.options.duration ?? 3000);
        }
    }
    /**
     * Queues the toast.
     */
    public queue(): void {
        if (this.visibility === "visible" || this.isClosed || this.isQueued) return;
        toastManager.toastQueue.push(this);
        toastManager.emit("toastQueued", this);
        toastManager.emit("anyToastUpdate");
    }
    /**
     * Closes the toast.
     */
    public close(): void {
        if (this.isClosed) return;
        $(this.container).animateCSSVariable("--top", "-32", 500, "linear", (): void => {
            if (toastManager.hidingToasts.includes(this)) {
                toastManager.hidingToasts.splice(toastManager.hidingToasts.indexOf(this), 1);
            }
            this.container.remove();
            toastManager.emit("toastHidden", this);
            toastManager.emit("anyToastUpdate");
        });
        this.visibility = "hidden";
        toastManager.activeToasts.delete(this.id);
        toastManager.hidingToasts.push(this);
        if (toastManager.visibleToasts.includes(this)) {
            toastManager.visibleToasts.splice(toastManager.visibleToasts.indexOf(this), 1);
        }
        toastManager.emit("toastHideStart", this);
        toastManager.emit("anyToastUpdate");
    }
}

/**
 * The toast component.
 *
 * @param props The options for the toast.
 * @returns The toast component.
 */
export default function Toast(props: ToastProps): JSX.SpecificElement<"div"> {
    return (
        <div
            style={{
                width: "calc(100% - (58px * var(--gui-scale)))",
                height: "calc(24px * var(--gui-scale))",
                position: "fixed",
                left: "calc(25px * var(--gui-scale))",
                display: "flex",
                flexDirection: "row",
            }}
            class="toast"
        >
            {props.image && (
                <img
                    aria-hidden="true"
                    style={{ width: "calc(13px * var(--gui-scale))", height: "calc(13px * var(--gui-scale))", margin: "calc(5.5px * var(--gui-scale)) calc(1px * var(--gui-scale)) calc(5.5px * var(--gui-scale)) calc(2px * var(--gui-scale))", display: "inline-block" }}
                    src={props.image}
                />
            )}
            <div style={{flexGrow: 1}}>
                {props.title && (
                    <div
                        style={{
                            color: "#FFFFFFFF",
                            margin: "calc((var(--gui-scale) * 3px) - 1px) calc((var(--gui-scale) * 2px) - 1px) 0",
                        }}
                    >
                        {props.title}
                    </div>
                )}
                {props.message && (
                    <div
                        style={{
                            color: "rgba(255, 255, 255, 0.5)",
                            margin: `${props.title ? 0 : "calc((var(--gui-scale) * 3px) - 1px)"} calc((var(--gui-scale) * 2px) - 1px)`,
                        }}
                    >
                        {props.message}
                    </div>
                )}
            </div>
        </div>
    );
}
