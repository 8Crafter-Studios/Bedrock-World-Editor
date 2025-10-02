import type { JSX, RefObject } from "preact";
import { hydrate, render, useEffect, useRef } from "preact/compat";
import { app, screen } from "@electron/remote";
import os from "node:os";
import v8 from "node:v8";
import { existsSync } from "node:fs";

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
    useEffect((): (() => void) => {
        function debugHUDChangeCallback(mode: typeof config.debugHUD): void {
            if (!containerRef.current) return;
            containerRef.current.replaceChildren();
            render(<DebugOverlayContents mode={mode} />, containerRef.current);
        }
        config.on("settingChanged:debugHUD", debugHUDChangeCallback);
        return (): void => {
            config.off("settingChanged:debugHUD", debugHUDChangeCallback);
        };
    }, []);
    return (
        <div style={{ display: "contents", fontFamily: "Mojangles" }} ref={containerRef}>
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
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    function Contents(): JSX.Element {
        const process_memoryUsage: NodeJS.MemoryUsage = process.memoryUsage();
        const v8_heapStatistics: v8.HeapInfo = v8.getHeapStatistics();
        return (
            <>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    {"v" + VERSION} {os.type() === "Windows_NT" ? "Windows" : os.type() === "Darwin" ? "macOS" : os.type()} {os.arch()} Build, {os.version()}{" "}
                    {os.release()}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    Mem:{Math.round(process_memoryUsage.rss / 1000 ** 2)}, Free Mem:
                    {Math.round((v8_heapStatistics.heap_size_limit - process_memoryUsage.rss) / 1000 ** 2)}
                </span>
            </>
        );
    }
    useEffect((): (() => void) => {
        if (containerRef.current) {
            hydrate(<Contents />, containerRef.current);
        }
        const intervalID: number = setInterval((): void => {
            if (!containerRef.current) {
                clearInterval(intervalID);
                return;
            }
            hydrate(<Contents />, containerRef.current);
        }, 1000) as unknown as number;
        return (): void => {
            clearInterval(intervalID);
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
                class="nsel ndrg debug-overlay-top"
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
                    filter: config.debugHUDDropShadow ? "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF) drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)" : "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF)",
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

let GPUInfo: GPUInfo | undefined = undefined;
(app.getGPUInfo("complete") as Promise<GPUInfo>).then((gpuInfo: GPUInfo): void => {
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
    const rightContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    // await app.getGPUInfo("complete");
    // const currentWindow: Electron.BrowserWindow = getCurrentWindow();
    function LeftContents(): JSX.Element {
        return (
            <>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    App v{VERSION}
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
    function RightContents(): JSX.Element {
        const process_memoryUsage: NodeJS.MemoryUsage = process.memoryUsage();
        const v8_heapStatistics: v8.HeapInfo = v8.getHeapStatistics();
        return (
            <>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    OS: {os.version()} {os.release()}
                </span>
                {/* {<span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    {"v" + VERSION} {os.type() === "Windows_NT" ? "Windows" : os.type() === "Darwin" ? "macOS" : os.type()} {os.arch()} Build,
                </span>} */}
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    Mem: {Math.round((process_memoryUsage.rss / v8_heapStatistics.heap_size_limit) * 100)}% {Math.round(process_memoryUsage.rss / 1024 ** 2)}/
                    {Math.round(v8_heapStatistics.heap_size_limit / 1024 ** 2)}MiB
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    CPU: {os.cpus()[0] ? `${os.cpus()[0]!.model} (${os.arch()})` : `Unknown (${os.arch()})`}
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
                    {GPUInfo?.gpuDevice?.find(
                        (gpuDevice: NonNullable<GPUInfo["gpuDevice"]>[number]): string | false | undefined => gpuDevice.active && gpuDevice.deviceString
                    )?.deviceString ?? "Unknown"}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    Process Uptime: {Math.floor(process.uptime())}
                </span>
                <span
                    class="crispy"
                    style={{
                        display: "block",
                    }}
                >
                    System Uptime: {Math.floor(os.uptime())}
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
        const intervalID: number = setInterval((): void => {
            if (!rightContainerRef.current) {
                clearInterval(intervalID);
                return;
            }
            render(<RightContents />, rightContainerRef.current);
        }, 1000) as unknown as number;
        return (): void => {
            window.removeEventListener("resize", handleWindowResize);
            clearInterval(intervalID);
        };
    });
    return (
        <>
            {/* Left panel */}
            <div
                class="nsel ndrg"
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
                    filter: config.debugHUDDropShadow ? "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF) drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)" : "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF)",
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
                class="nsel ndrg"
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
                    filter: config.debugHUDDropShadow ? "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF) drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)" : "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF)",
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
            <span {...Object.fromEntries(Object.entries(props).filter(([key, value]: [key: string, value: any]): boolean => key !== "children"))}>
                <span class="crispy cirspy-text-with-drop-shadow-inner-span">{props.children}</span>
            </span>
        );
    }
    function RightContents(): JSX.Element {
        const configData: ConfigJSON = config.getConfigData();
        const parsedMinecraftDataFolders: string[] = config.parsedMinecraftDataFolders;
        const parsedExtraMinecraftDataFolders: string[] = config.parsedExtraMinecraftDataFolders;
        const existingMinecraftDataFolders: boolean[] = parsedMinecraftDataFolders.map((location: string): boolean => existsSync(location));
        const existingExtraMinecraftDataFolders: boolean[] = parsedExtraMinecraftDataFolders.map((location: string): boolean => existsSync(location));
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
                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">
                        {JSONB.stringify(configData.debugHUDDropShadow)}
                    </CrispyDropShadowSpan>
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
                    (location: string, index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {parsedMinecraftDataFolders[index] ? (
                                existingMinecraftDataFolders[index] ? (
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                        [E]
                                    </CrispyDropShadowSpan>
                                ) : (
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                        [X]
                                    </CrispyDropShadowSpan>
                                )
                            ) : (
                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FFA854FF">
                                    [?]
                                </CrispyDropShadowSpan>
                            )}{" "}
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
                    (location: string, index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {parsedExtraMinecraftDataFolders[index] ? (
                                existingExtraMinecraftDataFolders[index] ? (
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                        [E]
                                    </CrispyDropShadowSpan>
                                ) : (
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                        [X]
                                    </CrispyDropShadowSpan>
                                )
                            ) : (
                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FFA854FF">
                                    [?]
                                </CrispyDropShadowSpan>
                            )}{" "}
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
                    >{`Parsed Minecraft Data Folders [${parsedMinecraftDataFolders.length}]`}</CrispyDropShadowSpan>
                </span>
                {parsedMinecraftDataFolders.map(
                    (location: string, index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {existingMinecraftDataFolders[index] ? (
                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                    [E]
                                </CrispyDropShadowSpan>
                            ) : (
                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                    [X]
                                </CrispyDropShadowSpan>
                            )}{" "}
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
                    >{`Parsed Extra Minecraft Data Folders [${parsedExtraMinecraftDataFolders.length}]`}</CrispyDropShadowSpan>
                </span>
                {parsedExtraMinecraftDataFolders.map(
                    (location: string, index: number): JSX.Element => (
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            {existingExtraMinecraftDataFolders[index] ? (
                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#54FF54FF">
                                    [E]
                                </CrispyDropShadowSpan>
                            ) : (
                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5454FF">
                                    [X]
                                </CrispyDropShadowSpan>
                            )}{" "}
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
        }, 1000) as unknown as number;
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
                class="nsel ndrg debug-overlay-config-mode debug-overlay-right"
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
            <span {...Object.fromEntries(Object.entries(props).filter(([key, value]: [key: string, value: any]): boolean => key !== "children"))}>
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
                        const modeSettings: UnionToIntersection<typeof viewSettings.modeSettings> = viewSettings.modeSettings as any;
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
                                                            Extract<(typeof modeSettings)[typeof modeSetting], { sections: any }>["sections"][KeysOfUnion<
                                                                Extract<(typeof modeSettings)[typeof modeSetting], { sections: any }>["sections"]
                                                            >]
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
        }, 1000) as unknown as number;
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
                class="nsel ndrg debug-overlay-config-mode debug-overlay-right"
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
    const rightContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    function CrispyDropShadowSpan(props: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
        return (
            <span {...Object.fromEntries(Object.entries(props).filter(([key, value]: [key: string, value: any]): boolean => key !== "children"))}>
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
                    App v{VERSION}
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
                    Tab Name:{" "}
                    {tab instanceof TabManagerTab ? (
                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{tab.name}</CrispyDropShadowSpan>
                    ) : tab ? (
                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value">{tab}</CrispyDropShadowSpan>
                    ) : (
                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5555FF">
                            null
                        </CrispyDropShadowSpan>
                    )}
                </span>
                {tab && tab instanceof TabManagerTab ? (
                    <>
                        <span
                            class="crispy"
                            style={{
                                display: "block",
                            }}
                        >
                            DB Status:{" "}
                            {tab.db ? (
                                tab.db.isOpen() ? (
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#55FF55FF">
                                        open
                                    </CrispyDropShadowSpan>
                                ) : (
                                    <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5555FF">
                                        closed
                                    </CrispyDropShadowSpan>
                                )
                            ) : tab.awaitDBOpen ? (
                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FFFF55FF">
                                    loading
                                </CrispyDropShadowSpan>
                            ) : (
                                <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5555FF">
                                    undefined
                                </CrispyDropShadowSpan>
                            )}
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
                                tab.cachedDBKeys
                                    ? ` [${Object.values(tab.cachedDBKeys).reduce((a: number, b: Buffer[] | undefined): number => a + (b?.length ?? 0), 0)}]`
                                    : ""
                            }`}</CrispyDropShadowSpan>
                        </span>
                        {tab.cachedDBKeys ? (
                            Object.entries(tab.cachedDBKeys).map(
                                ([key, value]: [key: string, value: Buffer[] | undefined]): JSX.Element => (
                                    <span
                                        class="crispy"
                                        style={{
                                            display: "block",
                                        }}
                                    >
                                        <CrispyDropShadowSpan class="debug-overlay-config-mode-item-label" data-color="#AAAAAAFF">
                                            {key}:{" "}
                                        </CrispyDropShadowSpan>
                                        {value ? (
                                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#55FF55FF">
                                                {value.length}
                                            </CrispyDropShadowSpan>
                                        ) : (
                                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5555FF">
                                                undefined
                                            </CrispyDropShadowSpan>
                                        )}
                                    </span>
                                )
                            )
                        ) : tab.awaitCachedDBKeys ? (
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FFFF55FF">
                                loading
                            </CrispyDropShadowSpan>
                        ) : (
                            <CrispyDropShadowSpan class="debug-overlay-config-mode-item-value" data-color="#FF5555FF">
                                undefined
                            </CrispyDropShadowSpan>
                        )}
                    </>
                ) : (
                    <></>
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
        }, 1000) as unknown as number;
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
                class="nsel ndrg debug-overlay-tab-mode"
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
                    filter: config.debugHUDDropShadow ? "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF) drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)" : "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF)",
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
                class="nsel ndrg debug-overlay-tab-mode"
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
                    filter: config.debugHUDDropShadow ? "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF) drop-shadow(0px 0px 6px black) drop-shadow(0px 0px 6px black)" : "drop-shadow(calc((round(up, var(--gui-scale), 2) / 2) * 1px) calc((round(up, var(--gui-scale), 2) / 2) * 1px) 0 #404040FF)",
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
