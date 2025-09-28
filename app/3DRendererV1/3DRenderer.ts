import "./3DRenderer.css";
import type { Vector3 } from "mcbe-leveldb";
import json5 from "json5";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fetchTextSync } from "../../src/utils/connectionUtils";
const terrainTextureJSON = json5.parse(
    fetchTextSync("resource://mc/textures/terrain_texture.json", "utf-8")!
) as typeof import("../../resources/mc/textures/terrain_texture.json");
const blocksJSON = json5.parse(fetchTextSync("resource://mc/blocks.json", "utf-8")!) as typeof import("../../resources/mc/blocks.json");

console.log(terrainTextureJSON, blocksJSON);

export type BlockFace = "top" | "north" | "east" | "south" | "west" | "bottom";

export class Block {
    public x: number;
    public y: number;
    public z: number;
    public typeID: string;
    public block: JQuery<HTMLElement>;
    public constructor(x: number, y: number, z: number, typeID: LooseAutocomplete<`${"minecraft:" | ""}${keyof typeof blocksJSON}`>) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.typeID = typeID;

        this.block = undefined!;
        this.build();
    }

    public build(): void {
        const size = 64;
        const x = this.x * size;
        const y: number = this.y * size;
        const z: number = this.z * size;

        const block = (this.block = $(`<div class="block" />`).css({
            transform: `
    translateX(${x}px)
    translateY(${y}px)
    translateZ(${z}px)
    scale(0.99)
`,
        }));

        $(`<div class="x-axis" />`)
            .appendTo(block)
            .css({
                transform: `
    rotateX(90deg)
    rotateY(0deg)
    rotateZ(0deg)
`,
            });

        $(`<div class="y-axis" />`)
            .appendTo(block)
            .css({
                transform: `
    rotateX(0deg)
    rotateY(90deg)
    rotateZ(0deg)
`,
            });

        $(`<div class="z-axis" />`).appendTo(block);

        this.createFace("top", 0, 0, size / 2, 0, 0, 0).appendTo(block);

        this.createFace("north", 0, size / 2, 0, 270, 0, 0).appendTo(block);

        this.createFace("east", size / 2, 0, 0, 0, 90, 0).appendTo(block);

        this.createFace("south", 0, size / -2, 0, -270, 0, 0).appendTo(block);

        this.createFace("west", size / -2, 0, 0, 0, -90, 0).appendTo(block);

        this.createFace("bottom", 0, 0, size / -2, 0, 180, 0).appendTo(block);
    }

    public createFace(type: BlockFace, x: number, y: number, z: number, rx: number, ry: number, rz: number) {
        return $(`<div class="side side-${type}" />`)
            .css({
                transform: `
    translateX(${x}px)
    translateY(${y}px)
    translateZ(${z}px)
    rotateX(${rx}deg)
    rotateY(${ry}deg)
    rotateZ(${rz}deg)
`,
                background: this.createTexture(type),
            })
            .data("block", this)
            .data("type", type);
    }

    public createTexture(type: BlockFace): string {
        const blockTextureData =
            blocksJSON[this.typeID as Exclude<keyof typeof blocksJSON, "format_version">] ??
            blocksJSON[this.typeID.replace(/^minecraft:/, "") as Exclude<keyof typeof blocksJSON, "format_version">];
        if (!blockTextureData || !("textures" in blockTextureData)) return "#0000";
        const terrainTextureForFace: keyof typeof terrainTextureJSON.texture_data | undefined =
            typeof blockTextureData.textures === "string"
                ? (blockTextureData.textures as keyof typeof terrainTextureJSON.texture_data)
                : type in blockTextureData.textures
                ? (blockTextureData.textures[type as keyof typeof blockTextureData.textures] as keyof typeof terrainTextureJSON.texture_data)
                : !(["top", "bottom"] as BlockFace[]).includes(type) && "side" in blockTextureData.textures
                ? (blockTextureData.textures.side as keyof typeof terrainTextureJSON.texture_data)
                : type === "top" && "top" in blockTextureData.textures
                ? (blockTextureData.textures.top as keyof typeof terrainTextureJSON.texture_data)
                : type === "bottom" && "bottom" in blockTextureData.textures
                ? (blockTextureData.textures.bottom as keyof typeof terrainTextureJSON.texture_data)
                : undefined;
        if (!terrainTextureForFace) return "#0000";
        const texture = terrainTextureJSON.texture_data[terrainTextureForFace];
        if (typeof texture.textures === "string") return `url("resource://mc/${texture.textures}.png")`;
        if (Array.isArray(texture.textures) && typeof texture.textures[0] === "string") return `url("resource://mc/${texture.textures[0]}.png")`;
        if (Array.isArray(texture.textures)) {
            const firstTexture = texture.textures[0]!;
            if (typeof firstTexture === "string") return `url("resource://mc/${firstTexture}.png")`;
            return `url("resource://mc/${firstTexture.path}.png")`;
        }
        return `url("resource://mc/${texture.textures.path}.png")`;
    }
}

