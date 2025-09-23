import type { ClassAttributes, ComponentChild, JSX, RefObject } from "preact";
import { useRef, useEffect, useState, Component } from "preact/compat";
import { Nineslice } from "../../src/utils/ImageResizer";
import mergeRefs from "merge-refs";

export interface SliderProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "ref"> {
    children?: never;
    onInput?: JSX.InputEventHandler<HTMLInputElement>;
    onChange?: (this: HTMLInputElement, event: Event) => void;
    label: string;
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    ref?: RefObject<Component<SliderProps> & { base?: HTMLDivElement }>;
    labelRef?: RefObject<HTMLLabelElement>;
    inputRef?: RefObject<SliderInnerHTMLInputElement>;
    canvasRef?: RefObject<HTMLCanvasElement>;
    disabled?: boolean;
}

async function loadImageForCanvas(imageSource: string): Promise<{ data: ImageData; image: HTMLImageElement }> {
    return new Promise(
        (
            resolve: (value: { data: ImageData; image: HTMLImageElement } | PromiseLike<{ data: ImageData; image: HTMLImageElement }>) => void,
            reject: (reason?: any) => void
        ): void => {
            const img: HTMLImageElement = new Image();
            img.onload = function (): void {
                const canvas: HTMLCanvasElement = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;

                const ctx: CanvasRenderingContext2D = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0);

                const imageData: ImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                resolve({ data: imageData, image: img });
            };
            img.onerror = reject;

            img.src = imageSource;
        }
    );
}

const sliderImagePromises = {
    slider_background_hover: loadImageForCanvas("resource://images/ui/slider/slider_background_hover.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_background_hover = v)
    ),
    slider_background: loadImageForCanvas("resource://images/ui/slider/slider_background.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_background = v)
    ),
    slider_border: loadImageForCanvas("resource://images/ui/slider/slider_border.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_border = v)
    ),
    slider_button_default: loadImageForCanvas("resource://images/ui/slider/slider_button_default.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_button_default = v)
    ),
    slider_button_hover: loadImageForCanvas("resource://images/ui/slider/slider_button_hover.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_button_hover = v)
    ),
    slider_button_indent: loadImageForCanvas("resource://images/ui/slider/slider_button_indent.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_button_indent = v)
    ),
    slider_button_locked: loadImageForCanvas("resource://images/ui/slider/slider_button_locked.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_button_locked = v)
    ),
    slider_locked_transparent_fade: loadImageForCanvas("resource://images/ui/slider/slider_locked_transparent_fade.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_locked_transparent_fade = v)
    ),
    slider_progress_hover: loadImageForCanvas("resource://images/ui/slider/slider_progress_hover.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_progress_hover = v)
    ),
    slider_progress: loadImageForCanvas("resource://images/ui/slider/slider_progress.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_progress = v)
    ),
    slider_step_background_hover: loadImageForCanvas("resource://images/ui/slider/slider_step_background_hover.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_step_background_hover = v)
    ),
    slider_step_background: loadImageForCanvas("resource://images/ui/slider/slider_step_background.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_step_background = v)
    ),
    slider_step_progress_hover: loadImageForCanvas("resource://images/ui/slider/slider_step_progress_hover.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_step_progress_hover = v)
    ),
    slider_step_progress: loadImageForCanvas("resource://images/ui/slider/slider_step_progress.png").then(
        (v: { data: ImageData; image: HTMLImageElement }): { data: ImageData; image: HTMLImageElement } => (sliderImages.slider_step_progress = v)
    ),
};

const sliderImages = {
    slider_background_hover: undefined,
    slider_background: undefined,
    slider_border: undefined,
    slider_button_default: undefined,
    slider_button_hover: undefined,
    slider_button_indent: undefined,
    slider_button_locked: undefined,
    slider_locked_transparent_fade: undefined,
    slider_progress_hover: undefined,
    slider_progress: undefined,
    slider_step_background_hover: undefined,
    slider_step_background: undefined,
    slider_step_progress_hover: undefined,
    slider_step_progress: undefined,
} as { [key in keyof typeof sliderImagePromises]: { data: ImageData; image: HTMLImageElement } | undefined };

