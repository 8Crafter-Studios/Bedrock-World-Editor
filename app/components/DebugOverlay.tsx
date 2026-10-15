import type { JSX, RefObject } from "preact";
import { hydrate, render, useEffect, useRef } from "preact/compat";
import { app } from "@electron/remote";
import os from "node:os";
import v8 from "node:v8";
// import { existsSync } from "node:fs";
import { MCEntryContentTypesGrouping, type MCDBEntryContentType, type MCEntryContentTypeGroup } from "mcbe-leveldb";
import { execSync } from "node:child_process";
import { createObservable, type Observable } from "../../src/utils/miscUtils";
import path from "node:path";
import { worldFolderLocationsCache } from "../app";

const FPS_SAMPLE_SIZE = 10;

export const currentFpsRaw: Observable<number> = createObservable(0);
export const currentFps: Observable<number> = createObservable(0);
let lastFrameTime: number = performance.now();
const frameTimes: number[] = [];

// let onFpsUpdate: (() => void) | undefined;

{
    function fpsLoop(): void {
        const now: number = performance.now();
        const delta: number = now - lastFrameTime;
        lastFrameTime = now;

        frameTimes.push(delta);
        if (frameTimes.length > FPS_SAMPLE_SIZE) {
            frameTimes.shift();
        }

        const avgDelta: number = frameTimes.reduce((a: number, b: number): number => a + b, 0) / frameTimes.length;
        const newFpsRaw: number = 1000 / avgDelta;
        const newFps: number = Number(newFpsRaw.toFixed(1));

        // Only trigger update if FPS changed
        if (newFps !== currentFps.get()) {
            currentFps.set(newFps);
            // onFpsUpdate?.();
        }
        if (newFpsRaw !== currentFpsRaw.get()) {
            currentFpsRaw.set(newFpsRaw);
        }

        requestAnimationFrame(fpsLoop);
    }
    fpsLoop();
}

function getCleanOSInfo(): string {
    const platform = os.platform();

    if (platform === "darwin") {
        const name: string = execSync("sw_vers -productName").toString().trim();
        const version: string = execSync("sw_vers -productVersion").toString().trim();
        const build: string = execSync("sw_vers -buildVersion").toString().trim();
        return `${name} ${version} (${build})`;
    }

    if (platform === "win32") {
        const name: string = os.version();
        const kernel: string = os.release();
        return `${name} ${kernel}`;
    }

    return `${platform} ${os.release()}`;
}

function cleanGPUString(raw: string): string {
    if (!raw) return "Unknown GPU";

    // ANGLE Metal (macOS)
    const metal: RegExpMatchArray | null = /Renderer:\s*([^,]+)/i.exec(raw);
    if (metal) return metal[1]!.trim();

    // ANGLE Direct3D (Windows)
    const d3d: RegExpMatchArray | null = /\(([^,]+),\s*([^()]+?)\s*(Direct3D|D3D)/i.exec(raw);
    if (d3d) return d3d[2]!.trim();

    // Mesa / Vulkan (Linux)
    const mesa: RegExpMatchArray | null = /^([^()]+)\s*\(/.exec(raw);
    if (mesa) return mesa[1]!.trim();

    // Fallback: strip parentheses and extra metadata
    return raw
        .replace(/\(.*?\)/g, "")
        .replace(/ANGLE/g, "")
        .replace(/Metal/g, "")
        .replace(/Renderer/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * A debug overlay.
 *
 * This is like the F3 screen in Minecraft Java Edition and the dev versions of Bedrock Edition.
 *
 * This should be directly inside the app element.
 *
 * @returns The debug overlay element.
 */
export default function DebugOverlay(): JSX.SpecificElement<"div"> {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    let currentDebugOverlayScrollTop: number = 0;
    const debugOverlayAbortController: AbortController = new AbortController();
    useEffect((): (() => void) => {
        if (!containerRef.current) throw new ReferenceError("containerRef.current is null");
        const lastObservedElementScrollHeights = new WeakMap<Element, number>();
        function debugHUDChangeCallback(mode: typeof config.debugHUD): void {
            if (!containerRef.current) return;
            mutationObserver.disconnect();
            render(null, containerRef.current);
            render(<DebugOverlayContents mode={mode} />, containerRef.current, (): void => {
                if (!containerRef.current) throw new ReferenceError("containerRef.current is null");
                containerRef.current.querySelectorAll("& > .scrollable-debug-overlay.debug-overlay-scroll-from-top").forEach((v: Element): void => {
                    if (lastObservedElementScrollHeights.get(v) === v.scrollHeight) return;
                    v.scrollTop = currentDebugOverlayScrollTop;
                    lastObservedElementScrollHeights.set(v, v.scrollHeight);
                });
                mutationObserver.observe(containerRef.current, { childList: true, subtree: true });
            });
        }
        window.addEventListener(
            "keydown",
            (event: KeyboardEvent): void => {
                if (event.key === "F3" && event.shiftKey) {
                    event.preventDefault();
                    currentDebugOverlayScrollTop = Math.max(0, currentDebugOverlayScrollTop - Math.min(50, innerHeight / 2));
                    containerRef.current?.querySelectorAll("& > .scrollable-debug-overlay.debug-overlay-scroll-from-top").forEach((v: Element): void => {
                        v.scrollTop = currentDebugOverlayScrollTop;
                    });
                } else if (event.key === "F4" && event.shiftKey) {
                    event.preventDefault();
                    currentDebugOverlayScrollTop = Math.min(
                        Math.max(...Array.from(containerRef.current!.children).map((v: Element): number => v.scrollHeight - v.clientHeight)),
                        Math.max(0, currentDebugOverlayScrollTop + Math.min(50, innerHeight / 2))
                    );
                    containerRef.current?.querySelectorAll("& > .scrollable-debug-overlay.debug-overlay-scroll-from-top").forEach((v: Element): void => {
                        v.scrollTop = currentDebugOverlayScrollTop;
                    });
                }
            },
            { signal: debugOverlayAbortController.signal }
        );

        const mutationObserver: MutationObserver = new MutationObserver((): void => {
            containerRef.current?.querySelectorAll("& > .scrollable-debug-overlay.debug-overlay-scroll-from-top").forEach((v: Element): void => {
                if (lastObservedElementScrollHeights.get(v) === v.scrollHeight) return;
                v.scrollTop = currentDebugOverlayScrollTop;
                lastObservedElementScrollHeights.set(v, v.scrollHeight);
            });
        });
        containerRef.current.querySelectorAll("& > .scrollable-debug-overlay.debug-overlay-scroll-from-top").forEach((v: Element): void => {
            lastObservedElementScrollHeights.set(v, v.scrollHeight);
        });
        mutationObserver.observe(containerRef.current, { childList: true, subtree: true });

        config.on("settingChanged:debugHUD", debugHUDChangeCallback);
        return (): void => {
            mutationObserver.disconnect();
            config.off("settingChanged:debugHUD", debugHUDChangeCallback);
            if (containerRef.current) render(null, containerRef.current);
        };
    }, []);
    return (
        <div style={{ display: "contents", fontFamily: "Minecraft-Seven-v2B", overflowWrap: "break-word" }} ref={containerRef}>
            <DebugOverlayContents mode={config.debugHUD} />
        </div>
    );
}

interface DebugOverlayContentsProps {
    mode: (typeof config)["debugHUD"];
}

function DebugOverlayContents(props: DebugOverlayContentsProps): JSX.Element {
    switch (props.mode) {
        case "top":
            return <DebugOverlay_Top />;
        case "basic":
            return <DebugOverlay_Basic />;
        case "config":
            return <DebugOverlay_Config />;
        case "config_views":
            return <DebugOverlay_Config_Views />;
        case "tab":
            return <DebugOverlay_Tab />;
        case "none":
        default:
            return <></>;
    }
}

/**
 * The top debug overlay mode.
 *
 * This is like the debug text at the top of the screen in the Bedrock Edition Preview.
 *
 * @returns The debug overlay element.
 */
function DebugOverlay_Top(): JSX.Element {
    const osInfo: string = getCleanOSInfo();
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    let process_memoryUsage: NodeJS.MemoryUsage = process.memoryUsage();
    let v8_heapStatistics: v8.HeapInfo = v8.getHeapStatistics();
    const osType: string = os.type();
    const osArch: string = os.arch();
    const localCurrentFps: Observable<number> = createObservable(currentFps.get());
    function Contents(): JSX.Element {
        return (
            <>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    v{VERSION_DISP_SHORT}
                    {process.env.NODE_ENV === "development" ? "*" : ""}{" "}
                    {osType === "Windows_NT" ?
                        "Windows"
                    : osType === "Darwin" ?
                        "macOS"
                    :   osType}{" "}
                    {osArch} Build, {osInfo}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    FPS:{/* currentFps */ localCurrentFps.get().toFixed(1)}, Mem:{Math.round(process_memoryUsage.heapUsed / 1000 ** 2)}, Free Mem:
                    {Math.round((v8_heapStatistics.heap_size_limit - process_memoryUsage.heapUsed) / 1000 ** 2)}
                </span>
            </>
        );
    }
    useEffect((): (() => void) => {
        if (containerRef.current) {
            hydrate(<Contents />, containerRef.current);
        }
        // function onFpsUpdate(): void {
        //     if (!containerRef.current) {
        //         clearInterval(intervalID);
        //         stopObservingFps();
        //         return;
        //     }
        //     hydrate(<Contents />, containerRef.current);
        // }
        // const stopObservingFps: () => boolean = currentFps.observe(onFpsUpdate);
        const intervalID: number = setInterval((): void => {
            if (!containerRef.current) {
                clearInterval(intervalID);
                clearInterval(intervalID_FPS);
                // stopObservingFps();
                return;
            }
            process_memoryUsage = process.memoryUsage();
            v8_heapStatistics = v8.getHeapStatistics();
            // hydrate(<Contents />, containerRef.current);
        }, 1000);
        const intervalID_FPS: number = setInterval((): void => {
            if (!containerRef.current) {
                clearInterval(intervalID);
                clearInterval(intervalID_FPS);
                return;
            }

            if (localCurrentFps.get() !== currentFps.get()) localCurrentFps.set(currentFps.get());
            hydrate(<Contents />, containerRef.current);
        }, 1000);

        return (): void => {
            clearInterval(intervalID);
            clearInterval(intervalID_FPS);
            // stopObservingFps();
        };
    });
    return (
        <>
            <style>{`.debug-overlay-top span {
    width: fit-content;
    /* transform: translate(calc((0.5 * (100vw - round(down, 100vw, 2px))) - calc((((round(up, var(--gui-scale), 2) / 2) - round(down, (round(up, var(--gui-scale), 2) / 2), 2)) - (((round(up, var(--gui-scale), 2) / 2) - round(up, (round(down, var(--gui-scale), 2) / 2), 2) - var(--w))) - 1) * 0.5px)), 0); */
}

@property --_x {
  syntax: "<number>";
  inherits: true;
  initial-value: 0; 
}
@property --_y {
  syntax: "<number>";
  inherits: true;
  initial-value: 0; 
}
@property --w {
  syntax: "<integer>";
  inherits: true;
  initial-value: 0; 
}
@property --h {
  syntax: "<integer>";
  inherits: true;
  initial-value: 0; 
}

.debug-overlay-top span {
  overflow: auto;
  scrollbar-width: none;
  position: relative;
  --w:calc(1/(1 - var(--_x)));
  --h:calc(1/(1 - var(--_y)));
  timeline-scope: --cx,--cy;
  animation: x linear,y linear;
  animation-timeline: --cx,--cy;
  animation-range: entry 100% exit 100%; 
  counter-reset: w var(--w) h var(--h);
  margin-left: calc(round(down, calc((100vw - var(--w) * 1px) / 2), 2px) - 0.5px + (((1 - (round(up, var(--gui-scale), 2) / 2) - round(down, (round(up, var(--gui-scale), 2) / 2), 2)) * 0.5px)));
  max-height: calc(var(--w) * 1px);
}
.debug-overlay-top span:before {
  content:"";
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  aspect-ratio: 1;
  view-timeline: --cx inline,--cy block;
}
@keyframes x {to{--_x:1}}
@keyframes y {to{--_y:1}}

/* .size:after {
  content: counter(w) "x" counter(h);
  counter-reset: w var(--w) h var(--h);
  position: absolute;
  left: 0;
  top: 0;
  background: #000;
  color: #fff;
  font-size: 23px;
  font-weight: bold;
  padding: .3em;
} */`}</style>
            <div
                class="nsel ndrg debug-overlay-top scrollable-debug-overlay debug-overlay-scroll-from-left debug-overlay-scroll-from-top"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    pointerEvents: "none",
                    zIndex: 1000000000000,
                    filter:
                        config.debugHUDDropShadow ?
                            "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF) drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)"
                        :   "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF)",
                    color: "rgba(255, 255, 255, 1)",
                    textAlign: "center",
                    fontSize: "calc((round(up, var(--gui-scale), 2) / 2) * 10px)",
                    overflow: "hidden",
                    letterSpacing: "calc((round(up, var(--gui-scale) - 2, 2) / 2) * 1px)",
                }}
                ref={containerRef}
            >
                <Contents />
            </div>
        </>
    );
}

interface GPUInfo {
    auxAttributes?: {
        amdSwitchable?: string;
        canSupportThreadedTextureMailbox?: string;
        directMLFeatureLevel?: string;
        displayType?: string;
        dx12FeatureLevel?: string;
        glExtensions?: string;
        glImplementationParts?: string;
        glRenderer?: string;
        glResetNotificationStrategy?: number;
        glVendor?: string;
        glVersion?: string;
        glWsExtensions?: string;
        glWsVendor?: string;
        glWsVersion?: string;
        hardwareSupportsVulkan?: boolean;
        inProcessGpu?: boolean;
        initializationTime?: number;
        isAsan?: boolean;
        isClangCoverage?: boolean;
        jpegDecodeAcceleratorSupported?: boolean;
        maxMsaaSamples?: string;
        optimus?: boolean;
        overlayInfo?: {
            bgra8OverlaySupport?: string;
            directComposition?: true;
            nv12OverlaySupport?: string;
            p010OverlaySupport?: string;
            rgb10a2OverlaySupport?: string;
            supportsOverlays?: boolean;
            yuy2OverlaySupport?: string;
        };
        passthroughCmdDecoder?: boolean;
        pixelShaderVersion?: string;
        sandboxed?: boolean;
        skiaBackendType?: string;
        subpixelFontRendering?: boolean;
        supportsD3dSharedImages?: boolean;
        supportsDirectML?: boolean;
        supportsDx12?: boolean;
        supportsVulkan?: boolean;
        targetCpuBits?: number;
        vertexShaderVersion?: string;
        videoDecodeAcceleratorSupportedProfile?: {
            encrypted_only?: boolean;
            maxResolutionHeight?: number;
            maxResolutionWidth?: number;
            minResolutionHeight?: number;
            minResolutionWidth?: number;
            profile?: number;
        };
        videoEncodeAcceleratorSupportedProfile?: {
            maxFramerateDenominator?: number;
            maxFramerateNumerator?: number;
            maxResolutionHeight?: number;
            maxResolutionWidth?: number;
            minResolutionHeight?: number;
            minResolutionWidth?: number;
            profile?: number;
        };
        visibilityCallbackCallCount?: number;
        vulkanVersion?: string;
    };
    gpuDevice?: {
        active?: boolean;
        deviceId?: number;
        vendorId?: number;
        deviceString?: string;
        driverVendor?: string;
        driverVersion?: string;
        gpuPreference?: number;
        revision?: number;
        subSysId?: number;
    }[];
    machineModelName?: string;
    machineModelVersion?: string;
}

let GPUInfo: GPUInfo | undefined;
void (app.getGPUInfo("complete") as Promise<GPUInfo>).then((gpuInfo: GPUInfo): void => {
    GPUInfo = gpuInfo;
});

/**
 * The top debug overlay mode.
 *
 * This is like the Basic debug HUD mode on the dev versions of Bedrock Edition.
 *
 * @returns The debug overlay element.
 */
function DebugOverlay_Basic(): JSX.Element {
    const osInfo: string = getCleanOSInfo();
    const rightContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    // await app.getGPUInfo("complete");
    // const currentWindow: Electron.BrowserWindow = getCurrentWindow();
    // IDEA: Add a Window ID line, and maybe lines for other currentWindow details too.
    function LeftContents(): JSX.Element {
        return (
            <>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    App v{VERSION_FULL}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    Env: {process.env.NODE_ENV === "development" ? "dev" : "prod"}
                </span>
                {/* <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    TZ: {-new Date().getTimezoneOffset() / 60}
                </span> */}
            </>
        );
    }
    let process_memoryUsage: NodeJS.MemoryUsage = process.memoryUsage();
    let v8_heapStatistics: v8.HeapInfo = v8.getHeapStatistics();
    let processUptime: number = Math.floor(process.uptime());
    let systemUptime: number = Math.floor(os.uptime());
    let cpus = os.cpus();
    const osArch = os.arch();
    const localCurrentFps: Observable<number> = createObservable(currentFps.get());
    function RightContents(): JSX.Element {
        return (
            <>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    OS: {osInfo}
                </span>
                {/* {<span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    {"v" + VERSION_FULL} {os.type() === "Windows_NT" ? "Windows" : os.type() === "Darwin" ? "macOS" : os.type()} {os.arch()} Build,
                </span>} */}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    Mem (Heap): {Math.round((process_memoryUsage.heapUsed / v8_heapStatistics.heap_size_limit) * 100)}%{" "}
                    {Math.round(process_memoryUsage.heapUsed / 1024 ** 2)}/{Math.round(v8_heapStatistics.heap_size_limit / 1024 ** 2)}MiB
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    Mem (Heap (Total)): {Math.round((process_memoryUsage.heapTotal / v8_heapStatistics.heap_size_limit) * 100)}%{" "}
                    {Math.round(process_memoryUsage.heapTotal / 1024 ** 2)}/{Math.round(v8_heapStatistics.heap_size_limit / 1024 ** 2)}MiB
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    Mem (RSS): {Math.round(process_memoryUsage.rss / 1024 ** 2)}MiB
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    CPU: {cpus.length}x {cpus[0] ? `${cpus[0].model} (${osArch})` : `Unknown (${osArch})`}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    &nbsp;
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    Display: {innerWidth}x{innerHeight}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    GPU:{" "}
                    {cleanGPUString(
                        GPUInfo?.gpuDevice?.find(
                            (gpuDevice: NonNullable<GPUInfo["gpuDevice"]>[number]): string | false | undefined => gpuDevice.active && gpuDevice.deviceString
                        )?.deviceString ?? "Unknown"
                    )}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    Process Uptime:{" "}
                    {Math.floor(processUptime / 60 / 60 / 24)
                        .toString()
                        .padStart(2, "0")}
                    :
                    {Math.floor((processUptime / 60 / 60) % 24)
                        .toString()
                        .padStart(2, "0")}
                    :
                    {Math.floor((processUptime / 60) % 60)
                        .toString()
                        .padStart(2, "0")}
                    :
                    {Math.floor(processUptime % 60)
                        .toString()
                        .padStart(2, "0")}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    System Uptime:{" "}
                    {Math.floor(systemUptime / 60 / 60 / 24)
                        .toString()
                        .padStart(2, "0")}
                    :
                    {Math.floor((systemUptime / 60 / 60) % 24)
                        .toString()
                        .padStart(2, "0")}
                    :
                    {Math.floor((systemUptime / 60) % 60)
                        .toString()
                        .padStart(2, "0")}
                    :
                    {Math.floor(systemUptime % 60)
                        .toString()
                        .padStart(2, "0")}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    Last FPS: {currentFps.get().toFixed(1)}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    FPS: {localCurrentFps.get().toFixed(1)}
                </span>
            </>
        );
    }
    useEffect((): (() => void) => {
        let lastForcedUpdate: number = Date.now();
        function handleWindowResize(): void {
            if (lastForcedUpdate + 100 < Date.now() && rightContainerRef.current) {
                render(<RightContents />, rightContainerRef.current);
                lastForcedUpdate = Date.now();
            }
        }
        window.addEventListener("resize", handleWindowResize);
        if (rightContainerRef.current) {
            render(<RightContents />, rightContainerRef.current);
        }
        function onFpsUpdate(): void {
            if (!rightContainerRef.current) {
                clearInterval(intervalID);
                stopObservingFps();
                return;
            }
            render(<RightContents />, rightContainerRef.current);
        }
        const stopObservingFps: () => boolean = currentFps.observe(onFpsUpdate);
        const intervalID: number = setInterval((): void => {
            if (!rightContainerRef.current) {
                clearInterval(intervalID);
                clearInterval(intervalID_FPS);
                stopObservingFps();
                return;
            }
            process_memoryUsage = process.memoryUsage();
            v8_heapStatistics = v8.getHeapStatistics();
            processUptime = Math.floor(process.uptime());
            systemUptime = Math.floor(os.uptime());
            cpus = os.cpus();
            // render(<RightContents />, rightContainerRef.current);
        }, 1000);
        const intervalID_FPS: number = setInterval((): void => {
            if (!rightContainerRef.current) {
                clearInterval(intervalID);
                clearInterval(intervalID_FPS);
                stopObservingFps();
                return;
            }

            if (localCurrentFps.get() !== currentFps.get()) localCurrentFps.set(currentFps.get());
            render(<RightContents />, rightContainerRef.current);
        }, 1000);
        return (): void => {
            window.removeEventListener("resize", handleWindowResize);
            clearInterval(intervalID);
            clearInterval(intervalID_FPS);
            stopObservingFps();
        };
    });
    return (
        <>
            {/* Left panel */}
            <div
                class="nsel ndrg scrollable-debug-overlay debug-overlay-scroll-from-left debug-overlay-scroll-from-top"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    position: "absolute",
                    top: 0,
                    left: "calc((round(up, var(--gui-scale), 2) / 2) * 1px)",
                    width: "calc(100vw - calc((round(up, var(--gui-scale), 2) / 2) * 1px))",
                    height: "100vh",
                    pointerEvents: "none",
                    zIndex: 1000000000000,
                    filter:
                        config.debugHUDDropShadow ?
                            "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF) drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)"
                        :   "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF)",
                    color: "#FFFFFFFF",
                    textAlign: "left",
                    fontSize: "calc((round(up, var(--gui-scale), 2) / 2) * 10px)",
                    // transform: "translate(calc((max(var(--gui-scale), 2) - round(down, max(var(--gui-scale), 2), 2)) * 0.5px), 0)",
                    overflow: "hidden",
                    letterSpacing: "calc((round(up, var(--gui-scale) - 2, 2) / 2) * 1px)",
                }}
                ref={rightContainerRef}
            >
                <LeftContents />
            </div>
            {/* Right panel */}
            <div
                class="nsel ndrg scrollable-debug-overlay debug-overlay-scroll-from-right debug-overlay-scroll-from-top"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    position: "absolute",
                    top: 0,
                    right: "calc((round(up, var(--gui-scale), 2) / 2) * 1px)",
                    width: "calc(100vw - calc((round(up, var(--gui-scale), 2) / 2) * 1px))",
                    height: "100vh",
                    pointerEvents: "none",
                    zIndex: 1000000000000,
                    filter:
                        config.debugHUDDropShadow ?
                            "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF) drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)"
                        :   "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF)",
                    color: "#FFFFFFFF",
                    textAlign: "right",
                    fontSize: "calc((round(up, var(--gui-scale), 2) / 2) * 10px)",
                    // transform: "translate(calc((max(var(--gui-scale), 2) - round(down, max(var(--gui-scale), 2), 2)) * 0.5px), 0)",
                    overflow: "hidden",
                    letterSpacing: "calc((round(up, var(--gui-scale) - 2, 2) / 2) * 1px)",
                }}
                ref={rightContainerRef}
            >
                <RightContents />
            </div>
        </>
    );
}

