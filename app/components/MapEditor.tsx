import { app, dialog } from "@electron/remote";
import { ControlledMenu, MenuItem } from "@szhsin/react-menu";
import type { SaveDialogReturnValue } from "electron";
import { toLong, type NBTSchemas } from "mcbe-leveldb";
import mergeRefs from "merge-refs";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { JSX, RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/compat";
import * as NBT from "prismarine-nbt";
import type { EditorWidgetOverlayBarWidgetRegistry } from "./EditorWidgetOverlayBar";
const mime = require("mime-types") as typeof import("mime-types");

export type MapEditorDataStorageObject = {
    /**
     * The options for the {@link mapEditor}.
     */
    mapEditor: {
        $TODO?: never;
    };
} & GenericDataStorageObject;

export interface MapRendererProps {
    /**
     * The tab associated with this editor.
     */
    tab?: TabManagerSubTab;
    dataStorageObject: MapEditorDataStorageObject;
    readonly?: boolean | undefined;
    canvasRef?: RefObject<HTMLCanvasElement>;
    containerRef?: RefObject<HTMLDivElement>;
    interactionRef?: RefObject<MapEditorInteraction>;
    /**
     * An optional overlay bar widget registry to allow the map editor to register widgets for the overlay bar.
     *
     * @default undefined
     */
    overlayBarRegistry?: EditorWidgetOverlayBarWidgetRegistry;
}

export interface MapEditorInteraction {
    updateMap(): void;
}

export function MapEditor(props: MapRendererProps): JSX.Element {
    const containerRef: RefObject<HTMLDivElement> = mergeRefs(useRef<HTMLDivElement>(null), props.containerRef);
    const canvasRef: RefObject<HTMLCanvasElement> = mergeRefs(useRef<HTMLCanvasElement>(null), props.canvasRef);
    if (props.dataStorageObject.dataType !== "NBT" && props.dataStorageObject.dataType !== "NBTCompound") {
        throw new Error("Invalid data type for MapEditor: " + props.dataStorageObject.dataType);
    }

    let stopCurrentInteraction: (() => void) | undefined = undefined;
    let data: NBTSchemas.NBTSchemaTypes.Map = (
        props.dataStorageObject.dataType === "NBT"
            ? props.dataStorageObject.data.parsed
            : props.dataStorageObject.dataType === "NBTCompound"
            ? props.dataStorageObject.data
            : (props.dataStorageObject as any).data
    ) as NBTSchemas.NBTSchemaTypes.Map;
    function updateMap(): void {
        data = (
            props.dataStorageObject.dataType === "NBT"
                ? props.dataStorageObject.data.parsed
                : props.dataStorageObject.dataType === "NBTCompound"
                ? props.dataStorageObject.data
                : props.dataStorageObject.data
        ) as NBTSchemas.NBTSchemaTypes.Map;
        const canvas: HTMLCanvasElement = canvasRef.current!;
        const context: CanvasRenderingContext2D = canvas.getContext("2d")!;
        context.clearRect(0, 0, canvas.width, canvas.height);
        for (let i: number = 0; i < data.value.colors.value.length / 4; i++) {
            const r: number = data.value.colors.value[i * 4]! & 0xff;
            const g: number = data.value.colors.value[i * 4 + 1]! & 0xff;
            const b: number = data.value.colors.value[i * 4 + 2]! & 0xff;
            const a: number = data.value.colors.value[i * 4 + 3]! & 0xff;
            context.fillStyle = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${a
                .toString(16)
                .padStart(2, "0")}`;
            context.fillRect(i % 128, Math.floor(i / 128), 1, 1);
        }
    }
    if (props.interactionRef) {
        props.interactionRef.current = {
            updateMap: updateMap,
        };
    }
    function markTabAsModified(): void {
        if (props.tab) {
            props.tab.hasUnsavedChanges = true;
            if (props.tab.target.type === "LevelDBEntry") {
                props.tab.parentTab.setLevelDBIsModified();
            } else {
                props.tab.parentTab.setFileAsModified(props.tab.target.path);
            }
        }
    }

    const [mapEditorAddMarkerMenu_isOpen, mapEditorAddMarkerMenu_setOpen] = useState(false);
    const [mapEditorAddMarkerMenu_anchorPoint, mapEditorAddMarkerMenu_setAnchorPoint] = useState({ x: 0, y: 0 });

    useEffect((): (() => void) => {
        const widgetID: string = `MapEditor_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        if (canvasRef.current) {
            updateMap();
            // stopCurrentInteraction = void function a(): void {};
            stopCurrentInteraction = void function stopCurrentInteractionCallback(): void {
                // TO-DO
                stopCurrentInteraction = undefined;
            };
            if (props.overlayBarRegistry && !props.readonly) {
                props.overlayBarRegistry.registerWidget(
                    <div class="widget-overlay tabbed-selector float-right" style={{ float: "right" }}>
                        <button
                            type="button"
                            title="Byte"
                            class="image-only-button"
                            onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                if (!containerRef.current) return;
                                mapEditorAddMarkerMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                                mapEditorAddMarkerMenu_setOpen(true);
                            }}
                        >
                            <img
                                src="resource://images/ui/glyphs/map_green_arrow_marker.png"
                                style={{ width: "16px", imageRendering: "pixelated" }}
                                aria-hidden="true"
                            />
                        </button>
                    </div>,
                    widgetID,
                    -1
                );
            }
        }
        return (): void => {
            stopCurrentInteraction?.();
            if (props.overlayBarRegistry && !props.readonly) {
                props.overlayBarRegistry.unregisterWidget(widgetID);
            }
        };
    });
    const [mapEditorCanvasContextMenu_isOpen, mapEditorCanvasContextMenu_setOpen] = useState(false);
    const [mapEditorCanvasContextMenu_anchorPoint, mapEditorCanvasContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
    function onCanvasRightClick(event: JSX.TargetedMouseEvent<HTMLCanvasElement>): void {
        event.preventDefault();
        event.stopPropagation();
        const clickPosition: { x: number; y: number } = {
            x: event.clientX,
            y: event.clientY,
        };
        // console.log(clickPosition);

        mapEditorCanvasContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
        mapEditorCanvasContextMenu_setOpen(true);
    }
    return (
        <div style={{ display: "flex", height: "-webkit-fill-available", justifyContent: "center", flexDirection: "column" }} ref={containerRef}>
            <ControlledMenu
                anchorPoint={mapEditorCanvasContextMenu_anchorPoint}
                state={mapEditorCanvasContextMenu_isOpen ? "open" : "closed"}
                direction="right"
                onClose={(): void => void mapEditorCanvasContextMenu_setOpen(false)}
            >
                <MenuItem
                    onClick={async (): Promise<void> => {
                        const result: SaveDialogReturnValue = await dialog.showSaveDialog({
                            buttonLabel: "Save",
                            defaultPath: path.join(app.getPath("downloads"), `map_${toLong(data.value.mapId.value)}.png`),
                            properties: ["showHiddenFiles", "showOverwriteConfirmation", "treatPackageAsDirectory"],
                            title: "Save Map Image",
                            message: "Select a location to save the map image.",
                            filters: [
                                { name: "PNG (Recommended)", extensions: ["png"] },
                                { name: "JPEG", extensions: ["jpg", "jpeg"] },
                                { name: "WEBP", extensions: ["webp"] },
                            ],
                        });
                        if (result.canceled) return;
                        const mimeType: string | false = mime.lookup(result.filePath);
                        if (!mimeType)
                            return void dialog.showErrorBox("Unsupported Image Type", `Unsupported image type: ${mimeType || path.extname(result.filePath)}`);
                        const image: Blob | null = await new Promise((resolve: BlobCallback): void => canvasRef.current!.toBlob(resolve, mimeType));
                        if (!image) return void dialog.showErrorBox("Failed to Save Image", "An error occurred while saving the image.");
                        if (image.type !== mimeType) return void dialog.showErrorBox("Unsupported Image Type", `Unsupported image type: ${mimeType}`);
                        writeFile(result.filePath, Buffer.from(await image.arrayBuffer()));
                    }}
                >
                    Save Image
                </MenuItem>
                {!props.readonly && (
                    <MenuItem
                        onClick={async (): Promise<void> => {
                            const result: string[] | undefined = dialog.showOpenDialogSync({
                                buttonLabel: "Replace",
                                // TO-DO: Add support for other image types.
                                filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }],
                                properties: ["openFile", "treatPackageAsDirectory", "showHiddenFiles"],
                                message: "Select an image to replace this map.",
                                title: "Replace Map Image",
                            });
                            if (!result || !result[0]) return;
                            const image: string = `data:${mime.lookup(result[0].split(".").at(-1)!)};base64,${readFileSync(result[0], "base64")}`;
                            const imageElement = new Image();
                            imageElement.src = image;
                            await new Promise((resolve): void => void (imageElement.onload = resolve));
                            const context: CanvasRenderingContext2D = canvasRef.current!.getContext("2d")!;
                            context.drawImage(imageElement, 0, 0, 128, 128);
                            // TO-DO: Make this convert the bytes from unsigned bytes to signed bytes.
                            data.value.colors.value = Array.from(context.getImageData(0, 0, 128, 128).data).map((value: number): number => (value << 24) >> 24);
                            markTabAsModified();
                            updateMap();
                        }}
                    >
                        Replace Image
                    </MenuItem>
                )}
            </ControlledMenu>
            {!props.readonly && (
                <ControlledMenu
                    anchorPoint={mapEditorAddMarkerMenu_anchorPoint}
                    state={mapEditorAddMarkerMenu_isOpen ? "open" : "closed"}
                    direction="right"
                    onClose={(): void => void mapEditorAddMarkerMenu_setOpen(false)}
                >
                    {...((): JSX.Element[] => {
                        const menuItems: JSX.Element[] = [];

                        for (let i: number = 0; i < 16; i++) {
                            menuItems.push(
                                <MenuItem onClick={async (): Promise<void> => {}}>
                                    <div
                                        style={{
                                            width: "16px",
                                            height: "16px",
                                            imageRendering: "pixelated",
                                            backgroundImage: "url('resource://images/ui/spritesheets/map_icons.png')",
                                            backgroundPosition: `${(i % 4) * 16}px ${Math.floor(i / 4) * 16}px`,
                                        }}
                                        aria-hidden="true"
                                    />
                                </MenuItem>
                            );
                        }

                        return menuItems;
                    })()}
                </ControlledMenu>
            )}
            <div style={{ maxHeight: "round(down, 100%, 128px)", display: "flex", justifyContent: "center", aspectRatio: "1 / 1" }}>
                <canvas
                    width={128}
                    height={128}
                    class="map-renderer-canvas piximg"
                    style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                    ref={canvasRef}
                    onAuxClick={(event): void => void (event.button === 2 && onCanvasRightClick(event))}
                />
            </div>
        </div>
    );
}