var sliderID: bigint = 0n; /* 

export class Slider extends Component<SliderProps> {
    public state: Pick<SliderProps, "onInput" | "onChange" | "label" | "defaultValue" | "min" | "max" | "step">;
    public constructor(props: SliderProps) {
        super(props);
        this.state = {
            onInput: props.onInput,
            onChange: props.onChange,
            label: props.label,
            defaultValue: props.defaultValue ?? 0,
            min: props.min ?? 0,
            max: props.max ?? 100,
            step: props.step ?? 1,
        };
    }
    public render(): JSX.SpecificElement<"div"> & {
        props: { children: [JSX.SpecificElement<"label">, JSX.SpecificElement<"input">, JSX.SpecificElement<"br">, JSX.SpecificElement<"canvas">] };
    } {
        return (
            <div class="mcslidercontainer nsel" onTouchStart={(): void => {}} style={{ display: "inline-block", width: "100%" }} data-slider-id={thisSliderID}>
                <label>
                    {options.label}: {defaultValue}
                </label>
                <input
                    title={options.title}
                    type="range"
                    value={options.defaultValue}
                    data-precise-value={options.defaultValue}
                    min={options.min}
                    max={options.max}
                    step={options.step}
                    onInput={options.onInput}
                    style={{ display: "none" }}
                    ref={sliderInputRef}
                ></input>
                <br />
                <canvas
                    class="mcslidercanvas"
                    style={{ "vertical-align": "middle", width: "100%", height: "calc(16px * var(--gui-scale))", imageRendering: "pixelated" }}
                    height="16"
                    data-is-dragging={false}
                    // onLoad={console.log}
                    onTouchStart={(event: JSX.TargetedTouchEvent<HTMLCanvasElement>): void => {
                        const GUIScale: number = event.currentTarget.clientHeight / 16;
                        const element: HTMLInputElement = event.currentTarget.parentElement!.children[1] as HTMLInputElement;
                        const rect: DOMRect = event.currentTarget.getBoundingClientRect();
                        const x: number = event.touches[0]!.clientX - rect.left - 5 * GUIScale;
                        element.value = (
                            Math.round(Math.max(min, Math.min(max, (x / (rect.width - 10 * GUIScale)) * (max - min) + min)) / step) * step
                        ).toString();
                        element.setAttribute(
                            "data-precise-value",
                            Math.max(min, Math.min(max, (x / (rect.width - 10 * GUIScale)) * (max - min) + min)).toString()
                        );
                        event.currentTarget.parentElement!.children[0]!.textContent = options.label + ": " + element.value;
                        event.currentTarget.setAttribute("data-is-dragging", "true");
                        if (currentMouseMoveListener) window.removeEventListener("mousemove", currentMouseMoveListener);
                        currentMouseMoveListener = mouseMoveListener.bind(event.currentTarget);
                        window.addEventListener("mousemove", currentMouseMoveListener);
                        if (currentMouseUpListener) window.removeEventListener("mouseup", currentMouseUpListener);
                        currentMouseUpListener = function mouseUpListener(this: HTMLCanvasElement): void {
                            this.setAttribute("data-is-dragging", "false");
                            if (currentMouseMoveListener) window.removeEventListener("mousemove", currentMouseMoveListener);
                            if (currentMouseUpListener) window.removeEventListener("mouseup", currentMouseUpListener);
                            element.dispatchEvent(new Event("input"));
                            element.dispatchEvent(new Event("change"));
                            renderSlider(this, element);
                        }.bind(event.currentTarget);
                        window.addEventListener("mouseup", currentMouseUpListener);
                        element.dispatchEvent(new Event("input"));
                        renderSlider(event.currentTarget, element);
                    }}
                    onMouseDown={(event: JSX.TargetedMouseEvent<HTMLCanvasElement>): void => {
                        const GUIScale: number = event.currentTarget.clientHeight / 16;
                        const element: HTMLInputElement = event.currentTarget.parentElement!.children[1] as HTMLInputElement;
                        const rect: DOMRect = event.currentTarget.getBoundingClientRect();
                        const x: number = event.clientX - rect.left - 5 * GUIScale;
                        element.value = (
                            Math.round(Math.max(min, Math.min(max, (x / (rect.width - 10 * GUIScale)) * (max - min) + min)) / step) * step
                        ).toString();
                        element.setAttribute(
                            "data-precise-value",
                            Math.max(min, Math.min(max, (x / (rect.width - 10 * GUIScale)) * (max - min) + min)).toString()
                        );
                        event.currentTarget.parentElement!.children[0]!.textContent = options.label + ": " + element.value;
                        event.currentTarget.setAttribute("data-is-dragging", "true");
                        if (currentMouseMoveListener) window.removeEventListener("mousemove", currentMouseMoveListener);
                        currentMouseMoveListener = mouseMoveListener.bind(event.currentTarget);
                        window.addEventListener("mousemove", currentMouseMoveListener);
                        if (currentMouseUpListener) window.removeEventListener("mouseup", currentMouseUpListener);
                        currentMouseUpListener = function mouseUpListener(this: HTMLCanvasElement): void {
                            this.setAttribute("data-is-dragging", "false");
                            if (currentMouseMoveListener) window.removeEventListener("mousemove", currentMouseMoveListener);
                            if (currentMouseUpListener) window.removeEventListener("mouseup", currentMouseUpListener);
                            element.dispatchEvent(new Event("input"));
                            element.dispatchEvent(new Event("change"));
                            renderSlider(this, element);
                        }.bind(event.currentTarget);
                        window.addEventListener("mouseup", currentMouseUpListener);
                        element.dispatchEvent(new Event("input"));
                        renderSlider(event.currentTarget, element);
                    }}
                    onMouseOver={(event: JSX.TargetedMouseEvent<HTMLCanvasElement>): void => {
                        event.currentTarget.setAttribute("data-is-hovering", "true");
                        renderSlider(event.currentTarget, event.currentTarget.parentElement!.children[1] as HTMLInputElement);
                    }}
                    onMouseOut={(event: JSX.TargetedMouseEvent<HTMLCanvasElement>): void => {
                        event.currentTarget.setAttribute("data-is-hovering", "false");
                        renderSlider(event.currentTarget, event.currentTarget.parentElement!.children[1] as HTMLInputElement);
                    }}
                    ref={sliderCanvasRef}
                ></canvas>
            </div>
        );
    }
} */