/**
 * The config debug overlay mode.
 *
 * This shows the first page of the config options.
 *
 * @returns The debug overlay element.
 */
function DebugOverlay_Config(): JSX.Element {
    const rightContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    function CrispyDropShadowSpan(props: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
        return (
            <span {...Object.fromEntries(Object.entries(props).filter(([key, _value]: [key: string, value: any]): boolean => key !== "children"))}>
                <span class="crispy cirspy-text-with-drop-shadow-inner-span">{props.children}</span>
            </span>
        );
    }
    function RightContents(): JSX.Element {
        const configData: ConfigJSON = config.getConfigData();
        // const parsedMinecraftDataFolders: string[] = worldFolderLocationsCache.cachedPaths.parsed;
        // const parsedExtraMinecraftDataFolders: string[] = worldFolderLocationsCache.cachedPaths.parsedExtra;
        // const existingMinecraftDataFolders: boolean[] = parsedMinecraftDataFolders.map((location: string): boolean => existsSync(location));
        // const existingExtraMinecraftDataFolders: boolean[] = parsedExtraMinecraftDataFolders.map((location: string): boolean => existsSync(location));
        return (
            <>
                {/* <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                        GUI Scale Modifier:{" "}
                    </CrispyDropShadowSpan>
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{JSONB.stringify(configData.GUIScale)}</CrispyDropShadowSpan>
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                        GUI Scale Override:{" "}
                    </CrispyDropShadowSpan>
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{JSONB.stringify(configData.GUIScaleOverride)}</CrispyDropShadowSpan>
                </span> */}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                        Attempt To Keep Current Config When Updating Version:{" "}
                    </CrispyDropShadowSpan>
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">
                        {JSONB.stringify(configData.attemptToKeepCurrentConfigWhenUpdatingVersion)}
                    </CrispyDropShadowSpan>
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                        Debug HUD:{" "}
                    </CrispyDropShadowSpan>
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{JSONB.stringify(configData.debugHUD)}</CrispyDropShadowSpan>
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                        Debug HUD Drop Shadow:{" "}
                    </CrispyDropShadowSpan>
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{JSONB.stringify(configData.debugHUDDropShadow)}</CrispyDropShadowSpan>
                </span>
                {/* <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                        Panorama:{" "}
                    </CrispyDropShadowSpan>
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{JSONB.stringify(configData.panorama)}</CrispyDropShadowSpan>
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                        Panorama Perspective:{" "}
                    </CrispyDropShadowSpan>
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{JSONB.stringify(configData.panoramaPerspective)}</CrispyDropShadowSpan>
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                        Panorama Rotate Direction:{" "}
                    </CrispyDropShadowSpan>
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">
                        {JSONB.stringify(configData.panoramaRotateDirection)}
                    </CrispyDropShadowSpan>
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                        Panorama Rotate Speed:{" "}
                    </CrispyDropShadowSpan>
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{JSONB.stringify(configData.panoramaRotateSpeed)}</CrispyDropShadowSpan>
                </span> */}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                        Theme:{" "}
                    </CrispyDropShadowSpan>
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{JSONB.stringify(configData.theme)}</CrispyDropShadowSpan>
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    &nbsp;
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#FFFF54FF">
                        Volume
                    </CrispyDropShadowSpan>
                </span>
                {volumeCategories.map(
                    (volumeCategory: (typeof volumeCategories)[number]): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                {volumeCategoryDisplayMapping[volumeCategory]}:{" "}
                            </CrispyDropShadowSpan>
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{configData.volume[volumeCategory]}%</CrispyDropShadowSpan>
                        </span>
                    )
                )}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    &nbsp;
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan
                        class="debug-overlay-config-mode-item-label"
                        data-color="#FFFF54FF"
                    >{`Minecraft Data Folders [${configData.minecraftDataFolders.length}]`}</CrispyDropShadowSpan>
                </span>
                {configData.minecraftDataFolders.map(
                    (location: string, _index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {/* TODO: Fix this to check correctly if it has any matches. */}
                            {
                                /* parsedMinecraftDataFolders[index] */ false ?
                                    /* existingMinecraftDataFolders[index] */ true ?
                                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                            [E]
                                        </CrispyDropShadowSpan>
                                    :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                            [X]
                                        </CrispyDropShadowSpan>

                                :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FFA854FF">
                                        [?]
                                    </CrispyDropShadowSpan>

                            }{" "}
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{`[${location}]`}</CrispyDropShadowSpan>
                        </span>
                    )
                )}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    &nbsp;
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan
                        class="debug-overlay-config-mode-item-label"
                        data-color="#FFFF54FF"
                    >{`Isolated Minecraft Worlds Folders [${configData.isolatedMinecraftWorldsFolders.length}]`}</CrispyDropShadowSpan>
                </span>
                {configData.isolatedMinecraftWorldsFolders.map(
                    (location: string, _index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {/* TODO: Fix this to check correctly if it has any matches. */}
                            {
                                /* parsedMinecraftDataFolders[index] */ false ?
                                    /* existingMinecraftDataFolders[index] */ true ?
                                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                            [E]
                                        </CrispyDropShadowSpan>
                                    :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                            [X]
                                        </CrispyDropShadowSpan>

                                :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FFA854FF">
                                        [?]
                                    </CrispyDropShadowSpan>

                            }{" "}
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{`[${location}]`}</CrispyDropShadowSpan>
                        </span>
                    )
                )}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    &nbsp;
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan
                        class="debug-overlay-config-mode-item-label"
                        data-color="#FFFF54FF"
                    >{`Extra Minecraft Data Folders [${configData.extraMinecraftDataFolders.length}]`}</CrispyDropShadowSpan>
                </span>
                {configData.extraMinecraftDataFolders.map(
                    (location: string, _index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {/* TODO: Fix this to check correctly if it has any matches. */}
                            {
                                /* parsedExtraMinecraftDataFolders[index] */ false ?
                                    /* existingExtraMinecraftDataFolders[index] */ true ?
                                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                            [E]
                                        </CrispyDropShadowSpan>
                                    :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                            [X]
                                        </CrispyDropShadowSpan>

                                :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FFA854FF">
                                        [?]
                                    </CrispyDropShadowSpan>

                            }{" "}
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{`[${location}]`}</CrispyDropShadowSpan>
                        </span>
                    )
                )}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    &nbsp;
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan
                        class="debug-overlay-config-mode-item-label"
                        data-color="#FFFF54FF"
                    >{`Extra Isolated Minecraft Worlds Folders [${configData.extraIsolatedMinecraftWorldsFolders.length}]`}</CrispyDropShadowSpan>
                </span>
                {configData.extraIsolatedMinecraftWorldsFolders.map(
                    (location: string, _index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {/* TODO: Fix this to check correctly if it has any matches. */}
                            {
                                /* parsedExtraMinecraftDataFolders[index] */ false ?
                                    /* existingExtraMinecraftDataFolders[index] */ true ?
                                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                            [E]
                                        </CrispyDropShadowSpan>
                                    :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                            [X]
                                        </CrispyDropShadowSpan>

                                :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FFA854FF">
                                        [?]
                                    </CrispyDropShadowSpan>

                            }{" "}
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{`[${location}]`}</CrispyDropShadowSpan>
                        </span>
                    )
                )}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    &nbsp;
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan
                        class="debug-overlay-config-mode-item-label"
                        data-color="#FFFF54FF"
                    >{`Parsed Minecraft Data Folders Cache [${worldFolderLocationsCache.cachedPaths.parsed.length}]`}</CrispyDropShadowSpan>
                </span>
                {worldFolderLocationsCache.cachedPaths.parsed.map(
                    (location: string, _index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {
                                /* existingMinecraftDataFolders[index] */ true ?
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                        [E]
                                    </CrispyDropShadowSpan>
                                :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                        [X]
                                    </CrispyDropShadowSpan>

                            }{" "}
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{`[${location}]`}</CrispyDropShadowSpan>
                        </span>
                    )
                )}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    &nbsp;
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan
                        class="debug-overlay-config-mode-item-label"
                        data-color="#FFFF54FF"
                    >{`Parsed Isolated Minecraft Worlds Folders Cache [${worldFolderLocationsCache.cachedPaths.parsedIsolated.length}]`}</CrispyDropShadowSpan>
                </span>
                {worldFolderLocationsCache.cachedPaths.parsedIsolated.map(
                    (location: string, _index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {
                                /* existingMinecraftDataFolders[index] */ true ?
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                        [E]
                                    </CrispyDropShadowSpan>
                                :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                        [X]
                                    </CrispyDropShadowSpan>

                            }{" "}
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{`[${location}]`}</CrispyDropShadowSpan>
                        </span>
                    )
                )}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    &nbsp;
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan
                        class="debug-overlay-config-mode-item-label"
                        data-color="#FFFF54FF"
                    >{`Parsed Extra Minecraft Data Folders Cache [${worldFolderLocationsCache.cachedPaths.parsedExtra.length}]`}</CrispyDropShadowSpan>
                </span>
                {worldFolderLocationsCache.cachedPaths.parsedExtra.map(
                    (location: string, _index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {
                                /* existingExtraMinecraftDataFolders[index] */ true ?
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                        [E]
                                    </CrispyDropShadowSpan>
                                :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                        [X]
                                    </CrispyDropShadowSpan>

                            }{" "}
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{`[${location}]`}</CrispyDropShadowSpan>
                        </span>
                    )
                )}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    &nbsp;
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan
                        class="debug-overlay-config-mode-item-label"
                        data-color="#FFFF54FF"
                    >{`Parsed Extra Isolated Minecraft Worlds Folders Cache [${worldFolderLocationsCache.cachedPaths.parsedExtraIsolated.length}]`}</CrispyDropShadowSpan>
                </span>
                {worldFolderLocationsCache.cachedPaths.parsedExtraIsolated.map(
                    (location: string, _index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {
                                /* existingExtraMinecraftDataFolders[index] */ true ?
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                        [E]
                                    </CrispyDropShadowSpan>
                                :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                        [X]
                                    </CrispyDropShadowSpan>

                            }{" "}
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{`[${location}]`}</CrispyDropShadowSpan>
                        </span>
                    )
                )}
            </>
        );
    }
    useEffect((): (() => void) => {
        let lastForcedUpdate: number = Date.now();
        function handleWindowResize(): void {
            if (lastForcedUpdate + 100 < Date.now() && rightContainerRef.current) {
                render(<RightContents />, rightContainerRef.current);
                lastForcedUpdate = Date.now();
            }
        }
        window.addEventListener("resize", handleWindowResize);
        if (rightContainerRef.current) {
            render(<RightContents />, rightContainerRef.current);
        }
        const intervalID: number = setInterval((): void => {
            if (!rightContainerRef.current) {
                clearInterval(intervalID);
                return;
            }
            render(<RightContents />, rightContainerRef.current);
        }, 1000);
        return (): void => {
            window.removeEventListener("resize", handleWindowResize);
            clearInterval(intervalID);
        };
    });
    return (
        <>
            <style>{`.debug-overlay-config-mode {
    & span:not(.cirspy-text-with-drop-shadow-inner-span)[data-color]:not(:has(span:not(.cirspy-text-with-drop-shadow-inner-span))) {
        color: attr(data-color type(<color>));
        filter: drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 rgba(from attr(data-color type(<color>)) calc(r * 0.25) calc(g * 0.25) calc(b * 0.25) / 1));
    }
    & span:not(.cirspy-text-with-drop-shadow-inner-span):not([data-color]):not(:has(span:not(.cirspy-text-with-drop-shadow-inner-span))) {
        filter: drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF);
    }
}`}</style>
            {/* Right panel */}
            <div
                class="nsel ndrg debug-overlay-config-mode debug-overlay-right scrollable-debug-overlay debug-overlay-scroll-from-right debug-overlay-scroll-from-top"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    position: "absolute",
                    top: 0,
                    right: "calc((round(up, var(--gui-scale), 2) / 2) * 1px)",
                    width: "calc(100vw - calc((round(up, var(--gui-scale), 2) / 2) * 1px))",
                    height: "100vh",
                    pointerEvents: "none",
                    zIndex: 1000000000000,
                    filter: config.debugHUDDropShadow ? "drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)" : "",
                    color: "#FFFFFFFF",
                    textAlign: "right",
                    fontSize: "calc((round(up, var(--gui-scale), 2) / 2) * 10px)",
                    // transform: "translate(calc((max(var(--gui-scale), 2) - round(down, max(var(--gui-scale), 2), 2)) * 0.5px), 0)",
                    overflow: "hidden",
                    letterSpacing: "calc((round(up, var(--gui-scale) - 2, 2) / 2) * 1px)",
                }}
                ref={rightContainerRef}
            >
                <RightContents />
            </div>
        </>
    );
}