function createCoordinatesFrom(side: BlockFace, x: number, y: number, z: number): Vector3 {
    if (side == "top") {
        z += 1;
    }

    if (side == "north") {
        y += 1;
    }

    if (side == "east") {
        x += 1;
    }

    if (side == "south") {
        y -= 1;
    }

    if (side == "west") {
        x -= 1;
    }

    if (side == "bottom") {
        z -= 1;
    }

    return { x, y, z };
}

function vector3ToArray(vec: Vector3): [x: number, y: number, z: number] {
    return [vec.x, vec.y, vec.z];
}

export function Renderer3D(): HTMLDivElement {
    const container: HTMLDivElement = document.createElement("div");
    container.classList.add("renderer_3d");
    const scene: HTMLDivElement = document.createElement("div");
    scene.classList.add("scene");
    container.appendChild(scene);

    for (var x: number = 0; x < 6; x++) {
        for (var y: number = 0; y < 6; y++) {
            let next: Block = new Block(x, y, 0, "acacia_fence_gate");
            next.block.appendTo(scene);
        }
    }

    $(scene).on("click", ".side", function (this: HTMLDivElement, e) {
        const $this = $(this);
        const previous: Block = $this.data("block");

        if ($(scene).hasClass("subtraction")) {
            previous.block.remove();
        } else {
            const coordinates = createCoordinatesFrom($this.data("type"), previous.x, previous.y, previous.z);

            const next = new Block(...vector3ToArray(coordinates), "minecraft:netherreactor");
            next.block.appendTo($(scene));
        }
    });

    let sceneTransformX = 60;
    let sceneTransformY = 0;
    let sceneTransformZ = 60;
    let sceneTransformScale = 1;

    function changeViewport() {
        $(scene).css({
            transform: `
      rotateX(${sceneTransformX}deg)
      rotateY(${sceneTransformY}deg)
      rotateZ(${sceneTransformZ}deg)
      scaleX(${sceneTransformScale})
      scaleY(${sceneTransformScale})
      scaleZ(${sceneTransformScale})
    `,
        });
    }

    $(container).on("mousewheel", function (event) {
        if ((event.originalEvent as WheelEvent).deltaY > 0) {
            sceneTransformScale -= 0.05;
        } else {
            sceneTransformScale += 0.05;
        }

        changeViewport();
    });

    let lastMouseX: number | null = null;
    let lastMouseY: number | null = null;

    $(container).on("mousedown", function (e) {
        lastMouseX = e.clientX / 10;
        lastMouseY = e.clientY / 10;
    });

    $(container).on("mousemove", function (e) {
        if (!lastMouseX || !lastMouseY) {
            return;
        }

        let nextMouseX: number = e.clientX / 10;
        let nextMouseY: number = e.clientY / 10;

        if (nextMouseX !== lastMouseX) {
            const deltaX: number = nextMouseX - lastMouseX;
            let degrees: number = sceneTransformZ - deltaX;

            if (degrees > 360) {
                degrees -= 360;
            }

            if (degrees < 0) {
                degrees += 360;
            }

            sceneTransformZ = degrees;
            lastMouseX = nextMouseX;

            changeViewport();
        }

        if (nextMouseY !== lastMouseY) {
            const deltaY: number = nextMouseY - lastMouseY;
            let degrees: number = sceneTransformX - deltaY;

            if (degrees > 360) {
                degrees -= 360;
            }

            if (degrees < 0) {
                degrees += 360;
            }

            sceneTransformX = degrees;
            lastMouseY = nextMouseY;

            changeViewport();
        }
    });

    $(container).on("mouseup", function (e) {
        lastMouseX = null;
        lastMouseY = null;
    });

    $(scene).on("mousedown", function (e) {
        e.stopPropagation();
    });

    $("body").on("keydown", function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey) {
            $(scene).addClass("subtraction");
        }
    });

    $("body").on("keyup", function (e) {
        $(scene).removeClass("subtraction");
    });

    let first: Block = new Block(1, 1, 1, "dirt");

    $(scene).append(first.block);

    return container;
}

globalThis.Renderer3D = Renderer3D;