export default function Slider(options: SliderProps): JSX.SpecificElement<"div"> & {
    props: { children: [JSX.SpecificElement<"label">, JSX.SpecificElement<"input">, JSX.SpecificElement<"br">, JSX.SpecificElement<"canvas">] };
} {
    const sliderInputRef: RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
    const sliderCanvasRef: RefObject<HTMLCanvasElement> = useRef<HTMLCanvasElement>(null);
    const thisSliderID: bigint = sliderID++;
    function mouseMoveListener(this: HTMLCanvasElement, event: MouseEvent): void {
        const GUIScale: number = this.clientHeight / 16;
        const element: HTMLInputElement = this.parentElement!.children[1] as HTMLInputElement;
        const min: number = Number(element.min);
        const max: number = Number(element.max);
        const step: number = Number(element.step);
        const rect: DOMRect = this.getBoundingClientRect();
        const x: number = event.clientX - rect.left - 5 * GUIScale;
        element.setAttribute(
            "data-value",
            (Math.round(Math.max(min, Math.min(max, (x / (rect.width - 10 * GUIScale)) * (max - min) + min)) / step) * step).toString()
        );
        element.setAttribute("data-precise-value", Math.max(min, Math.min(max, (x / (rect.width - 10 * GUIScale)) * (max - min) + min)).toString());
        this.parentElement!.children[0]!.textContent = options.label + ": " + element.getAttribute("data-value");
        element.dispatchEvent(new Event("input"));
        renderSlider(this, element);
    }
    let currentMouseMoveListener: ((event: MouseEvent) => void) | undefined = undefined;
    let currentMouseUpListener: ((event: MouseEvent) => void) | undefined = undefined;
    let currentRenderIteration: bigint = 0n;
    async function renderSlider(target: HTMLCanvasElement, element: HTMLInputElement): Promise<void> {
        const min: number = Number(element.min);
        const max: number = Number(element.max);
        const step: number = Number(element.step);
        const thisRenderIteration: bigint = currentRenderIteration++;
        const GUIScale: number = config.actualGUIScale;
        target.width = target.clientWidth;
        target.height = target.clientHeight;
        const sliderHorizontalPadding: number = 5 * GUIScale;
        const sliderVerticalPadding: number = 3 * GUIScale;
        const isHovering: boolean = target.getAttribute("data-is-hovering") === "true" ? true : false;
        const isDragging: boolean = target.getAttribute("data-is-dragging") === "true" ? true : false;
        const locked: boolean = element.disabled;
        const stepCount: number = Math.floor((max - min) / step);
        const maxVisibleSteps: number = Math.floor((target.width - sliderHorizontalPadding * 2 - 1) / (3 * GUIScale));
        // console.log(maxVisibleSteps);
        const stepsVisible: boolean = stepCount <= 1 || stepCount >= maxVisibleSteps ? false : true;
        target.style.cursor = isHovering ? "pointer" : "default";
        const context: CanvasRenderingContext2D | null = target.getContext("2d");
        if (!context) return;
        context.imageSmoothingEnabled = false;
        context.imageSmoothingQuality = "high";
        let sliderBackgroundImage: { data: ImageData; image: HTMLImageElement } | undefined = isHovering
            ? sliderImages.slider_background_hover
            : sliderImages.slider_background;
        if (!sliderBackgroundImage) {
            sliderBackgroundImage = await sliderImagePromises[isHovering ? "slider_background_hover" : "slider_background"];
            if (currentRenderIteration !== thisRenderIteration) return;
        }
        let sliderProgressImage: { data: ImageData; image: HTMLImageElement } | undefined = locked
            ? sliderImages.slider_progress
            : isHovering
            ? sliderImages.slider_progress_hover
            : sliderImages.slider_progress;
        if (!sliderProgressImage) {
            sliderProgressImage = await sliderImagePromises[isHovering ? "slider_progress_hover" : "slider_progress"];
            if (currentRenderIteration !== thisRenderIteration) return;
        }
        let sliderStepBackgroundImage: { data: ImageData; image: HTMLImageElement } | undefined = locked
            ? sliderImages.slider_step_background
            : isHovering
            ? sliderImages.slider_step_background_hover
            : sliderImages.slider_step_background;
        if (!sliderStepBackgroundImage) {
            sliderStepBackgroundImage = await sliderImagePromises[isHovering ? "slider_step_background_hover" : "slider_step_background"];
            if (currentRenderIteration !== thisRenderIteration) return;
        }
        let sliderStepProgressImage: { data: ImageData; image: HTMLImageElement } | undefined = locked
            ? sliderImages.slider_step_progress
            : isHovering
            ? sliderImages.slider_step_progress_hover
            : sliderImages.slider_step_progress;
        if (!sliderStepProgressImage) {
            sliderStepProgressImage = await sliderImagePromises[isHovering ? "slider_step_progress_hover" : "slider_step_progress"];
            if (currentRenderIteration !== thisRenderIteration) return;
        }
        let sliderButtonImage: { data: ImageData; image: HTMLImageElement } | undefined = locked
            ? sliderImages.slider_button_locked
            : isHovering
            ? sliderImages.slider_button_hover
            : sliderImages.slider_button_default;
        if (!sliderButtonImage) {
            sliderButtonImage = await sliderImagePromises[isHovering ? "slider_button_hover" : "slider_button_default"];
            if (currentRenderIteration !== thisRenderIteration) return;
        }
        const sliderButton: ImageData = Nineslice.resize(
            new ImageData(
                Nineslice.ninesliceResize(
                    {
                        base_size: [sliderButtonImage.data.width, sliderButtonImage.data.height],
                        nineslice_size: locked ? [1, 1, 1, 1] : [2, 2, 2, 2],
                    },
                    sliderButtonImage.data.data,
                    10,
                    16
                ),
                10,
                16
            ),
            10 * GUIScale,
            16 * GUIScale
        );
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);

        context.strokeStyle = "#000000FF; opacity: 1";
        context.globalAlpha = 1;
        context.lineWidth = GUIScale;
        context.strokeRect(
            sliderHorizontalPadding + GUIScale / 2,
            sliderVerticalPadding + GUIScale / 2,
            context.canvas.width - sliderHorizontalPadding * 2 - GUIScale,
            context.canvas.height - sliderVerticalPadding * 2 - GUIScale
        );

        context.drawImage(
            sliderBackgroundImage.image,
            6 * GUIScale,
            4 * GUIScale,
            context.canvas.width - (sliderHorizontalPadding + GUIScale) * 2,
            context.canvas.height - (sliderVerticalPadding + GUIScale) * 2
        );

        // console.log(Number(element.getAttribute("data-value") ?? defaultValue));

        const valuePercentage: number = Math.min(1, Math.max(0, (Number(element.getAttribute("data-value") ?? defaultValue) - min) / (max - min)));
        const preciseValuePercentage: number = Math.min(
            1,
            Math.max(0, (Number(element.getAttribute("data-precise-value") ?? defaultValue) - min) / (max - min))
        );
        const progressX: number = Math.round(valuePercentage * (context.canvas.width - (sliderHorizontalPadding + GUIScale) * 2));
        const sliderX: number = Math.round((isDragging ? preciseValuePercentage : valuePercentage) * (context.canvas.width - sliderHorizontalPadding * 2));

        if (progressX > 0)
            context.drawImage(sliderProgressImage.image, 6 * GUIScale, 4 * GUIScale, progressX, context.canvas.height - (sliderVerticalPadding + GUIScale) * 2);

        if (stepsVisible) {
            for (let i: number = 1; i < stepCount; i++) {
                const stepX: number = Math.round((i / stepCount) * (context.canvas.width - (sliderHorizontalPadding + GUIScale) * 2)) - GUIScale;
                switch (true) {
                    case stepX >= progressX:
                        context.drawImage(
                            sliderStepProgressImage.image,
                            6 * GUIScale + stepX,
                            5 * GUIScale,
                            2 * GUIScale,
                            context.canvas.height - (sliderVerticalPadding + 2 * GUIScale) * 2
                        );
                        break;
                    case stepX + GUIScale >= progressX:
                        context.drawImage(
                            sliderStepBackgroundImage.image,
                            6 * GUIScale + stepX,
                            5 * GUIScale,
                            1 * GUIScale,
                            context.canvas.height - (sliderVerticalPadding + 2 * GUIScale) * 2
                        );
                        context.drawImage(
                            sliderStepProgressImage.image,
                            6 * GUIScale + stepX + GUIScale,
                            5 * GUIScale,
                            1 * GUIScale,
                            context.canvas.height - (sliderVerticalPadding + 2 * GUIScale) * 2
                        );
                        break;
                    default:
                        context.drawImage(
                            sliderStepBackgroundImage.image,
                            6 * GUIScale + stepX,
                            5 * GUIScale,
                            2 * GUIScale,
                            context.canvas.height - (sliderVerticalPadding + 2 * GUIScale) * 2
                        );
                }
            }
        }

        // console.log(sliderButton, sliderX, 0);
        context.putImageData(sliderButton, sliderX, 0);
        if (element.parentElement?.children[0] instanceof HTMLLabelElement) {
            if (locked) {
                element.parentElement.children[0].style.opacity = "0.5";
            } else {
                element.parentElement.children[0].style.opacity = "1";
            }
        }
    }
    const defaultValue: number = options.defaultValue ?? 0;
    useEffect((): (() => void) => {
        function onRefreshSliderCallback(): void {
            const target: HTMLCanvasElement | null = sliderCanvasRef.current;
            const element: HTMLInputElement | null = sliderInputRef.current;
            if (target && element) renderSlider(target, element);
        }
        if (sliderInputRef.current) {
            if (options.onChange) {
                sliderInputRef.current.addEventListener("change", options.onChange);
            }
            sliderInputRef.current.addEventListener("refreshSlider", onRefreshSliderCallback);
        }
        let isVisible: boolean = false;
        const observer = new IntersectionObserver(
            ([entry]: IntersectionObserverEntry[]): void => {
                if (entry?.isIntersecting) {
                    isVisible = true;
                    const target: HTMLCanvasElement = sliderCanvasRef.current!;
                    const element: HTMLInputElement = sliderInputRef.current!;
                    renderSlider(target, element);
                } else {
                    isVisible = false;
                }
            },
            { threshold: 0.1 }
        );

        if (sliderCanvasRef.current) {
            observer.observe(sliderCanvasRef.current);
            window.addEventListener("GUIScaleChange", (event): void => {
                if (!isVisible) return;
                const target: HTMLCanvasElement | null = sliderCanvasRef.current;
                const element: HTMLInputElement | null = sliderInputRef.current;
                if (target && element) {
                    renderSlider(target, element);
                }
            });
        }

        return (): void => {
            if (sliderInputRef.current) {
                if (options.onChange) {
                    sliderInputRef.current.removeEventListener("change", options.onChange);
                }
                sliderInputRef.current.removeEventListener("refreshSlider", onRefreshSliderCallback);
            }
            if (sliderCanvasRef.current) {
                observer.unobserve(sliderCanvasRef.current);
            }
        };
    }, []);
    return (
        <div class="mcslidercontainer nsel" onTouchStart={(): void => {}} style={{ display: "inline-block", width: "100%" }} data-slider-id={thisSliderID}>
            <label style={{ opacity: options.disabled ? "0.5" : "1" }}>
                {options.label}: {defaultValue}
            </label>
            <input
                title={options.title}
                type="range"
                data-value={defaultValue}
                data-precise-value={defaultValue}
                min={options.min ?? 0}
                max={options.max ?? 100}
                step={options.step ?? 1}
                disabled={options.disabled}
                onInput={options.onInput}
                style={{ display: "none" }}
                ref={options.inputRef ? mergeRefs(sliderInputRef, options.inputRef) : sliderInputRef}
            ></input>
            <br />
            <canvas
                class="mcslidercanvas"
                style={{ "vertical-align": "middle", width: "100%", height: "calc(16px * var(--gui-scale))", imageRendering: "pixelated" }}
                height="16"
                data-is-dragging={false}
                // onLoad={console.log}
                onTouchStart={(event: JSX.TargetedTouchEvent<HTMLCanvasElement>): void => {
                    if (sliderInputRef?.current?.disabled) return;
                    const GUIScale: number = event.currentTarget.clientHeight / 16;
                    const element: HTMLInputElement = event.currentTarget.parentElement!.children[1] as HTMLInputElement;
                    const min: number = Number(element.min);
                    const max: number = Number(element.max);
                    const step: number = Number(element.step);
                    const rect: DOMRect = event.currentTarget.getBoundingClientRect();
                    const x: number = event.touches[0]!.clientX - rect.left - 5 * GUIScale;
                    element.setAttribute(
                        "data-value",
                        (Math.round(Math.max(min, Math.min(max, (x / (rect.width - 10 * GUIScale)) * (max - min) + min)) / step) * step).toString()
                    );
                    element.setAttribute("data-precise-value", Math.max(min, Math.min(max, (x / (rect.width - 10 * GUIScale)) * (max - min) + min)).toString());
                    event.currentTarget.parentElement!.children[0]!.textContent = options.label + ": " + element.getAttribute("data-value");
                    event.currentTarget.setAttribute("data-is-dragging", "true");
                    if (currentMouseMoveListener) window.removeEventListener("mousemove", currentMouseMoveListener);
                    currentMouseMoveListener = mouseMoveListener.bind(event.currentTarget);
                    window.addEventListener("mousemove", currentMouseMoveListener);
                    if (currentMouseUpListener) window.removeEventListener("mouseup", currentMouseUpListener);
                    currentMouseUpListener = function mouseUpListener(this: HTMLCanvasElement): void {
                        this.setAttribute("data-is-dragging", "false");
                        if (currentMouseMoveListener) window.removeEventListener("mousemove", currentMouseMoveListener);
                        if (currentMouseUpListener) window.removeEventListener("mouseup", currentMouseUpListener);
                        element.dispatchEvent(new Event("input"));
                        element.dispatchEvent(new Event("change"));
                        renderSlider(this, element);
                    }.bind(event.currentTarget);
                    window.addEventListener("mouseup", currentMouseUpListener);
                    element.dispatchEvent(new Event("input"));
                    renderSlider(event.currentTarget, element);
                }}
                onMouseDown={(event: JSX.TargetedMouseEvent<HTMLCanvasElement>): void => {
                    if (sliderInputRef?.current?.disabled) return;
                    const GUIScale: number = event.currentTarget.clientHeight / 16;
                    const element: HTMLInputElement = event.currentTarget.parentElement!.children[1] as HTMLInputElement;
                    const min: number = Number(element.min);
                    const max: number = Number(element.max);
                    const step: number = Number(element.step);
                    const rect: DOMRect = event.currentTarget.getBoundingClientRect();
                    const x: number = event.clientX - rect.left - 5 * GUIScale;
                    element.setAttribute(
                        "data-value",
                        (Math.round(Math.max(min, Math.min(max, (x / (rect.width - 10 * GUIScale)) * (max - min) + min)) / step) * step).toString()
                    );
                    element.setAttribute("data-precise-value", Math.max(min, Math.min(max, (x / (rect.width - 10 * GUIScale)) * (max - min) + min)).toString());
                    event.currentTarget.parentElement!.children[0]!.textContent = options.label + ": " + element.getAttribute("data-value");
                    event.currentTarget.setAttribute("data-is-dragging", "true");
                    if (currentMouseMoveListener) window.removeEventListener("mousemove", currentMouseMoveListener);
                    currentMouseMoveListener = mouseMoveListener.bind(event.currentTarget);
                    window.addEventListener("mousemove", currentMouseMoveListener);
                    if (currentMouseUpListener) window.removeEventListener("mouseup", currentMouseUpListener);
                    currentMouseUpListener = function mouseUpListener(this: HTMLCanvasElement): void {
                        this.setAttribute("data-is-dragging", "false");
                        if (currentMouseMoveListener) window.removeEventListener("mousemove", currentMouseMoveListener);
                        if (currentMouseUpListener) window.removeEventListener("mouseup", currentMouseUpListener);
                        element.dispatchEvent(new Event("input"));
                        element.dispatchEvent(new Event("change"));
                        renderSlider(this, element);
                    }.bind(event.currentTarget);
                    window.addEventListener("mouseup", currentMouseUpListener);
                    element.dispatchEvent(new Event("input"));
                    renderSlider(event.currentTarget, element);
                }}
                onMouseOver={(event: JSX.TargetedMouseEvent<HTMLCanvasElement>): void => {
                    if (sliderInputRef?.current?.disabled) return;
                    event.currentTarget.setAttribute("data-is-hovering", "true");
                    renderSlider(event.currentTarget, event.currentTarget.parentElement!.children[1] as HTMLInputElement);
                }}
                onMouseOut={(event: JSX.TargetedMouseEvent<HTMLCanvasElement>): void => {
                    if (sliderInputRef?.current?.disabled && !event.currentTarget.getAttribute("data-is-dragging")) return;
                    event.currentTarget.setAttribute("data-is-hovering", "false");
                    renderSlider(event.currentTarget, event.currentTarget.parentElement!.children[1] as HTMLInputElement);
                }}
                ref={options.canvasRef ? mergeRefs(sliderCanvasRef, options.canvasRef) : sliderCanvasRef}
            ></canvas>
        </div>
    );
}

export interface SliderInnerHTMLInputElementEventMap extends HTMLElementEventMap {
    refreshSlider: undefined;
}

export interface SliderInnerHTMLInputElement extends HTMLInputElement {
    addEventListener<K extends keyof SliderInnerHTMLInputElementEventMap>(
        type: K,
        listener: (this: SliderInnerHTMLInputElement, ev: SliderInnerHTMLInputElementEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener<K extends keyof SliderInnerHTMLInputElementEventMap>(
        type: K,
        listener: (this: SliderInnerHTMLInputElement, ev: SliderInnerHTMLInputElementEventMap[K]) => any,
        options?: boolean | EventListenerOptions
    ): void;
}