/**
 * The config debug overlay mode (views).
 *
 * This shows the first page of the config options.
 *
 * @returns The debug overlay element.
 */
function DebugOverlay_Config_Views(): JSX.Element {
    const rightContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    function CrispyDropShadowSpan(props: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
        return (
            <span {...Object.fromEntries(Object.entries(props).filter(([key, _value]: [key: string, value: any]): boolean => key !== "children"))}>
                <span class="crispy cirspy-text-with-drop-shadow-inner-span">{props.children}</span>
            </span>
        );
    }
    function RightContents(): JSX.Element {
        return (
            <>
                {(Object.keys(config.views) as (keyof typeof subConfigKeyStructure.views)[]).map(
                    (view: keyof typeof subConfigKeyStructure.views): JSX.Element => {
                        const viewSettings = config.views[view];
                        const modeSettings = viewSettings.modeSettings as UnionToIntersection<typeof viewSettings.modeSettings>;
                        return (
                            <>
                                <span
                                    class="crispy"
                                    style={{
                                        display: "block",
                                    }}
                                >
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#FFFF54FF">
                                        Views - {view}:
                                    </CrispyDropShadowSpan>
                                </span>
                                {(Object.keys(viewSettings.modeSettings) as (keyof typeof modeSettings)[])
                                    .filter(
                                        (key: keyof typeof modeSettings): key is Exclude<keyof typeof modeSettings, number | symbol> => typeof key === "string"
                                    )
                                    .map((modeSetting: Exclude<keyof typeof modeSettings, number | symbol>): JSX.Element => {
                                        return (
                                            <>
                                                {"columns" in modeSettings[modeSetting] && modeSettings[modeSetting].columns && (
                                                    <span
                                                        class="crispy"
                                                        style={{
                                                            display: "block",
                                                        }}
                                                    >
                                                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                                            Columns:{" "}
                                                        </CrispyDropShadowSpan>
                                                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">
                                                            {JSONB.stringify(modeSettings[modeSetting].columns)}
                                                        </CrispyDropShadowSpan>
                                                    </span>
                                                )}
                                                {"sections" in modeSettings[modeSetting] &&
                                                    modeSettings[modeSetting].sections &&
                                                    (
                                                        Object.entries(
                                                            (modeSettings[modeSetting] as Extract<(typeof modeSettings)[typeof modeSetting], { sections: any }>)
                                                                .sections
                                                        ) as [
                                                            KeysOfUnion<Extract<(typeof modeSettings)[typeof modeSetting], { sections: any }>["sections"]>,
                                                            UnionToIntersection<
                                                                Extract<(typeof modeSettings)[typeof modeSetting], { sections: any }>["sections"]
                                                            >[KeysOfUnion<Extract<(typeof modeSettings)[typeof modeSetting], { sections: any }>["sections"]>],
                                                        ][]
                                                    ).map(([key, value]): JSX.Element => {
                                                        return (
                                                            <span
                                                                class="crispy"
                                                                style={{
                                                                    display: "block",
                                                                }}
                                                            >
                                                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#5555FFFF">
                                                                    {key} -{" "}
                                                                </CrispyDropShadowSpan>
                                                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                                                    Columns:{" "}
                                                                </CrispyDropShadowSpan>
                                                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">
                                                                    {JSONB.stringify(value.columns)}
                                                                </CrispyDropShadowSpan>
                                                            </span>
                                                        );
                                                    })}
                                            </>
                                        );
                                    })}
                                <span
                                    class="crispy"
                                    style={{
                                        display: "block",
                                    }}
                                >
                                    &nbsp;
                                </span>
                            </>
                        );
                    }
                )}
            </>
        );
    }
    useEffect((): (() => void) => {
        if (rightContainerRef.current) {
            render(<RightContents />, rightContainerRef.current);
        }
        const intervalID: number = setInterval((): void => {
            if (!rightContainerRef.current) {
                clearInterval(intervalID);
                return;
            }
            render(<RightContents />, rightContainerRef.current);
        }, 1000);
        return (): void => {
            clearInterval(intervalID);
        };
    });
    return (
        <>
            <style>{`.debug-overlay-config-mode {
    & span:not(.cirspy-text-with-drop-shadow-inner-span)[data-color]:not(:has(span:not(.cirspy-text-with-drop-shadow-inner-span))) {
        color: attr(data-color type(<color>));
        filter: drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 rgba(from attr(data-color type(<color>)) calc(r * 0.25) calc(g * 0.25) calc(b * 0.25) / 1));
    }
    & span:not(.cirspy-text-with-drop-shadow-inner-span):not([data-color]):not(:has(span:not(.cirspy-text-with-drop-shadow-inner-span))) {
        filter: drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF);
    }
}`}</style>
            {/* Right panel */}
            <div
                class="nsel ndrg debug-overlay-config-mode debug-overlay-right scrollable-debug-overlay debug-overlay-scroll-from-right debug-overlay-scroll-from-top"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    position: "absolute",
                    top: 0,
                    right: "calc((round(up, var(--gui-scale), 2) / 2) * 1px)",
                    width: "calc(100vw - calc((round(up, var(--gui-scale), 2) / 2) * 1px))",
                    height: "100vh",
                    pointerEvents: "none",
                    zIndex: 1000000000000,
                    filter: config.debugHUDDropShadow ? "drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)" : "",
                    color: "#FFFFFFFF",
                    textAlign: "right",
                    fontSize: "calc((round(up, var(--gui-scale), 2) / 2) * 10px)",
                    // transform: "translate(calc((max(var(--gui-scale), 2) - round(down, max(var(--gui-scale), 2), 2)) * 0.5px), 0)",
                    overflow: "hidden",
                    letterSpacing: "calc((round(up, var(--gui-scale) - 2, 2) / 2) * 1px)",
                }}
                ref={rightContainerRef}
            >
                <RightContents />
            </div>
        </>
    );
}

/**
 * The tab debug overlay mode.
 *
 * This shows debug information about the current tab.
 *
 * @returns The debug overlay element.
 */
function DebugOverlay_Tab(): JSX.Element {
    const formatter = new Intl.NumberFormat();
    const rightContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const currentWindowId: number = getCurrentWindow().id;
    function CrispyDropShadowSpan(props: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
        return (
            <span {...Object.fromEntries(Object.entries(props).filter(([key, _value]: [key: string, value: any]): boolean => key !== "children"))}>
                <span class="crispy cirspy-text-with-drop-shadow-inner-span">{props.children}</span>
            </span>
        );
    }
    function LeftContents(): JSX.Element {
        return (
            <>
                {/* <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    App v{VERSION_FULL}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    Env: {process.env.NODE_ENV === "development" ? "dev" : "prod"}
                </span> */}
            </>
        );
    }
    function RightContents(): JSX.Element {
        const tab = tabManager.selectedTab;
        return (
            <>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                        Tab Name:{" "}
                    </CrispyDropShadowSpan>
                    {tab instanceof TabManagerTab ?
                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{tab.name}</CrispyDropShadowSpan>
                    : tab ?
                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{tab}</CrispyDropShadowSpan>
                    :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5555FF">
                            null
                        </CrispyDropShadowSpan>
                    }
                </span>
                {tab && tab instanceof TabManagerTab ?
                    <>
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                Tab Mode:{" "}
                            </CrispyDropShadowSpan>
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{tab.mode}</CrispyDropShadowSpan>
                        </span>
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                Temp Folder:{" "}
                            </CrispyDropShadowSpan>
                            {tab.tempPath !== undefined ?
                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{path.basename(tab.tempPath)}</CrispyDropShadowSpan>
                            :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5555FF">
                                    null
                                </CrispyDropShadowSpan>
                            }
                        </span>
                        {/* <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                Path:{" "}
                            </CrispyDropShadowSpan>
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{tab.path}</CrispyDropShadowSpan>
                        </span>
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                Temp Path:{" "}
                            </CrispyDropShadowSpan>
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{tab.tempPath}</CrispyDropShadowSpan>
                        </span>
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                Temp File Path:{" "}
                            </CrispyDropShadowSpan>
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{tab.tempFilePath}</CrispyDropShadowSpan>
                        </span> */}
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                DB Status:{" "}
                            </CrispyDropShadowSpan>
                            {tab.db ?
                                tab.db.isOpen() ?
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#55FF55FF">
                                        open
                                    </CrispyDropShadowSpan>
                                :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5555FF">
                                        closed
                                        {"errorOnDBOpen" in tab ?
                                            "errorDueToEncryptedLevelDB" in tab && tab.errorDueToEncryptedLevelDB ?
                                                " (encrypted)"
                                            :   " (ERROR)"
                                        :   ""}
                                    </CrispyDropShadowSpan>

                            : tab.awaitDBOpen ?
                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FFFF55FF">
                                    loading
                                </CrispyDropShadowSpan>
                            :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5555FF">
                                    undefined
                                </CrispyDropShadowSpan>
                            }
                        </span>
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                Tab ID:{" "}
                            </CrispyDropShadowSpan>
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">
                                {currentWindowId}-{tab.id}
                            </CrispyDropShadowSpan>
                        </span>
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            &nbsp;
                        </span>
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            &nbsp;
                        </span>
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            &nbsp;
                        </span>
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#FFFF54FF">{`Cached DB Keys${
                                tab.cachedDBKeys ?
                                    ` [${formatter.format(Object.values(tab.cachedDBKeys).reduce((a: number, b: Buffer[] | undefined): number => a + (b?.length ?? 0), 0))}]`
                                : tab.loadedCachedDBKeysProgress ? ` [${formatter.format(tab.loadedCachedDBKeysProgress)}?]`
                                : ""
                            }`}</CrispyDropShadowSpan>
                        </span>
                        {tab.cachedDBKeys ?
                            Object.entries(
                                Object.entries(tab.cachedDBKeys)
                                    .map(([k, v]): [key: string, value: number] => [k, v.length])
                                    .reduce((p: Partial<Record<MCEntryContentTypeGroup, number>>, [k, v]) => {
                                        const group: MCEntryContentTypeGroup =
                                            MCEntryContentTypesGrouping[k as MCDBEntryContentType] ?? (k as MCEntryContentTypeGroup);
                                        if (p[group] !== undefined) {
                                            p[group] += v;
                                        } else {
                                            p[group] = v;
                                        }
                                        return p;
                                    }, {})
                            ).map(
                                ([key, value]: [key: string, value: number | undefined]): JSX.Element => (
                                    <span
                                        class="crispy"
                                        style={{
                                            display: "block",
                                        }}
                                    >
                                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                            {key}:{" "}
                                        </CrispyDropShadowSpan>
                                        {value !== undefined ?
                                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#55FF55FF">
                                                {formatter.format(value)}
                                            </CrispyDropShadowSpan>
                                        :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5555FF">
                                                undefined
                                            </CrispyDropShadowSpan>
                                        }
                                    </span>
                                )
                            )
                        : tab.awaitCachedDBKeys ?
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FFFF55FF">
                                loading
                            </CrispyDropShadowSpan>
                        :   <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5555FF">
                                undefined
                            </CrispyDropShadowSpan>
                        }
                    </>
                :   <>
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                Window ID:{" "}
                            </CrispyDropShadowSpan>
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{currentWindowId}</CrispyDropShadowSpan>
                        </span>
                    </>
                }
            </>
        );
    }
    useEffect((): (() => void) => {
        if (rightContainerRef.current) {
            render(<RightContents />, rightContainerRef.current);
        }
        const intervalID: number = setInterval((): void => {
            if (!rightContainerRef.current) {
                clearInterval(intervalID);
                return;
            }
            render(<RightContents />, rightContainerRef.current);
        }, 250);
        return (): void => {
            clearInterval(intervalID);
        };
    });
    return (
        <>
            <style>{`.debug-overlay-tab-mode {
    & span:not(.cirspy-text-with-drop-shadow-inner-span)[data-color]:not(:has(span:not(.cirspy-text-with-drop-shadow-inner-span))) {
        color: attr(data-color type(<color>));
        filter: drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 rgba(from attr(data-color type(<color>)) calc(r * 0.25) calc(g * 0.25) calc(b * 0.25) / 1));
    }
    & span:not(.cirspy-text-with-drop-shadow-inner-span):not([data-color]):not(:has(span:not(.cirspy-text-with-drop-shadow-inner-span))) {
        filter: drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF);
    }
}`}</style>
            {/* Left panel */}
            <div
                class="nsel ndrg debug-overlay-tab-mode scrollable-debug-overlay debug-overlay-scroll-from-left debug-overlay-scroll-from-top"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    position: "absolute",
                    top: 0,
                    left: "calc((round(up, var(--gui-scale), 2) / 2) * 1px)",
                    width: "calc(100vw - calc((round(up, var(--gui-scale), 2) / 2) * 1px))",
                    height: "100vh",
                    pointerEvents: "none",
                    zIndex: 1000000000000,
                    filter: config.debugHUDDropShadow ? "drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)" : "",
                    color: "#FFFFFFFF",
                    textAlign: "left",
                    fontSize: "calc((round(up, var(--gui-scale), 2) / 2) * 10px)",
                    // transform: "translate(calc((max(var(--gui-scale), 2) - round(down, max(var(--gui-scale), 2), 2)) * 0.5px), 0)",
                    overflow: "hidden",
                    letterSpacing: "calc((round(up, var(--gui-scale) - 2, 2) / 2) * 1px)",
                }}
                ref={rightContainerRef}
            >
                <LeftContents />
            </div>
            {/* Right panel */}
            <div
                class="nsel ndrg debug-overlay-tab-mode scrollable-debug-overlay debug-overlay-scroll-from-right debug-overlay-scroll-from-top"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    position: "absolute",
                    top: 0,
                    right: "calc((round(up, var(--gui-scale), 2) / 2) * 1px)",
                    width: "calc(100vw - calc((round(up, var(--gui-scale), 2) / 2) * 1px))",
                    height: "100vh",
                    pointerEvents: "none",
                    zIndex: 1000000000000,
                    filter: config.debugHUDDropShadow ? "drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)" : "",
                    color: "#FFFFFFFF",
                    textAlign: "right",
                    fontSize: "calc((round(up, var(--gui-scale), 2) / 2) * 10px)",
                    // transform: "translate(calc((max(var(--gui-scale), 2) - round(down, max(var(--gui-scale), 2), 2)) * 0.5px), 0)",
                    overflow: "hidden",
                    letterSpacing: "calc((round(up, var(--gui-scale) - 2, 2) / 2) * 1px)",
                }}
                ref={rightContainerRef}
            >
                <RightContents />
            </div>
        </>
    );
}

if (config.enablePerfGraphs) {
    function togglePerfGraphDebugOverlay(graph: "FPS" | "ELL" | "FCD"): void {
        const element: HTMLElement | null = document.getElementById(`perfGraph_${graph}_container`);
        if (!element) throw new ReferenceError(`perfGraph_${graph}_container not found`);
        if (element.style.display === "none") {
            element.style.display = "block";
            localStorage.setItem(`perfGraph_${graph}_visible`, "true");
        } else {
            element.style.display = "none";
            localStorage.removeItem(`perfGraph_${graph}_visible`);
        }
    }

    /**
     * The currently held keys.
     *
     * This is used for the small corner debug overlay (`CTRL+I`).
     */
    let heldKeys: string[] = [];

    /**
     * @type {number[]}
     */
    let heldKeyCodes: number[] = [];

    const types_KeyboardKey = {
        8: "BACKSPACE",
        9: "TAB",
        13: "ENTER",
        16: "SHIFT",
        17: "CTRL",
        18: "ALT",
        20: "CAPS_LOCK",
        27: "ESCAPE",
        32: "SPACE",
        33: "PG_UP",
        34: "PG_DOWN",
        35: "END",
        37: "LEFT",
        38: "UP",
        39: "RIGHT",
        40: "DOWN",
        45: "INSERT",
        46: "DELETE",
        48: "KEY_0",
        49: "KEY_1",
        50: "KEY_2",
        51: "KEY_3",
        52: "KEY_4",
        53: "KEY_5",
        54: "KEY_6",
        55: "KEY_7",
        56: "KEY_8",
        57: "KEY_9",
        59: "SEMICOLON",
        61: "EQUALS",
        65: "KEY_A",
        66: "KEY_B",
        67: "KEY_C",
        68: "KEY_D",
        69: "KEY_E",
        70: "KEY_F",
        71: "KEY_G",
        72: "KEY_H",
        73: "KEY_I",
        74: "KEY_J",
        75: "KEY_K",
        76: "KEY_L",
        77: "KEY_M",
        78: "KEY_N",
        79: "KEY_O",
        80: "KEY_P",
        81: "KEY_Q",
        82: "KEY_R",
        83: "KEY_S",
        84: "KEY_T",
        85: "KEY_U",
        86: "KEY_V",
        87: "KEY_W",
        88: "KEY_X",
        89: "KEY_Y",
        90: "KEY_Z",
        96: "NUMPAD_0",
        97: "NUMPAD_1",
        98: "NUMPAD_2",
        99: "NUMPAD_3",
        100: "NUMPAD_4",
        101: "NUMPAD_5",
        102: "NUMPAD_6",
        103: "NUMPAD_7",
        104: "NUMPAD_8",
        105: "NUMPAD_9",
        109: "MINUS",
        112: "F1",
        113: "F2",
        114: "F3",
        115: "F4",
        116: "F5",
        117: "F6",
        118: "F7",
        119: "F8",
        120: "F9",
        121: "F10",
        122: "F11",
        123: "F12",
        188: "COMMA",
        190: "PERIOD",
        191: "SLASH",
        192: "GRAVE",
        195: "MOUSE_MOVEMENT",
        196: "MOUSE_BUTTON_LEFT",
        197: "MOUSE_BUTTON_MIDDLE",
        198: "MOUSE_BUTTON_RIGHT",
        199: "MOUSE_WHEEL",
        201: "PSEUDO_KEY_1",
        202: "PSEUDO_KEY_2",
        203: "PSEUDO_KEY_3",
        204: "PSEUDO_KEY_4",
        205: "PSEUDO_KEY_5",
        206: "PSEUDO_KEY_6",
        207: "PSEUDO_KEY_7",
        208: "PSEUDO_KEY_8",
        209: "PSEUDO_KEY_9",
        210: "PSEUDO_KEY_10",
        219: "BRACKET_OPEN",
        220: "BACKSLASH",
        221: "BRACKET_CLOSE",
        222: "APOSTROPHE",
        BACKSPACE: 8,
        TAB: 9,
        ENTER: 13,
        SHIFT: 16,
        CTRL: 17,
        ALT: 18,
        PAUSE: 19,
        CAPS_LOCK: 20,
        ESCAPE: 27,
        SPACE: 32,
        PG_UP: 33,
        PG_DOWN: 34,
        END: 35,
        HOME: 36,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        INSERT: 45,
        DELETE: 46,
        KEY_0: 48,
        KEY_1: 49,
        KEY_2: 50,
        KEY_3: 51,
        KEY_4: 52,
        KEY_5: 53,
        KEY_6: 54,
        KEY_7: 55,
        KEY_8: 56,
        KEY_9: 57,
        // SEMICOLON: 59, // Not the actual semicolon key.
        // EQUALS: 61, // Not the actual equal sign key.
        KEY_A: 65,
        KEY_B: 66,
        KEY_C: 67,
        KEY_D: 68,
        KEY_E: 69,
        KEY_F: 70,
        KEY_G: 71,
        KEY_H: 72,
        KEY_I: 73,
        KEY_J: 74,
        KEY_K: 75,
        KEY_L: 76,
        KEY_M: 77,
        KEY_N: 78,
        KEY_O: 79,
        KEY_P: 80,
        KEY_Q: 81,
        KEY_R: 82,
        KEY_S: 83,
        KEY_T: 84,
        KEY_U: 85,
        KEY_V: 86,
        KEY_W: 87,
        KEY_X: 88,
        KEY_Y: 89,
        KEY_Z: 90,
        META_LFET: 91,
        CONTEXT_MENU: 93,
        NUMPAD_0: 96,
        NUMPAD_1: 97,
        NUMPAD_2: 98,
        NUMPAD_3: 99,
        NUMPAD_4: 100,
        NUMPAD_5: 101,
        NUMPAD_6: 102,
        NUMPAD_7: 103,
        NUMPAD_8: 104,
        NUMPAD_9: 105,
        NUMPAD_MULTIPLY: 106,
        NUMPAD_PLUS: 107,
        // NUMPAD_ENTER: 108, // Not supported, it just maps to regular ENTER.
        NUMPAD_MINUS: 109,
        NUMPAD_PERIOD: 110,
        NUMPAD_DIVIDE: 111,
        F1: 112,
        F2: 113,
        F3: 114,
        F4: 115,
        F5: 116,
        F6: 117,
        F7: 118,
        F8: 119,
        F9: 120,
        F10: 121,
        F11: 122,
        F12: 123,
        F13: 124,
        F14: 125,
        F15: 126,
        F16: 127,
        F17: 128,
        F18: 129,
        F19: 130,
        F20: 131,
        F21: 132,
        F22: 133,
        F23: 134,
        F24: 135,
        NUM_LOCK: 144,
        SCROLL_LOCK: 145,
        SEMICOLON: 186,
        EQUALS: 187,
        COMMA: 188,
        MINUS: 189,
        PERIOD: 190,
        SLASH: 191,
        GRAVE: 192,
        MOUSE_MOVEMENT: 195,
        MOUSE_BUTTON_LEFT: 196,
        MOUSE_BUTTON_MIDDLE: 197,
        MOUSE_BUTTON_RIGHT: 198,
        MOUSE_WHEEL: 199,
        PSEUDO_KEY_1: 201,
        PSEUDO_KEY_2: 202,
        PSEUDO_KEY_3: 203,
        PSEUDO_KEY_4: 204,
        PSEUDO_KEY_5: 205,
        PSEUDO_KEY_6: 206,
        PSEUDO_KEY_7: 207,
        PSEUDO_KEY_8: 208,
        PSEUDO_KEY_9: 209,
        PSEUDO_KEY_10: 210,
        BRACKET_OPEN: 219,
        BACKSLASH: 220,
        BRACKET_CLOSE: 221,
        APOSTROPHE: 222,
        INTL_BACKSLASH: 226,
        KANA_MODE: 246,
        CR_SEL: 247,
        EX_SEL: 248,
        ERASE_EOF: 249,
    } as const;

    const useAppleShortcuts: boolean = process.platform === "darwin";

    window.addEventListener("keydown", function __OUIC_keyboardShortcutHandler_keyDown__(event: KeyboardEvent): void {
        heldKeys = [...heldKeys.filter((key) => key !== event.code), event.code];
        heldKeyCodes = [...heldKeyCodes.filter((key) => key !== event.keyCode), event.keyCode];
        if (
            event.keyCode === types_KeyboardKey.KEY_2 &&
            (useAppleShortcuts ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
            !event.altKey &&
            !event.shiftKey &&
            heldKeyCodes.includes(types_KeyboardKey.F3)
        ) {
            togglePerfGraphDebugOverlay("FPS");
        } else if (
            event.keyCode === types_KeyboardKey.KEY_3 &&
            (useAppleShortcuts ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
            !event.altKey &&
            !event.shiftKey &&
            heldKeyCodes.includes(types_KeyboardKey.F3)
        ) {
            togglePerfGraphDebugOverlay("ELL");
        } else if (
            event.keyCode === types_KeyboardKey.KEY_4 &&
            (useAppleShortcuts ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
            !event.altKey &&
            !event.shiftKey &&
            heldKeyCodes.includes(types_KeyboardKey.F3)
        ) {
            togglePerfGraphDebugOverlay("FCD");
        }
    });

    window.addEventListener("keyup", (event) => {
        heldKeys = heldKeys.filter((key) => key !== event.code);
        heldKeyCodes = heldKeyCodes.filter((key) => key !== event.keyCode);
    });

    const /* let */ changingPerfGraphScale = false;
    const /* let */ changingPerfGraphScaleB = false;
    const /* let */ changingPerfGraphScaleLastId = -1;
    const /* let */ perfGraphScale = Math.ceil(Math.max(1, 2 /* guiScaleBase + guiScaleModifier */) / 1.5);

    void changingPerfGraphScale;
    void changingPerfGraphScaleB;
    void changingPerfGraphScaleLastId;

    {
        // Lagometer, accessed with F3+2.
        const perfGraphOverlay_FPS = document.createElement("div");
        perfGraphOverlay_FPS.id = "perfGraph_FPS_container";
        perfGraphOverlay_FPS.classList.add("perfGraphContainer");
        perfGraphOverlay_FPS.setAttribute(
            "style",
            `pointer-events: none; background-color: #00000000; color: #FFFFFFFF; width: auto; height: auto; position: fixed; bottom: 0; left: 0; z-index: 90000000; white-space: pre-wrap; overflow-wrap: anywhere;`
        );
        // TODO: Make the height of this based on the screen so that the bar can extend to the top of the screen.
        const baseSize: [width: number, height: number] = [242, 201];
        perfGraphOverlay_FPS.style.width = `${baseSize[0] * perfGraphScale}px`;
        perfGraphOverlay_FPS.style.height = `${baseSize[1] * perfGraphScale}px`;
        perfGraphOverlay_FPS.setAttribute("data-base-width", String(baseSize[0]));
        perfGraphOverlay_FPS.setAttribute("data-base-height", String(baseSize[1]));
        perfGraphOverlay_FPS.style.setProperty("--current-width", `${baseSize[0] * perfGraphScale}px`);
        perfGraphOverlay_FPS.style.setProperty("--current-height", `${baseSize[1] * perfGraphScale}px`);
        perfGraphOverlay_FPS.innerHTML = `<canvas id="perfGraph_FPS" class="perfGraph" style="position: absolute; top: 0; left: 0; z-index: 1;" data-base-width="${baseSize[0]}" data-base-height="${baseSize[1] - 1}" width="${baseSize[0] * perfGraphScale}" height="${(baseSize[1] - 1) * perfGraphScale}"></canvas>
<!-- To make this identical to Java Edition, make the overlay the same height as the graph (the one pixel difference is so the bottom pixel of the bars isn't covered up by the border). -->
<canvas id="perfGraph_FPS_overlay" class="perfGraph crispy" style="position: absolute; top: 0; left: 0; z-index: 2;" data-base-width="${baseSize[0]}" data-base-height="${baseSize[1]}" width="${baseSize[0] * perfGraphScale}" height="${baseSize[1] * perfGraphScale}"></canvas>`;
        if (localStorage.getItem("perfGraph_FPS_visible") !== "true") perfGraphOverlay_FPS.style.display = "none";
        document.body.appendChild(perfGraphOverlay_FPS);
    }

    {
        // Event Loop Lagometer, accessed with F3+3.
        const perfGraphOverlay_ELL = document.createElement("div");
        perfGraphOverlay_ELL.id = "perfGraph_ELL_container";
        perfGraphOverlay_ELL.classList.add("perfGraphContainer");
        perfGraphOverlay_ELL.setAttribute(
            "style",
            `pointer-events: none; background-color: #00000000; color: #FFFFFFFF; width: auto; height: auto; position: fixed; bottom: 0; right: 0; z-index: 90000000; white-space: pre-wrap; overflow-wrap: anywhere;`
        );
        // TODO: Make the height of this based on the screen so that the bar can extend to the top of the screen.
        const baseSize: [width: number, height: number] = [242, 201];
        perfGraphOverlay_ELL.style.width = `${baseSize[0] * perfGraphScale}px`;
        perfGraphOverlay_ELL.style.height = `${baseSize[1] * perfGraphScale}px`;
        perfGraphOverlay_ELL.setAttribute("data-base-width", String(baseSize[0]));
        perfGraphOverlay_ELL.setAttribute("data-base-height", String(baseSize[1]));
        perfGraphOverlay_ELL.style.setProperty("--current-width", `${baseSize[0] * perfGraphScale}px`);
        perfGraphOverlay_ELL.style.setProperty("--current-height", `${baseSize[1] * perfGraphScale}px`);
        perfGraphOverlay_ELL.innerHTML = `<canvas id="perfGraph_ELL" class="perfGraph" style="position: absolute; top: 0; left: 0; z-index: 1;" data-base-width="${baseSize[0]}" data-base-height="${baseSize[1] - 1}" width="${baseSize[0] * perfGraphScale}" height="${(baseSize[1] - 1) * perfGraphScale}"></canvas>
<canvas id="perfGraph_ELL_overlay" class="perfGraph crispy" style="position: absolute; top: 0; left: 0; z-index: 2;" data-base-width="${baseSize[0]}" data-base-height="${baseSize[1]}" width="${baseSize[0] * perfGraphScale}" height="${baseSize[1] * perfGraphScale}"></canvas>`;
        if (localStorage.getItem("perfGraph_ELL_visible") !== "true") perfGraphOverlay_ELL.style.display = "none";
        document.body.appendChild(perfGraphOverlay_ELL);
    }

    {
        // Frame Callback Delay Graph, accessed with F3+3.
        const perfGraphOverlay_FCD = document.createElement("div");
        perfGraphOverlay_FCD.id = "perfGraph_FCD_container";
        perfGraphOverlay_FCD.classList.add("perfGraphContainer");
        perfGraphOverlay_FCD.setAttribute(
            "style",
            `pointer-events: none; background-color: #00000000; color: #FFFFFFFF; width: auto; height: auto; position: fixed; bottom: 0; left: calc(50vw - (var(--current-width) / 2)); z-index: 90000000; white-space: pre-wrap; overflow-wrap: anywhere;`
        );
        // TODO: Make the height of this based on the screen so that the bar can extend to the top of the screen.
        const baseSize: [width: number, height: number] = [242, 201];
        perfGraphOverlay_FCD.style.width = `${baseSize[0] * perfGraphScale}px`;
        perfGraphOverlay_FCD.style.height = `${baseSize[1] * perfGraphScale}px`;
        perfGraphOverlay_FCD.setAttribute("data-base-width", String(baseSize[0]));
        perfGraphOverlay_FCD.setAttribute("data-base-height", String(baseSize[1]));
        perfGraphOverlay_FCD.style.setProperty("--current-width", `${baseSize[0] * perfGraphScale}px`);
        perfGraphOverlay_FCD.style.setProperty("--current-height", `${baseSize[1] * perfGraphScale}px`);
        perfGraphOverlay_FCD.innerHTML = `<canvas id="perfGraph_FCD" class="perfGraph" style="position: absolute; top: 0; left: 0; z-index: 1;" data-base-width="${baseSize[0]}" data-base-height="${baseSize[1] - 1}" width="${baseSize[0] * perfGraphScale}" height="${(baseSize[1] - 1) * perfGraphScale}"></canvas>
<canvas id="perfGraph_FCD_overlay" class="perfGraph crispy" style="position: absolute; top: 0; left: 0; z-index: 2;" data-base-width="${baseSize[0]}" data-base-height="${baseSize[1]}" width="${baseSize[0] * perfGraphScale}" height="${baseSize[1] * perfGraphScale}"></canvas>`;
        if (localStorage.getItem("perfGraph_FCD_visible") !== "true") perfGraphOverlay_FCD.style.display = "none";
        document.body.appendChild(perfGraphOverlay_FCD);
    }

    canvasInit: {
        const canvas_FPS_container: HTMLElement | null = document.getElementById("perfGraph_FPS_container");
        const canvas_FPS: HTMLElement | null = document.getElementById("perfGraph_FPS");
        const canvas_FPS_overlay: HTMLElement | null = document.getElementById("perfGraph_FPS_overlay");
        const canvas_ELL_container: HTMLElement | null = document.getElementById("perfGraph_ELL_container");
        const canvas_ELL: HTMLElement | null = document.getElementById("perfGraph_ELL");
        const canvas_ELL_overlay: HTMLElement | null = document.getElementById("perfGraph_ELL_overlay");
        const canvas_FCD_container: HTMLElement | null = document.getElementById("perfGraph_FCD_container");
        const canvas_FCD: HTMLElement | null = document.getElementById("perfGraph_FCD");
        const canvas_FCD_overlay: HTMLElement | null = document.getElementById("perfGraph_FCD_overlay");
        if (!(canvas_FPS instanceof HTMLCanvasElement)) {
            console.error('Canvas with id "perfGraph_FPS" was not found.');
            break canvasInit;
        }
        if (!(canvas_FPS_overlay instanceof HTMLCanvasElement)) {
            console.error('Canvas with id "perfGraph_FPS_overlay" was not found.');
            break canvasInit;
        }
        if (!(canvas_ELL instanceof HTMLCanvasElement)) {
            console.error('Canvas with id "perfGraph_ELL" was not found.');
            break canvasInit;
        }
        if (!(canvas_ELL_overlay instanceof HTMLCanvasElement)) {
            console.error('Canvas with id "perfGraph_ELL_overlay" was not found.');
            break canvasInit;
        }
        if (!(canvas_FCD instanceof HTMLCanvasElement)) {
            console.error('Canvas with id "perfGraph_FCD" was not found.');
            break canvasInit;
        }
        if (!(canvas_FCD_overlay instanceof HTMLCanvasElement)) {
            console.error('Canvas with id "perfGraph_FCD_overlay" was not found.');
            break canvasInit;
        }
        const ctx_FPS: CanvasRenderingContext2D = canvas_FPS.getContext("2d")!;
        const ctx_FPS_overlay: CanvasRenderingContext2D = canvas_FPS_overlay.getContext("2d")!;
        const ctx_ELL: CanvasRenderingContext2D = canvas_ELL.getContext("2d")!;
        const ctx_ELL_overlay: CanvasRenderingContext2D = canvas_ELL_overlay.getContext("2d")!;
        const ctx_FCD: CanvasRenderingContext2D = canvas_FCD.getContext("2d")!;
        const ctx_FCD_overlay: CanvasRenderingContext2D = canvas_FCD_overlay.getContext("2d")!;

        // const width = canvas_FPS.width;
        // const height = canvas_FPS.height;

        // type ELLStatus = "Excellent" | "Good" | "Stressed" | "Critical" | "Loading..." | "N/A";

        // let ell = 0;
        // let ellStatus: ELLStatus = "Loading..."; // Thread Responsiveness (TR);

        // FPS monitor.
        const startFPSMonitor = function startFPSMonitor(onSample?: (frameTime: number) => void): () => number {
            let lastFrame: DOMHighResTimeStamp = performance.now();
            let frameTime = 0;
            function tick(time: DOMHighResTimeStamp): void {
                frameTime = time - lastFrame;
                lastFrame = time;
                onSample?.(frameTime);
                requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
            return (): number => frameTime;
        };

        // Event Loop Lag monitor.
        const startJsLagMonitor = function startJsLagMonitor(interval: number | (() => number) = 5, onSample?: (ell: number) => void): () => number {
            let last: number = performance.now();
            let lag = 0;
            let lastInterval: number = typeof interval === "number" ? interval : interval();

            function tick(): void {
                const now: number = performance.now();
                const delta: number = now - Math.max(lastAnimationFrameTime /* lastAnimationFrameCallbackTime */, last);
                lag = Math.max(0, delta /* - lastInterval */);

                onSample?.(lag); // draw a bar for THIS sample

                last = now;
                setTimeout(tick, (lastInterval = typeof interval === "number" ? interval : interval()));
            }

            setTimeout(tick, lastInterval);
            return (): number => lag;
        };

        let lastAnimationFrameTime: DOMHighResTimeStamp = performance.now();
        let lastAnimationFrameCallbackTime: DOMHighResTimeStamp = lastAnimationFrameTime;
        void lastAnimationFrameTime;
        void lastAnimationFrameCallbackTime;

        // Frame Callback Delay monitor.
        const startFCDMonitor = function startFCDMonitor(onSample?: (delay: number) => void): () => number {
            let delay = 0;

            function tick(time: DOMHighResTimeStamp): void {
                const now: DOMHighResTimeStamp = performance.now();
                delay = now - time;
                lastAnimationFrameTime = time;
                lastAnimationFrameCallbackTime = now;
                onSample?.(delay);
                requestAnimationFrame(tick);
            }

            requestAnimationFrame(tick);
            return (): number => delay;
        };

        let bufferCanvas_FPS: HTMLCanvasElement = document.createElement("canvas");
        bufferCanvas_FPS.width = canvas_FPS.width;
        bufferCanvas_FPS.height = canvas_FPS.height;
        let bufferCtx_FPS: CanvasRenderingContext2D = bufferCanvas_FPS.getContext("2d")!;

        let bufferCanvas_ELL: HTMLCanvasElement = document.createElement("canvas");
        bufferCanvas_ELL.width = canvas_ELL.width;
        bufferCanvas_ELL.height = canvas_ELL.height;
        let bufferCtx_ELL: CanvasRenderingContext2D = bufferCanvas_ELL.getContext("2d")!;

        let bufferCanvas_FCD: HTMLCanvasElement = document.createElement("canvas");
        bufferCanvas_FCD.width = canvas_FCD.width;
        bufferCanvas_FCD.height = canvas_FCD.height;
        let bufferCtx_FCD: CanvasRenderingContext2D = bufferCanvas_FCD.getContext("2d")!;

        const graphFrameTimeValues: number[] = [];

        const getFpsColor = function getFpsColor(ms: number): string {
            const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
            const t = clamp(ms / 100, 0, 1);

            let r: number, g: number;

            if (t < 0.3) {
                // Green to Yellow
                r = (t / 0.3) * 255;
                g = 255;
            } else {
                // Yellow to Red
                r = 255;
                g = 255 - ((t - 0.3) / 0.7) * 255;
            }

            return `rgb(${Math.round(r)},${Math.round(g)},0)`;
        };

        const maxFrameRate = NaN;

        const fpsGraphDrawQueue: number[] = [];

        /**
         * 1 ms on the FPS graph is this many pixels.
         */
        const FPS_GRAPH_SCALE = 1.8;

        // ctx_FPS.imageSmoothingEnabled = false;
        // ctx_FPS_overlay.imageSmoothingEnabled = false;
        // ctx_ELL.imageSmoothingEnabled = false;
        // ctx_ELL_overlay.imageSmoothingEnabled = false;
        // ctx_FCD.imageSmoothingEnabled = false;
        // ctx_FCD_overlay.imageSmoothingEnabled = false;

        // ctx_FPS.fontKerning = "none";
        // ctx_FPS_overlay.fontKerning = "none";
        // ctx_ELL.fontKerning = "none";
        // ctx_ELL_overlay.fontKerning = "none";
        // ctx_FCD.fontKerning = "none";
        // ctx_FCD_overlay.fontKerning = "none";

        // ctx_FPS.fontStretch = "normal";
        // ctx_FPS_overlay.fontStretch = "normal";
        // ctx_ELL.fontStretch = "normal";
        // ctx_ELL_overlay.fontStretch = "normal";
        // ctx_FCD.fontStretch = "normal";
        // ctx_FCD_overlay.fontStretch = "normal";

        const TEXT_X_SHIFT = 0;
        const TEXT_Y_SHIFT = -8;

        const drawFpsGraph = function drawFpsGraph(frameTime: number | readonly number[], bypassChangeScaleWait = false): void {
            if (frameTime instanceof Array && frameTime.length === 0) return;
            if (!bypassChangeScaleWait && changingPerfGraphScale) {
                return void fpsGraphDrawQueue.push(...(typeof frameTime === "number" ? [frameTime] : frameTime));
            }
            const RENDERED_SCALE: number = perfGraphScale;
            const w: number = canvas_FPS.width / RENDERED_SCALE;
            const h: number = canvas_FPS.height / RENDERED_SCALE;
            // const wO: number = canvas_FPS_overlay.width / RENDERED_SCALE;
            const hO: number = canvas_FPS_overlay.height / RENDERED_SCALE;
            if (!bypassChangeScaleWait) {
                if (fpsGraphDrawQueue.length > 0) {
                    frameTime = [...fpsGraphDrawQueue, ...(typeof frameTime === "number" ? [frameTime] : frameTime)];
                    fpsGraphDrawQueue.length = 0;
                    graphFrameTimeValues.push(...frameTime);
                    graphFrameTimeValues.splice(0, Math.max(0, graphFrameTimeValues.length - (w - 2)));
                } else {
                    graphFrameTimeValues.push(...(typeof frameTime === "number" ? [frameTime] : frameTime));
                    graphFrameTimeValues.splice(0, Math.max(0, graphFrameTimeValues.length - (w - 2)));
                }
            }
            if (frameTime instanceof Array && frameTime.length > w - 2) frameTime = frameTime.slice(-w + 2);
            if (bufferCanvas_FPS.width !== canvas_FPS.width || bufferCanvas_FPS.height !== canvas_FPS.height) {
                bufferCtx_FPS.clearRect(0, 0, bufferCanvas_FPS.width, bufferCanvas_FPS.height);
                bufferCanvas_FPS = document.createElement("canvas");
                bufferCanvas_FPS.width = canvas_FPS.width;
                bufferCanvas_FPS.height = canvas_FPS.height;
                bufferCtx_FPS = bufferCanvas_FPS.getContext("2d")!;
            }
            ctx_FPS.setTransform(1, 0, 0, 1, 0, 0);
            ctx_FPS_overlay.setTransform(1, 0, 0, 1, 0, 0);
            ctx_FPS_overlay.scale(RENDERED_SCALE, RENDERED_SCALE);

            const currentFrameTime: number = typeof frameTime === "number" ? frameTime : frameTime.at(-1)!;

            const fps: number = 1000 / currentFrameTime;

            const newBarCount: number = typeof frameTime === "number" ? 1 : frameTime.length;

            bufferCtx_FPS.clearRect(0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE);

            // Adds the translucent background to the graph when it is first rendered.
            if (graphFrameTimeValues.length === 1 && w > 3) {
                // bufferCtx_FPS.setTransform(1, 0, 0, 1, 0, 0);
                ctx_FPS.clearRect(0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE); // Clear canvas to remove the data from the last time the page was loaded.
                bufferCtx_FPS.fillStyle = "#ffffff24";
                bufferCtx_FPS.fillRect(1 * RENDERED_SCALE, (h - 60) * RENDERED_SCALE, (w - 2) * RENDERED_SCALE, 60 * RENDERED_SCALE);
                // bufferCtx_FPS.scale(RENDERED_SCALE, RENDERED_SCALE);
            } else {
                bufferCtx_FPS.drawImage(canvas_FPS, 0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE, 0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE);
            }

            ctx_FPS.clearRect(1 * RENDERED_SCALE, 0, (w - 2 - newBarCount) * RENDERED_SCALE, h * RENDERED_SCALE);
            ctx_FPS.drawImage(
                bufferCanvas_FPS,
                (1 + newBarCount) * RENDERED_SCALE,
                0,
                (w - 2 - newBarCount) * RENDERED_SCALE,
                h * RENDERED_SCALE,
                1 * RENDERED_SCALE,
                0,
                (w - 2 - newBarCount) * RENDERED_SCALE,
                h * RENDERED_SCALE
            );
            ctx_FPS.scale(RENDERED_SCALE, RENDERED_SCALE);
            ctx_FPS.clearRect(w - 1 - newBarCount, 0, newBarCount, h);

            ctx_FPS.fillStyle = "#ffffff24";
            ctx_FPS.fillRect(w - 1 - newBarCount, h - 60, newBarCount, 60);

            frameTime = typeof frameTime === "number" ? [frameTime] : frameTime;
            for (let i = 0; i < frameTime.length; i++) {
                const frameTimeValue: number | undefined = frameTime[i];
                if (typeof frameTimeValue !== "number") continue;
                // const barHeight = Math.floor(frametime * graphScale); // Floored version that is identical to Java Edition.
                const barHeight: number = frameTimeValue * FPS_GRAPH_SCALE;
                ctx_FPS.fillStyle = getFpsColor(frameTimeValue);
                ctx_FPS.fillRect(w - 1 - frameTime.length + i, h - barHeight, 1, barHeight);
            }

            ctx_FPS_overlay.clearRect(0, 0, w, h);

            // ctx_FPS_overlay.strokeStyle = "#888";
            ctx_FPS_overlay.strokeStyle = "#fff";
            ctx_FPS_overlay.beginPath();
            ctx_FPS_overlay.moveTo(0, hO - 0.5);
            ctx_FPS_overlay.lineTo(w, hO - 0.5);
            ctx_FPS_overlay.moveTo(0, h - 29.5 /* (1000 / 60 / maxMs) * h */);
            ctx_FPS_overlay.lineTo(w, h - 29.5 /* (1000 / 60 / maxMs) * h */);
            ctx_FPS_overlay.moveTo(0, h - 59.5 /* (1000 / 30 / maxMs) * h */);
            ctx_FPS_overlay.lineTo(w, h - 59.5 /* (1000 / 30 / maxMs) * h */);
            ctx_FPS_overlay.moveTo(0.5, h - 60);
            ctx_FPS_overlay.lineTo(0.5, hO);
            ctx_FPS_overlay.moveTo(w - 0.5, h - 60);
            ctx_FPS_overlay.lineTo(w - 0.5, hO);
            ctx_FPS_overlay.stroke();

            if (Number.isFinite(maxFrameRate)) {
                ctx_FPS_overlay.strokeStyle = "#0ff";
                const barPosition: number = (1000 / maxFrameRate) * FPS_GRAPH_SCALE;
                ctx_FPS_overlay.beginPath();
                ctx_FPS_overlay.moveTo(0, h - barPosition + 0.5);
                ctx_FPS_overlay.lineTo(w, h - barPosition + 0.5);
                ctx_FPS_overlay.stroke();
            }

            const minFrameTimeValue: number = Math.min(...graphFrameTimeValues);
            const avgFrameTimeValue: number = graphFrameTimeValues.reduce((a: number, b: number): number => a + b, 0) / graphFrameTimeValues.length;
            const maxFrameTimeValue: number = Math.max(...graphFrameTimeValues);

            // ---- Text Drawing ----

            // Clear scaling.
            ctx_FPS.setTransform(1, 0, 0, 1, 0, 0);
            ctx_FPS_overlay.setTransform(1, 0, 0, 1, 0, 0);

            ctx_FPS_overlay.font = `${10 * RENDERED_SCALE}px "Minecraft-Seven-v2B"`;
            ctx_FPS_overlay.letterSpacing = "1px";
            ctx_FPS_overlay.textBaseline = "top";
            const statText_FPS = `FPS: ${fps.toFixed(1).padStart(6, " ")}`;
            const statText_FT = `FT: ${currentFrameTime.toFixed(1)} ms`;
            // Draw text shadow.
            ctx_FPS_overlay.fillStyle = "#373737";
            ctx_FPS_overlay.fillText(statText_FPS, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 96) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FPS_overlay.fillText(statText_FT, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 86) * RENDERED_SCALE + TEXT_Y_SHIFT);
            // Draw text.
            ctx_FPS_overlay.fillStyle = "#fff";
            ctx_FPS_overlay.fillText(statText_FPS, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 97) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FPS_overlay.fillText(statText_FT, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 87) * RENDERED_SCALE + TEXT_Y_SHIFT);

            ctx_FPS_overlay.fillStyle = "#ffffff13";
            ctx_FPS_overlay.fillRect(
                1 * RENDERED_SCALE,
                (h - 29) * RENDERED_SCALE,
                ctx_FPS_overlay.measureText("60 FPS").width + 2 * RENDERED_SCALE,
                9 * RENDERED_SCALE
            );
            ctx_FPS_overlay.fillRect(
                1 * RENDERED_SCALE,
                (h - 59) * RENDERED_SCALE,
                ctx_FPS_overlay.measureText("30 FPS").width + 2 * RENDERED_SCALE,
                9 * RENDERED_SCALE
            );
            ctx_FPS_overlay.fillStyle = "#fff";
            ctx_FPS_overlay.fillText("60 FPS", 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 26) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FPS_overlay.fillText("30 FPS", 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 56) * RENDERED_SCALE + TEXT_Y_SHIFT);

            const minMSText = `${minFrameTimeValue.toFixed(1)} ms min`;
            const avgMSText = `${avgFrameTimeValue.toFixed(1)} ms avg`;
            const maxMSText = `${maxFrameTimeValue.toFixed(1)} ms max`;
            const avgMSSize: number = ctx_FPS_overlay.measureText(avgMSText).width / RENDERED_SCALE + 1;
            const maxMSSize: number = ctx_FPS_overlay.measureText(maxMSText).width / RENDERED_SCALE + 1;
            const minFPSText = `${(1000 / maxFrameTimeValue).toFixed(1).replace("Infinity", "∞")} FPS min`;
            const avgFPSText = `${(1000 / avgFrameTimeValue).toFixed(1).replace("Infinity", "∞")} FPS avg`;
            const maxFPSText = `${(1000 / minFrameTimeValue).toFixed(1).replace("Infinity", "∞")} FPS max`;
            const avgFPSSize: number = ctx_FPS_overlay.measureText(avgFPSText).width / RENDERED_SCALE + 1;
            const maxFPSSize: number = ctx_FPS_overlay.measureText(maxFPSText).width / RENDERED_SCALE + 1;
            // Draw text shadow.
            ctx_FPS_overlay.fillStyle = "#373737";
            ctx_FPS_overlay.fillText(minMSText, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 66) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FPS_overlay.fillText(
                avgMSText,
                (Math.floor((w - avgMSSize) / 2) + 1) * RENDERED_SCALE + TEXT_X_SHIFT,
                (h - 66) * RENDERED_SCALE + TEXT_Y_SHIFT
            );
            ctx_FPS_overlay.fillText(maxMSText, (w - maxMSSize) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 66) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FPS_overlay.fillText(minFPSText, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 76) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FPS_overlay.fillText(
                avgFPSText,
                (Math.floor((w - avgFPSSize) / 2) + 1) * RENDERED_SCALE + TEXT_X_SHIFT,
                (h - 76) * RENDERED_SCALE + TEXT_Y_SHIFT
            );
            ctx_FPS_overlay.fillText(maxFPSText, (w - maxFPSSize) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 76) * RENDERED_SCALE + TEXT_Y_SHIFT);
            // Draw text.
            ctx_FPS_overlay.fillStyle = "#fff";
            ctx_FPS_overlay.fillText(minMSText, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 67) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FPS_overlay.fillText(avgMSText, Math.floor((w - avgMSSize) / 2) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 67) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FPS_overlay.fillText(maxMSText, (w - 1 - maxMSSize) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 67) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FPS_overlay.fillText(minFPSText, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 77) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FPS_overlay.fillText(avgFPSText, Math.floor((w - avgFPSSize) / 2) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 77) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FPS_overlay.fillText(maxFPSText, (w - 1 - maxFPSSize) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 77) * RENDERED_SCALE + TEXT_Y_SHIFT);
        };

        const graphEllValues: number[] = [];

        const getEllColor = function getEllColor(ms: number): string {
            const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
            const t = clamp(ms / 50, 0, 1);

            let r: number, g: number;

            if (t < 0.3) {
                // Green to Yellow
                r = (t / 0.3) * 255;
                g = 255;
            } else {
                // Yellow to Red
                r = 255;
                g = 255 - ((t - 0.3) / 0.7) * 255;
            }

            return `rgb(${Math.round(r)},${Math.round(g)},0)`;
        };

        const ellGraphDrawQueue: number[] = [];

        /**
         * 1 ms on the ELL graph is this many pixels.
         */
        const ELL_GRAPH_SCALE = 1;

        /**
         * The list of times to use to determine the positions to put the bars at in the ELL graph.
         *
         * Should be in descending order for optimal performance.
         */
        const ELL_GRAPH_HORIZONTAL_BAR_TIMES: readonly number[] = Object.freeze([15, 6, 2].map((v: number): number => Math.round(v * ELL_GRAPH_SCALE)));

        const drawEllGraph = function drawEllGraph(ell: number | readonly number[], bypassChangeScaleWait = false): void {
            if (ell instanceof Array && ell.length === 0) return;
            if (!bypassChangeScaleWait && changingPerfGraphScale) {
                return void ellGraphDrawQueue.push(...(typeof ell === "number" ? [ell] : ell));
            }
            const RENDERED_SCALE: number = perfGraphScale;
            const w: number = canvas_ELL.width / RENDERED_SCALE;
            const h: number = canvas_ELL.height / RENDERED_SCALE;
            // const wO = canvas_ELL_overlay.width / RENDERED_SCALE;
            const hO: number = canvas_ELL_overlay.height / RENDERED_SCALE;
            if (!bypassChangeScaleWait) {
                if (ellGraphDrawQueue.length > 0) {
                    ell = [...ellGraphDrawQueue, ...(typeof ell === "number" ? [ell] : ell)];
                    ellGraphDrawQueue.length = 0;
                    graphEllValues.push(...ell);
                    graphEllValues.splice(0, Math.max(0, graphEllValues.length - (w - 2)));
                } else {
                    graphEllValues.push(...(typeof ell === "number" ? [ell] : ell));
                    graphEllValues.splice(0, Math.max(0, graphEllValues.length - (w - 2)));
                }
            }
            if (ell instanceof Array && ell.length > w - 2) ell = ell.slice(-w + 2);
            if (bufferCanvas_ELL.width !== canvas_ELL.width || bufferCanvas_ELL.height !== canvas_ELL.height) {
                bufferCtx_ELL.clearRect(0, 0, bufferCanvas_ELL.width, bufferCanvas_ELL.height);
                bufferCanvas_ELL = document.createElement("canvas");
                bufferCanvas_ELL.width = canvas_ELL.width;
                bufferCanvas_ELL.height = canvas_ELL.height;
                bufferCtx_ELL = bufferCanvas_ELL.getContext("2d")!;
            }
            ctx_ELL.setTransform(1, 0, 0, 1, 0, 0);
            ctx_ELL_overlay.setTransform(1, 0, 0, 1, 0, 0);
            ctx_ELL_overlay.scale(RENDERED_SCALE, RENDERED_SCALE);

            const newBarCount: number = typeof ell === "number" ? 1 : ell.length;

            bufferCtx_ELL.clearRect(0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE);

            // Adds the translucent background to the graph when it is first rendered.
            if (graphEllValues.length === 1 && w > 3) {
                ctx_ELL.clearRect(0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE); // Clear canvas to remove the data from the last time the page was loaded.
                bufferCtx_ELL.fillStyle = "#ffffff24";
                bufferCtx_ELL.fillRect(1 * RENDERED_SCALE, (h - 60) * RENDERED_SCALE, (w - 2) * RENDERED_SCALE, 60 * RENDERED_SCALE);

                // Draw the horizontal background bars.
                bufferCtx_ELL.scale(RENDERED_SCALE, RENDERED_SCALE);
                bufferCtx_ELL.strokeStyle = "#444";
                bufferCtx_ELL.beginPath();
                for (const barPosition of ELL_GRAPH_HORIZONTAL_BAR_TIMES) {
                    bufferCtx_ELL.moveTo(0, h - barPosition + 0.5);
                    bufferCtx_ELL.lineTo(w, h - barPosition + 0.5);
                }
                bufferCtx_ELL.stroke();
                bufferCtx_ELL.setTransform(1, 0, 0, 1, 0, 0);
            } else {
                bufferCtx_ELL.drawImage(canvas_ELL, 0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE, 0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE);
            }

            ctx_ELL.clearRect(1 * RENDERED_SCALE, 0, (w - 2 - newBarCount) * RENDERED_SCALE, h * RENDERED_SCALE);
            ctx_ELL.drawImage(
                bufferCanvas_ELL,
                (1 + newBarCount) * RENDERED_SCALE,
                0,
                (w - 2 - newBarCount) * RENDERED_SCALE,
                h * RENDERED_SCALE,
                1 * RENDERED_SCALE,
                0,
                (w - 2 - newBarCount) * RENDERED_SCALE,
                h * RENDERED_SCALE
            );
            ctx_ELL.scale(RENDERED_SCALE, RENDERED_SCALE);
            ctx_ELL.clearRect(w - 1 - newBarCount, 0, newBarCount, h);

            // Adds the translucent background to the graph.
            ctx_ELL.fillStyle = "#ffffff24";
            ctx_ELL.fillRect(w - 1 - newBarCount, h - 60, newBarCount, 60);

            ell = typeof ell === "number" ? [ell] : ell;
            for (let i = 0; i < ell.length; i++) {
                const ellValue: number | undefined = ell[i];
                if (typeof ellValue !== "number") continue;
                // const barHeight = Math.floor(ell * graphScale); // Floored version that is identical to Java Edition.
                const barHeight: number = ellValue * ELL_GRAPH_SCALE;

                // Draw the horizontal background bars.
                ctx_ELL.fillStyle = "#444";
                for (const barPosition of ELL_GRAPH_HORIZONTAL_BAR_TIMES) {
                    // Breaks the loop when the bar is not going to be drawn, only works when barPositions is in descending order.
                    if (barHeight >= barPosition) break;

                    ctx_ELL.fillRect(w - 1 - ell.length + i, h - barPosition, 1, 1);
                }

                // Draw the ELL bar.
                ctx_ELL.fillStyle = getEllColor(ellValue);
                ctx_ELL.fillRect(w - 1 - ell.length + i, h - barHeight, 1, barHeight);
            }

            ctx_ELL_overlay.clearRect(0, 0, w, h);

            ctx_ELL_overlay.strokeStyle = "#fff";
            ctx_ELL_overlay.beginPath();
            ctx_ELL_overlay.moveTo(0, hO - 0.5);
            ctx_ELL_overlay.lineTo(w, hO - 0.5);
            // ctx_ELL_overlay.moveTo(0, h - 29.5 /* (1000 / 60 / maxMs) * h */);
            // ctx_ELL_overlay.lineTo(w, h - 29.5 /* (1000 / 60 / maxMs) * h */);
            ctx_ELL_overlay.moveTo(0, h - 59.5 /* (1000 / 30 / maxMs) * h */);
            ctx_ELL_overlay.lineTo(w, h - 59.5 /* (1000 / 30 / maxMs) * h */);
            ctx_ELL_overlay.moveTo(0.5, h - 60);
            ctx_ELL_overlay.lineTo(0.5, hO);
            ctx_ELL_overlay.moveTo(w - 0.5, h - 60);
            ctx_ELL_overlay.lineTo(w - 0.5, hO);
            ctx_ELL_overlay.stroke();

            // ---- Text Drawing ----

            // Clear scaling.
            ctx_ELL.setTransform(1, 0, 0, 1, 0, 0);
            ctx_ELL_overlay.setTransform(1, 0, 0, 1, 0, 0);

            ctx_ELL_overlay.font = `${10 * RENDERED_SCALE}px "Minecraft-Seven-v2B"`;
            ctx_ELL_overlay.letterSpacing = "1px";
            ctx_ELL_overlay.textBaseline = "top";

            const ellClassificaitonCounts: Record<"excellent" | "good" | "stressed" | "critical", number> = {
                excellent: 0,
                good: 0,
                stressed: 0,
                critical: 0,
            };
            for (const ellValue of graphEllValues) {
                if (ellValue < 2) ellClassificaitonCounts.excellent++;
                else if (ellValue < 6) ellClassificaitonCounts.good++;
                else if (ellValue < 15) ellClassificaitonCounts.stressed++;
                else ellClassificaitonCounts.critical++;
            }

            const statText_ELL = `ELL: ${ell.at(-1)!.toFixed(1)} ms`;
            const statText_excellent = `Excellent: ${ellClassificaitonCounts.excellent}`;
            const statText_good = `Good: ${ellClassificaitonCounts.good}`;
            const statText_stressed = `Stressed: ${ellClassificaitonCounts.stressed}`;
            const statText_critical = `Critical: ${ellClassificaitonCounts.critical}`;
            // Draw text shadow.
            ctx_ELL_overlay.fillStyle = "#373737";
            ctx_ELL_overlay.fillText(statText_ELL, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 116) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_ELL_overlay.fillText(statText_excellent, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 106) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_ELL_overlay.fillText(statText_good, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 96) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_ELL_overlay.fillText(statText_stressed, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 86) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_ELL_overlay.fillText(statText_critical, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 76) * RENDERED_SCALE + TEXT_Y_SHIFT);
            // Draw text.
            ctx_ELL_overlay.fillStyle = "#fff";
            ctx_ELL_overlay.fillText(statText_ELL, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 117) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_ELL_overlay.fillText(statText_excellent, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 107) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_ELL_overlay.fillText(statText_good, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 97) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_ELL_overlay.fillText(statText_stressed, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 87) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_ELL_overlay.fillText(statText_critical, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 77) * RENDERED_SCALE + TEXT_Y_SHIFT);
            // ctx_ELL_overlay.fillText(`< 2: Excellent`, 4, 11);
            // ctx_ELL_overlay.fillText(`< 6:  Good`, 4, 20);
            // ctx_ELL_overlay.fillText(`< 15: Stressed`, 4, 29);
            // ctx_ELL_overlay.fillText(`>= 15: Critical`, 4, 38);

            ctx_ELL_overlay.fillStyle = "#ffffff13";
            ctx_ELL_overlay.fillRect(
                1 * RENDERED_SCALE,
                (h - 59) * RENDERED_SCALE,
                ctx_ELL_overlay.measureText("60 ms").width + 2 * RENDERED_SCALE,
                9 * RENDERED_SCALE
            );
            ctx_ELL_overlay.fillStyle = "#fff";
            ctx_ELL_overlay.fillText("60 ms", 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 56) * RENDERED_SCALE + TEXT_Y_SHIFT);

            const minMSText = `${Math.min(...graphEllValues).toFixed(1)} ms min`;
            const avgMSText = `${(graphEllValues.reduce((a: number, b: number): number => a + b, 0) / graphEllValues.length).toFixed(1)} ms avg`;
            const avgMSSize: number = ctx_ELL_overlay.measureText(avgMSText).width / RENDERED_SCALE + 1;
            const maxMSText = `${Math.max(...graphEllValues).toFixed(1)} ms max`;
            const maxMSSize: number = ctx_ELL_overlay.measureText(maxMSText).width / RENDERED_SCALE + 1;
            // Draw text shadow.
            ctx_ELL_overlay.fillStyle = "#373737";
            ctx_ELL_overlay.fillText(minMSText, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 66) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_ELL_overlay.fillText(
                avgMSText,
                (Math.floor((w - avgMSSize) / 2) + 1) * RENDERED_SCALE + TEXT_X_SHIFT,
                (h - 66) * RENDERED_SCALE + TEXT_Y_SHIFT
            );
            ctx_ELL_overlay.fillText(maxMSText, (w - maxMSSize) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 66) * RENDERED_SCALE + TEXT_Y_SHIFT);
            // Draw text.
            ctx_ELL_overlay.fillStyle = "#fff";
            ctx_ELL_overlay.fillText(minMSText, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 67) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_ELL_overlay.fillText(avgMSText, Math.floor((w - avgMSSize) / 2) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 67) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_ELL_overlay.fillText(maxMSText, (w - 1 - maxMSSize) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 67) * RENDERED_SCALE + TEXT_Y_SHIFT);
        };

        const graphFcdValues: number[] = [];

        const getFcdColor = function getFcdColor(ms: number): string {
            const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
            const t = clamp(ms / 10, 0, 1);

            let r: number, g: number;

            if (t < 0.5) {
                // Green to Yellow
                r = (t / 0.5) * 255;
                g = 255;
            } else {
                // Yellow to Red
                r = 255;
                g = 255 - ((t - 0.5) / 0.7) * 255;
            }

            return `rgb(${Math.round(r)},${Math.round(g)},0)`;
        };

        const fcdGraphDrawQueue: number[] = [];

        /**
         * 1 ms on the FCD graph is this many pixels.
         */
        const FCD_GRAPH_SCALE = 6;

        /**
         * The list of times to use to determine the positions to put the bars at in the FCD graph.
         *
         * Should be in descending order for optimal performance.
         */
        const FCD_GRAPH_HORIZONTAL_BAR_TIMES: readonly number[] = Object.freeze([10, 5, 1.5].map((v: number): number => Math.round(v * FCD_GRAPH_SCALE)));

        const drawFcdGraph = function drawFcdGraph(fcd: number | readonly number[], bypassChangeScaleWait = false): void {
            if (fcd instanceof Array && fcd.length === 0) return;
            if (!bypassChangeScaleWait && changingPerfGraphScale) {
                return void fpsGraphDrawQueue.push(...(typeof fcd === "number" ? [fcd] : fcd));
            }
            const RENDERED_SCALE: number = perfGraphScale;
            const w: number = canvas_FCD.width / RENDERED_SCALE;
            const h: number = canvas_FCD.height / RENDERED_SCALE;
            // const wO: number = canvas_FCD_overlay.width / RENDERED_SCALE;
            const hO: number = canvas_FCD_overlay.height / RENDERED_SCALE;
            if (!bypassChangeScaleWait) {
                if (fcdGraphDrawQueue.length > 0) {
                    fcd = [...fcdGraphDrawQueue, ...(typeof fcd === "number" ? [fcd] : fcd)];
                    fcdGraphDrawQueue.length = 0;
                    graphFcdValues.push(...fcd);
                    graphFcdValues.splice(0, Math.max(0, graphFcdValues.length - (w - 2)));
                } else {
                    graphFcdValues.push(...(typeof fcd === "number" ? [fcd] : fcd));
                    graphFcdValues.splice(0, Math.max(0, graphFcdValues.length - (w - 2)));
                }
            }
            if (fcd instanceof Array && fcd.length > w - 2) fcd = fcd.slice(-w + 2);
            if (bufferCanvas_FCD.width !== canvas_FCD.width || bufferCanvas_FCD.height !== canvas_FCD.height) {
                bufferCtx_FCD.clearRect(0, 0, bufferCanvas_FCD.width, bufferCanvas_FCD.height);
                bufferCanvas_FCD = document.createElement("canvas");
                bufferCanvas_FCD.width = canvas_FCD.width;
                bufferCanvas_FCD.height = canvas_FCD.height;
                bufferCtx_FCD = bufferCanvas_FCD.getContext("2d")!;
            }
            ctx_FCD.setTransform(1, 0, 0, 1, 0, 0);
            ctx_FCD_overlay.setTransform(1, 0, 0, 1, 0, 0);
            ctx_FCD_overlay.scale(RENDERED_SCALE, RENDERED_SCALE);

            const newBarCount: number = typeof fcd === "number" ? 1 : fcd.length;

            bufferCtx_FCD.clearRect(0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE);

            // Adds the translucent background to the graph when it is first rendered.
            if (graphFcdValues.length === 1 && w > 3) {
                ctx_FCD.clearRect(0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE); // Clear canvas to remove the data from the last time the page was loaded.
                bufferCtx_FCD.fillStyle = "#ffffff24";
                bufferCtx_FCD.fillRect(1 * RENDERED_SCALE, (h - 60) * RENDERED_SCALE, (w - 2) * RENDERED_SCALE, 60 * RENDERED_SCALE);

                // Draw the horizontal background bars.
                bufferCtx_FCD.scale(RENDERED_SCALE, RENDERED_SCALE);
                bufferCtx_FCD.strokeStyle = "#444";
                bufferCtx_FCD.beginPath();
                for (const barPosition of FCD_GRAPH_HORIZONTAL_BAR_TIMES) {
                    bufferCtx_FCD.moveTo(0, h - barPosition + 0.5);
                    bufferCtx_FCD.lineTo(w, h - barPosition + 0.5);
                }
                bufferCtx_FCD.stroke();
                bufferCtx_FCD.setTransform(1, 0, 0, 1, 0, 0);
            } else {
                bufferCtx_FCD.drawImage(canvas_FCD, 0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE, 0, 0, w * RENDERED_SCALE, h * RENDERED_SCALE);
            }

            ctx_FCD.clearRect(1 * RENDERED_SCALE, 0, (w - 2 - newBarCount) * RENDERED_SCALE, h * RENDERED_SCALE);
            ctx_FCD.drawImage(
                bufferCanvas_FCD,
                (1 + newBarCount) * RENDERED_SCALE,
                0,
                (w - 2 - newBarCount) * RENDERED_SCALE,
                h * RENDERED_SCALE,
                1 * RENDERED_SCALE,
                0,
                (w - 2 - newBarCount) * RENDERED_SCALE,
                h * RENDERED_SCALE
            );
            ctx_FCD.scale(RENDERED_SCALE, RENDERED_SCALE);
            ctx_FCD.clearRect(w - 1 - newBarCount, 0, newBarCount, h);

            // Adds the translucent background to the graph.
            ctx_FCD.fillStyle = "#ffffff24";
            ctx_FCD.fillRect(w - 1 - newBarCount, h - 60, newBarCount, 60);

            fcd = typeof fcd === "number" ? [fcd] : fcd;
            for (let i = 0; i < fcd.length; i++) {
                const fcdValue: number | undefined = fcd[i];
                if (typeof fcdValue !== "number") continue;
                // const barHeight = Math.floor(fcd * graphScale); // Floored version that is identical to Java Edition.
                const barHeight: number = fcdValue * FCD_GRAPH_SCALE;

                // Draw the horizontal background bars.
                ctx_FCD.fillStyle = "#444";
                for (const barPosition of FCD_GRAPH_HORIZONTAL_BAR_TIMES) {
                    // Breaks the loop when the bar is not going to be drawn, only works when barPositions is in descending order.
                    if (barHeight >= barPosition) break;

                    ctx_FCD.fillRect(w - 1 - fcd.length + i, h - barPosition, 1, 1);
                }

                // Draw the FCD bar.
                ctx_FCD.fillStyle = getFcdColor(fcdValue);
                ctx_FCD.fillRect(w - 1 - fcd.length + i, h - barHeight, 1, barHeight);
            }

            ctx_FCD_overlay.clearRect(0, 0, w, h);

            // ctx_FCD_overlay.strokeStyle = "#fff";
            // ctx_FCD_overlay.beginPath();
            // ctx_FCD_overlay.moveTo(0, h - (1000 / 60 / maxMs) * h);
            // ctx_FCD_overlay.lineTo(w, h - (1000 / 60 / maxMs) * h);
            // ctx_FCD_overlay.moveTo(0, h - (1000 / 30 / maxMs) * h);
            // ctx_FCD_overlay.lineTo(w, h - (1000 / 30 / maxMs) * h);
            // ctx_FCD_overlay.stroke();

            ctx_FCD_overlay.strokeStyle = "#fff";
            ctx_FCD_overlay.beginPath();
            ctx_FCD_overlay.moveTo(0, hO - 0.5);
            ctx_FCD_overlay.lineTo(w, hO - 0.5);
            // ctx_FCD_overlay.moveTo(0, h - 29.5 /* (1000 / 60 / maxMs) * h */);
            // ctx_FCD_overlay.lineTo(w, h - 29.5 /* (1000 / 60 / maxMs) * h */);
            ctx_FCD_overlay.moveTo(0, h - 59.5 /* (1000 / 30 / maxMs) * h */);
            ctx_FCD_overlay.lineTo(w, h - 59.5 /* (1000 / 30 / maxMs) * h */);
            ctx_FCD_overlay.moveTo(0.5, h - 60);
            ctx_FCD_overlay.lineTo(0.5, hO);
            ctx_FCD_overlay.moveTo(w - 0.5, h - 60);
            ctx_FCD_overlay.lineTo(w - 0.5, hO);
            ctx_FCD_overlay.stroke();

            // ---- Text Drawing ----

            // Clear scaling.
            ctx_FCD.setTransform(1, 0, 0, 1, 0, 0);
            ctx_FCD_overlay.setTransform(1, 0, 0, 1, 0, 0);

            ctx_FCD_overlay.font = `${10 * RENDERED_SCALE}px "Minecraft-Seven-v2B"`;
            ctx_FCD_overlay.letterSpacing = "1px";
            ctx_FCD_overlay.textBaseline = "top";

            const fcdClassificaitonCounts: Record<"excellent" | "good" | "stressed" | "critical", number> = {
                excellent: 0,
                good: 0,
                stressed: 0,
                critical: 0,
            };
            for (const fcdValue of graphFcdValues) {
                if (fcdValue <= 0.3) fcdClassificaitonCounts.excellent++;
                else if (fcdValue <= 1) fcdClassificaitonCounts.good++;
                else if (fcdValue <= 3) fcdClassificaitonCounts.stressed++;
                else fcdClassificaitonCounts.critical++;
            }

            const statText_FCD = `FCD: ${fcd.at(-1)!.toFixed(1)} ms`;
            // if (fcd.at(-1)! <= -0.1/*  && fcdClassificaitonCounts.critical === 0 && fcdClassificaitonCounts.stressed === 0 */) {
            //     requestAnimationFrame(() => {
            //         console.log(fcd.at(-1)!);
            //         debugger;
            //     });
            // }
            const statText_excellent = `Excellent: ${fcdClassificaitonCounts.excellent}`;
            const statText_good = `Good: ${fcdClassificaitonCounts.good}`;
            const statText_stressed = `Stressed: ${fcdClassificaitonCounts.stressed}`;
            const statText_critical = `Critical: ${fcdClassificaitonCounts.critical}`;
            // Draw text shadow.
            ctx_FCD_overlay.fillStyle = "#373737";
            ctx_FCD_overlay.fillText(statText_FCD, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 116) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FCD_overlay.fillText(statText_excellent, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 106) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FCD_overlay.fillText(statText_good, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 96) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FCD_overlay.fillText(statText_stressed, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 86) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FCD_overlay.fillText(statText_critical, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 76) * RENDERED_SCALE + TEXT_Y_SHIFT);
            // Draw text.
            ctx_FCD_overlay.fillStyle = "#fff";
            ctx_FCD_overlay.fillText(statText_FCD, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 117) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FCD_overlay.fillText(statText_excellent, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 107) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FCD_overlay.fillText(statText_good, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 97) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FCD_overlay.fillText(statText_stressed, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 87) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FCD_overlay.fillText(statText_critical, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 77) * RENDERED_SCALE + TEXT_Y_SHIFT);

            // Draw graph bar labels.
            ctx_FCD_overlay.fillStyle = "#ffffff13";
            ctx_FCD_overlay.fillRect(
                1 * RENDERED_SCALE,
                (h - 59) * RENDERED_SCALE,
                ctx_FCD_overlay.measureText("10 ms").width + 2 * RENDERED_SCALE,
                9 * RENDERED_SCALE
            );
            ctx_FCD_overlay.fillStyle = "#fff";
            ctx_FCD_overlay.fillText("10 ms", 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 56) * RENDERED_SCALE + TEXT_Y_SHIFT);

            const minMSText = `${Math.min(...graphFcdValues).toFixed(1)} ms min`;
            const avgMSText = `${(graphFcdValues.reduce((a: number, b: number): number => a + b, 0) / graphFcdValues.length).toFixed(1)} ms avg`;
            const avgMSSize: number = ctx_FCD_overlay.measureText(avgMSText).width / RENDERED_SCALE + 1;
            const maxMSText = `${Math.max(...graphFcdValues).toFixed(1)} ms max`;
            const maxMSSize: number = ctx_FCD_overlay.measureText(maxMSText).width / RENDERED_SCALE + 1;
            // Draw text shadow.
            ctx_FCD_overlay.fillStyle = "#373737";
            ctx_FCD_overlay.fillText(minMSText, 3 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 66) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FCD_overlay.fillText(
                avgMSText,
                (Math.floor((w - avgMSSize) / 2) + 1) * RENDERED_SCALE + TEXT_X_SHIFT,
                (h - 66) * RENDERED_SCALE + TEXT_Y_SHIFT
            );
            ctx_FCD_overlay.fillText(maxMSText, (w - maxMSSize) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 66) * RENDERED_SCALE + TEXT_Y_SHIFT);
            // Draw text.
            ctx_FCD_overlay.fillStyle = "#fff";
            ctx_FCD_overlay.fillText(minMSText, 2 * RENDERED_SCALE + TEXT_X_SHIFT, (h - 67) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FCD_overlay.fillText(avgMSText, Math.floor((w - avgMSSize) / 2) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 67) * RENDERED_SCALE + TEXT_Y_SHIFT);
            ctx_FCD_overlay.fillText(maxMSText, (w - 1 - maxMSSize) * RENDERED_SCALE + TEXT_X_SHIFT, (h - 67) * RENDERED_SCALE + TEXT_Y_SHIFT);
        };

        const lagSimulator = function lagSimulator(delay: number, interval: number | "frame"): void {
            function loop(): void {
                const t: number = performance.now();
                while (t + delay > performance.now());
                if (interval === "frame") requestAnimationFrame(loop);
                else setTimeout(loop, interval);
            }
            if (interval === "frame") requestAnimationFrame(loop);
            else setTimeout(loop, interval);
        };
        void lagSimulator;
        const handleFpsGraphTick = function handleFpsGraphTick(frameTime: number): void {
            if (canvas_FPS_container?.style.display !== "none") return void drawFpsGraph(frameTime);

            const w: number = +(canvas_FPS.getAttribute("data-base-width") ?? canvas_FPS.width / perfGraphScale);

            fpsGraphDrawQueue.push(frameTime);
            fpsGraphDrawQueue.splice(0, Math.max(0, fpsGraphDrawQueue.length - (w - 2)));
        };
        const handleEllGraphTick = function handleFpsGraphTick(ell: number): void {
            if (canvas_ELL_container?.style.display !== "none") return void drawEllGraph(ell);

            const w: number = +(canvas_ELL.getAttribute("data-base-width") ?? canvas_ELL.width / perfGraphScale);

            ellGraphDrawQueue.push(ell);
            ellGraphDrawQueue.splice(0, Math.max(0, ellGraphDrawQueue.length - (w - 2)));
        };
        const handleFcdGraphTick = function handleFcdGraphTick(fcd: number): void {
            if (canvas_FCD_container?.style.display !== "none") return void drawFcdGraph(fcd);

            const w: number = +(canvas_FCD.getAttribute("data-base-width") ?? canvas_FCD.width / perfGraphScale);

            fcdGraphDrawQueue.push(fcd);
            fcdGraphDrawQueue.splice(0, Math.max(0, fcdGraphDrawQueue.length - (w - 2)));
        };
        startFCDMonitor(handleFcdGraphTick);
        startFPSMonitor(handleFpsGraphTick);
        // queueMicrotask(() =>
        //     startJsLagMonitor(
        //         1 /* (): number => (Number.isFinite(maxFrameRate) ? Math.ceil(1000 / maxFrameRate) : Math.ceil(1000 / 60)) */,
        //         (ell: number): void => void ellGraphDrawQueue.push(ell)
        //     )
        // );
        // requestAnimationFrame(() =>
        startJsLagMonitor(1 /* (): number => (Number.isFinite(maxFrameRate) ? Math.ceil(1000 / maxFrameRate) : Math.ceil(1000 / 60)) */, handleEllGraphTick);
        // );
        // lagSimulator(10, "frame");

        canvas_FPS.addEventListener("rerenderCanvas", (): void => void drawFpsGraph([...graphFrameTimeValues], true));
        canvas_ELL.addEventListener("rerenderCanvas", (): void => void drawEllGraph([...graphEllValues], true));
        canvas_FCD.addEventListener("rerenderCanvas", (): void => void drawFcdGraph([...graphFcdValues], true));
    }
}
