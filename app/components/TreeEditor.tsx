import { toLong, toLongParts } from "mcbe-leveldb";
import type { ComponentChildren, JSX, RefObject, RenderableProps } from "preact";
import React, { render, useEffect, useRef } from "preact/compat";
import NBT from "prismarine-nbt";
import "./treeEditor.css";
import type { EditorWidgetOverlayBarWidgetRegistry } from "./EditorWidgetOverlayBar";
const mime = require("mime-types") as typeof import("mime-types");

/**
 * Expansion data for the {@link TreeEditor}.
 */
export interface TreeEditorDataStorageObjectExpansionData {
    data?: { [key: string]: TreeEditorDataStorageObjectExpansionData };
    value?: boolean;
}

/**
 * Selection data for the {@link TreeEditor}.
 */
export interface TreeEditorDataStorageObjectSelectionData {
    data?: { [key: string]: TreeEditorDataStorageObjectSelectionData };
}

interface TreeEditorDataStorageObjectBase {
    treeEditor: {
        scrollTop?: number;
        expansionData?: TreeEditorDataStorageObjectExpansionData;
        selectionData?: TreeEditorDataStorageObjectSelectionData;
        currentListChildInCreationMode?: string[];
    };
}

export type TreeEditorDataStorageObjectInput = Partial<GenericDataStorageObject> & Partial<TreeEditorDataStorageObjectBase>;

export type TreeEditorDataStorageObject = GenericDataStorageObject & TreeEditorDataStorageObjectBase;

/**
 * Props for the {@link TreeEditor} component.
 */
export interface TreeEditorProps {
    dataStorageObject: TreeEditorDataStorageObjectInput;
    /**
     * A callback function that is called when a value is changed in the tree editor.
     *
     * @param dataStorageObject The current value of the data storage object (it is a reference to the original data storage object).
     * @param cause The cause of the change, or `undefined`.
     * @returns `true` to prevent the tree editor from refreshing, `false` or `undefined` to allow the tree editor to refresh.
     *
     * @default
     * () => undefined
     */
    onValueChange?(
        dataStorageObject: TreeEditorDataStorageObject,
        cause?:
            | {
                  propertyPath: string[];
                  type: "addProperty" | "removeProperty";
              }
            | {
                  propertyPaths: string[][];
                  type: "addProperties" | "removeProperties";
              }
            | {
                  propertyPath: string[];
                  type: "insertProperty";
              }
            | {
                  propertyPath: string[];
                  type: "changeName";
                  previousName: string;
                  newName: string;
              }
            | {
                  propertyPath: string[];
                  type: "changeValue";
                  previousValue: NBTTreeNodeValue | JSONTreeNodeValue;
                  newValue: NBTTreeNodeValue | JSONTreeNodeValue;
              }
            | {
                  propertyPath: string[];
                  type: "changeValueType";
                  previousValueType: KeysOfUnion<(typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]>;
                  newValueType: KeysOfUnion<(typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]>;
              }
    ): boolean | undefined;
    /**
     * Whether the tree editor should be read-only.
     *
     * @default false
     */
    readonly?: boolean | undefined;
    /**
     * An optional overlay bar widget registry to allow the tree editor to register widgets for the overlay bar.
     *
     * @default undefined
     */
    overlayBarRegistry?: EditorWidgetOverlayBarWidgetRegistry | undefined;
}

export type TreeEditorSupportedDataType = "NBTCompound" | "NBT" | "JSON";

export const treeEditorDataTypeToIconTypeMapping = {
    NBTCompound: "NBT",
    NBT: "NBT",
    JSON: "JSON",
} as const satisfies Record<TreeEditorSupportedDataType, string>;

export const treeEditorIcons = {
    NBT: {
        byte: "resource://images/ui/icons/nbt/byte.png",
        short: "resource://images/ui/icons/nbt/short.png",
        int: "resource://images/ui/icons/nbt/int.png",
        long: "resource://images/ui/icons/nbt/long.png",
        float: "resource://images/ui/icons/nbt/float.png",
        double: "resource://images/ui/icons/nbt/double.png",
        string: "resource://images/ui/icons/nbt/string.png",
        list: "resource://images/ui/icons/nbt/list.png",
        compound: "resource://images/ui/icons/nbt/compound.png",
        byteArray: "resource://images/ui/icons/nbt/byteArray.png",
        shortArray: "resource://images/ui/icons/nbt/shortArray.png",
        intArray: "resource://images/ui/icons/nbt/intArray.png",
        longArray: "resource://images/ui/icons/nbt/longArray.png",
        end: "resource://images/ui/icons/nbt/blank.png",
    },
    JSON: {
        list: "resource://images/ui/icons/nbt/list.png",
        object: "resource://images/ui/icons/nbt/compound.png",
        number: "resource://images/ui/icons/nbt/double.png",
        string: "resource://images/ui/icons/nbt/string.png",
        boolean: "resource://images/ui/icons/nbt/boolean.png",
    },
    generic: {
        arrowCollapsed: "resource://images/ui/glyphs/Chevron-Right.png",
        arrowExpanded: "resource://images/ui/glyphs/Chevron-Down.png",
    },
} as const satisfies {
    [key in (typeof treeEditorDataTypeToIconTypeMapping)[TreeEditorSupportedDataType]]: Record<PropertyKey, string>;
} & {
    NBT: Record<`${NBT.TagType}`, string>;
    JSON: Record<"list" | "object" | "number" | "string" | "boolean", string>;
    generic: Record<"arrowCollapsed" | "arrowExpanded", string>;
};

Object.entries(treeEditorIcons).forEach(([key, value]) => {
    Object.entries(value).forEach(([key2, value2]) => {
        fetch(value2)
            .then(async (response: Response): Promise<Blob> => await response.blob())
            .then(
                async (blob: Blob): Promise<void> =>
                    void ((treeEditorIcons[key as keyof typeof treeEditorIcons][key2 as keyof (typeof treeEditorIcons)[keyof typeof treeEditorIcons]] as any) =
                        `data:${mime.lookup(value2)};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`)
            )
            .catch((): void => {});
    });
});

type NBTTreeNodeValue = NBT.Tags[NBT.TagType] | (NBT.Tags[NBT.TagType.List]["value"]["value"][number] | undefined)[];
type DirectNBTTreeNodeValue = NBT.Tags[NBT.TagType]["value"] | undefined;
type JSONTreeNodeValue = { [key: string | number]: JSONTreeNodeValue } | string | number | boolean | null | JSONTreeNodeValue[];

// TODO: When creating a non-primitive tag, the created tag should be automatically selected (it should clear the previous selection too).

export default class TreeEditor extends React.Component<
    TreeEditorProps & { dataStorageObject: Extract<TreeEditorDataStorageObject, { dataType: TreeEditorSupportedDataType }> },
    Extract<TreeEditorDataStorageObject, { dataType: TreeEditorSupportedDataType }>
> {
    public constructor(props: TreeEditorProps) {
        props.dataStorageObject.treeEditor ??= {};
        super(props as TreeEditorProps & { dataStorageObject: Extract<TreeEditorDataStorageObject, { dataType: TreeEditorSupportedDataType }> });
        this.setState(props.dataStorageObject as Extract<TreeEditorDataStorageObject, { dataType: TreeEditorSupportedDataType }>);
    }
    public render(): ComponentChildren {
        const editorIsReadonly: boolean = this.props.readonly ?? false;
        const outerContainerElementRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
        const containerRef: RefObject<HTMLDivElement> = useRef(null);
        const onValueChange: typeof this.props.onValueChange = (...args: Parameters<NonNullable<typeof this.props.onValueChange>>): boolean => {
            const result: boolean | undefined = this.props.onValueChange?.(...args);
            if (!result && outerContainerElementRef.current) {
                // const tempElement: HTMLDivElement = document.createElement("div");
                render(null, outerContainerElementRef.current);
                render(<TreeEditor {...this.props} />, outerContainerElementRef.current.parentElement! /* tempElement */);
                // outerContainerElementRef.current.parentElement?.replaceChild(tempElement.children[0]!, outerContainerElementRef.current);
            }
            return result ?? false;
        };
        const widgetRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
        const widgetButtons = {
            NBT: {
                byte: useRef<HTMLButtonElement>(null),
                byteArray: useRef<HTMLButtonElement>(null),
                compound: useRef<HTMLButtonElement>(null),
                double: useRef<HTMLButtonElement>(null),
                float: useRef<HTMLButtonElement>(null),
                int: useRef<HTMLButtonElement>(null),
                intArray: useRef<HTMLButtonElement>(null),
                list: useRef<HTMLButtonElement>(null),
                long: useRef<HTMLButtonElement>(null),
                longArray: useRef<HTMLButtonElement>(null),
                short: useRef<HTMLButtonElement>(null),
                shortArray: useRef<HTMLButtonElement>(null),
                string: useRef<HTMLButtonElement>(null),
            },
            JSON: {
                boolean: useRef<HTMLButtonElement>(null),
                list: useRef<HTMLButtonElement>(null),
                number: useRef<HTMLButtonElement>(null),
                object: useRef<HTMLButtonElement>(null),
                string: useRef<HTMLButtonElement>(null),
            },
        } as const satisfies {
            [key in (typeof treeEditorDataTypeToIconTypeMapping)[TreeEditorSupportedDataType]]: Record<PropertyKey, RefObject<HTMLButtonElement>>;
        } & {
            NBT: Record<`${NBT.TagType}`, RefObject<HTMLButtonElement>>;
            JSON: Record<"list" | "object" | "number" | "string" | "boolean", RefObject<HTMLButtonElement>>;
        };
        useEffect((): (() => void) => {
            const widgetId: string = `TreeEditor_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            if (this.props.overlayBarRegistry) {
                this.props.overlayBarRegistry.registerWidget(
                    <div class="widget-overlay tabbed-selector float-right" style={{ float: "right" }}>
                        {this.props.dataStorageObject.dataType === "JSON" ?
                            <></>
                        :   <>
                                <button
                                    type="button"
                                    title="Byte"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        // let originalHeaderElement: HTMLDivElement | undefined;
                                        if (!childrenContainerElement) {
                                            // originalHeaderElement = headerElement;
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        // const originalPath: string[] | null =
                                        //     originalHeaderElement ? (JSON.parse(originalHeaderElement.dataset.path!) as string[]) : null;
                                        // const listIndex: number | null = originalPath?.at(-1) ? Number(originalPath.at(-1)) + 1 : null;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            case "byteArray": {
                                                const parentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                // if (listIndex !== null && Number.isFinite(listIndex) && listIndex > 0) {
                                                //     parentObject.splice(listIndex, 0, getDefaultValueTagForNodeType("byte", Array.isArray(parentObject)));
                                                //     // ~FIXME: This does not update the expansion data.
                                                //     props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                //         "value",
                                                //         String(listIndex),
                                                //     ]);
                                                //     onValueChange?.(props.dataStorageObject, {
                                                //         propertyPath: path.concat(["value", String(listIndex)]),
                                                //         type: "insertProperty",
                                                //     });
                                                // } else {
                                                parentObject.push(getDefaultValueTagForNodeType("byte", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat([...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                // }
                                                return;
                                            }
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "byte";
                                                }
                                                // if (listIndex !== null && Number.isFinite(listIndex) && listIndex > 0) {
                                                //     parentObject.splice(listIndex, 0, getDefaultValueTagForNodeType("byte", Array.isArray(parentObject)));
                                                //     // ~FIXME: This does not update the expansion data.
                                                //     props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                //         "value",
                                                //         "value",
                                                //         String(listIndex),
                                                //     ]);
                                                //     onValueChange?.(props.dataStorageObject, {
                                                //         propertyPath: path.concat(["value", "value", String(listIndex)]),
                                                //         type: "insertProperty",
                                                //     });
                                                // } else {
                                                parentObject.push(getDefaultValueTagForNodeType("byte", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                // }
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "byte":
                                            case "short":
                                            case "int":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "shortArray":
                                            case "intArray":
                                            case "longArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode depth={depth + 1} propertyPath={propertyPath} name="" typeToCreate="byte" isInCreationMode={true} />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.byte}
                                >
                                    <img src={treeEditorIcons.NBT.byte} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    title="Short"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        if (!childrenContainerElement) {
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            case "shortArray": {
                                                const parentObject: any = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                parentObject.push(getDefaultValueTagForNodeType("short", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat([...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "short";
                                                }
                                                parentObject.push(getDefaultValueTagForNodeType("short", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "int":
                                            case "byte":
                                            case "short":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "byteArray":
                                            case "intArray":
                                            case "longArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode depth={depth + 1} propertyPath={propertyPath} name="" typeToCreate="short" isInCreationMode={true} />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.short}
                                >
                                    <img src={treeEditorIcons.NBT.short} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    title="Int"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        if (!childrenContainerElement) {
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            case "intArray": {
                                                const parentObject: any = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                parentObject.push(getDefaultValueTagForNodeType("int", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat([...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "int";
                                                }
                                                parentObject.push(getDefaultValueTagForNodeType("int", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "int":
                                            case "byte":
                                            case "short":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "byteArray":
                                            case "shortArray":
                                            case "longArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode depth={depth + 1} propertyPath={propertyPath} name="" typeToCreate="int" isInCreationMode={true} />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.int}
                                >
                                    <img src={treeEditorIcons.NBT.int} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    title="Long"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        if (!childrenContainerElement) {
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            case "longArray": {
                                                const parentObject: any = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                parentObject.push(getDefaultValueTagForNodeType("long", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat([...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "long";
                                                }
                                                parentObject.push(getDefaultValueTagForNodeType("long", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "int":
                                            case "byte":
                                            case "short":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "byteArray":
                                            case "shortArray":
                                            case "intArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode depth={depth + 1} propertyPath={propertyPath} name="" typeToCreate="long" isInCreationMode={true} />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.long}
                                >
                                    <img src={treeEditorIcons.NBT.long} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    title="Float"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        if (!childrenContainerElement) {
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            // case "floatArray": {
                                            //     const parentObject: any = path
                                            //         .concat(["value"])
                                            //         .reduce(
                                            //             (value: unknown, property: string): unknown =>
                                            //                 value?.[property as never],
                                            //             props.dataStorageObject.data
                                            //         );
                                            //     if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                            //     parentObject.push(getDefaultValueTagForNodeType("float", Array.isArray(parentObject)));
                                            //     props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                            //         "value",
                                            //         String(parentObject.length - 1),
                                            //     ]);
                                            //     onValueChange?.(props.dataStorageObject, {
                                            //         propertyPath: path.concat(["value", String(parentObject.length - 1)]),
                                            //         type: "addProperty",
                                            //     });
                                            //     return;
                                            // }
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "float";
                                                }
                                                parentObject.push(getDefaultValueTagForNodeType("float", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "int":
                                            case "byte":
                                            case "short":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "byteArray":
                                            case "shortArray":
                                            case "intArray":
                                            case "longArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode depth={depth + 1} propertyPath={propertyPath} name="" typeToCreate="float" isInCreationMode={true} />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.float}
                                >
                                    <img src={treeEditorIcons.NBT.float} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    title="Double"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        if (!childrenContainerElement) {
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            // case "doubleArray": {
                                            //     const parentObject: any = path
                                            //         .concat(["value"])
                                            //         .reduce(
                                            //             (value: unknown, property: string): unknown =>
                                            //                 value?.[property as never],
                                            //             props.dataStorageObject.data
                                            //         );
                                            //     if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                            //     parentObject.push(getDefaultValueTagForNodeType("double", Array.isArray(parentObject)));
                                            //     props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                            //         "value",
                                            //         String(parentObject.length - 1),
                                            //     ]);
                                            //     onValueChange?.(props.dataStorageObject, {
                                            //         propertyPath: path.concat(["value", String(parentObject.length - 1)]),
                                            //         type: "addProperty",
                                            //     });
                                            //     return;
                                            // }
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "double";
                                                }
                                                parentObject.push(getDefaultValueTagForNodeType("double", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "int":
                                            case "byte":
                                            case "short":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "byteArray":
                                            case "shortArray":
                                            case "intArray":
                                            case "longArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode depth={depth + 1} propertyPath={propertyPath} name="" typeToCreate="double" isInCreationMode={true} />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.double}
                                >
                                    <img src={treeEditorIcons.NBT.double} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    title="Byte Array"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        if (!childrenContainerElement) {
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "byteArray";
                                                }
                                                parentObject.push(getDefaultValueTagForNodeType("byteArray", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "byte":
                                            case "short":
                                            case "int":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "byteArray":
                                            case "shortArray":
                                            case "intArray":
                                            case "longArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode
                                                    depth={depth + 1}
                                                    propertyPath={propertyPath}
                                                    name=""
                                                    typeToCreate="byteArray"
                                                    isInCreationMode={true}
                                                />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.byteArray}
                                >
                                    <img src={treeEditorIcons.NBT.byteArray} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    title="Short Array"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        if (!childrenContainerElement) {
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "shortArray";
                                                }
                                                parentObject.push(getDefaultValueTagForNodeType("shortArray", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "byte":
                                            case "short":
                                            case "int":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "byteArray":
                                            case "shortArray":
                                            case "intArray":
                                            case "longArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode
                                                    depth={depth + 1}
                                                    propertyPath={propertyPath}
                                                    name=""
                                                    typeToCreate="shortArray"
                                                    isInCreationMode={true}
                                                />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.shortArray}
                                >
                                    <img src={treeEditorIcons.NBT.shortArray} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    title="Int Array"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        if (!childrenContainerElement) {
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "intArray";
                                                }
                                                parentObject.push(getDefaultValueTagForNodeType("intArray", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "int":
                                            case "byte":
                                            case "short":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "byteArray":
                                            case "shortArray":
                                            case "intArray":
                                            case "longArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode
                                                    depth={depth + 1}
                                                    propertyPath={propertyPath}
                                                    name=""
                                                    typeToCreate="intArray"
                                                    isInCreationMode={true}
                                                />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.intArray}
                                >
                                    <img src={treeEditorIcons.NBT.intArray} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    title="Long Array"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        if (!childrenContainerElement) {
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "longArray";
                                                }
                                                parentObject.push(getDefaultValueTagForNodeType("longArray", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "int":
                                            case "byte":
                                            case "short":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "byteArray":
                                            case "shortArray":
                                            case "intArray":
                                            case "longArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode
                                                    depth={depth + 1}
                                                    propertyPath={propertyPath}
                                                    name=""
                                                    typeToCreate="longArray"
                                                    isInCreationMode={true}
                                                />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.longArray}
                                >
                                    <img src={treeEditorIcons.NBT.longArray} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    title="List"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        if (!childrenContainerElement) {
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "list";
                                                }
                                                parentObject.push(getDefaultValueTagForNodeType("list", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "int":
                                            case "byte":
                                            case "short":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "byteArray":
                                            case "shortArray":
                                            case "intArray":
                                            case "longArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode depth={depth + 1} propertyPath={propertyPath} name="" typeToCreate="list" isInCreationMode={true} />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.list}
                                >
                                    <img src={treeEditorIcons.NBT.list} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    title="Compound"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        let headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        let childrenContainerElement: HTMLDivElement | undefined = $(headerElement)
                                            .parent()
                                            .find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                        if (!childrenContainerElement) {
                                            headerElement = $(headerElement)
                                                .parent()
                                                .parent()
                                                .parent()
                                                .parent()
                                                .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                            if (!headerElement) return;
                                            childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                            if (!childrenContainerElement) return;
                                        }
                                        const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                        const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                        const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                            (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                        >;
                                        const isDirectType = JSON.parse(headerElement.dataset.isDirectType!) as boolean;
                                        let propertyPath: string[];
                                        switch (type) {
                                            case "compound":
                                                propertyPath = path.concat(isDirectType ? [""] : ["value", ""]);
                                                break;
                                            case "list": {
                                                const parentObject: any = path
                                                    .concat(["value", ...(isDirectType ? [] : ["value"])])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (!Array.isArray(parentObject)) throw new Error("Parent object is not an array.");
                                                const parentParentObject: unknown = path
                                                    .concat(isDirectType ? [] : ["value"])
                                                    .reduce(
                                                        (value: unknown, property: string): unknown => value?.[property as never],
                                                        props.dataStorageObject.data
                                                    );
                                                if (
                                                    typeof parentParentObject === "object" &&
                                                    (parentParentObject as Record<string, unknown> | undefined)?.type === "end"
                                                ) {
                                                    (parentParentObject as Record<string, unknown>).type = "compound";
                                                }
                                                parentObject.push(getDefaultValueTagForNodeType("compound", Array.isArray(parentObject)));
                                                props.dataStorageObject.treeEditor.currentListChildInCreationMode = path.concat([
                                                    "value",
                                                    ...(isDirectType ? [] : ["value"]),
                                                    String(parentObject.length - 1),
                                                ]);
                                                onValueChange?.(props.dataStorageObject, {
                                                    propertyPath: path.concat(["value", ...(isDirectType ? [] : ["value"]), String(parentObject.length - 1)]),
                                                    type: "addProperty",
                                                });
                                                return;
                                            }
                                            case "string":
                                            case "number":
                                            case "boolean":
                                            case "object":
                                            case "int":
                                            case "byte":
                                            case "short":
                                            case "long":
                                            case "float":
                                            case "double":
                                            case "byteArray":
                                            case "shortArray":
                                            case "intArray":
                                            case "longArray":
                                            case "end":
                                            default:
                                                return;
                                        }
                                        const containerElement: HTMLDivElement = document.createElement("div");
                                        containerElement.classList.add("treeEditorTreeNodeChild");
                                        childrenContainerElement.appendChild(containerElement);
                                        function Elem(): JSX.Element {
                                            return (
                                                <TreeNode
                                                    depth={depth + 1}
                                                    propertyPath={propertyPath}
                                                    name=""
                                                    typeToCreate="compound"
                                                    isInCreationMode={true}
                                                />
                                            );
                                        }
                                        render(<Elem />, containerElement);
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.compound}
                                >
                                    <img src={treeEditorIcons.NBT.compound} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                            </>
                        }
                    </div>,
                    widgetId,
                    -1,
                    widgetRef
                );
            }
            if (outerContainerElementRef.current?.parentElement) {
                outerContainerElementRef.current.parentElement.scrollTop =
                    this.props.dataStorageObject.treeEditor.scrollTop ?? outerContainerElementRef.current.parentElement.scrollTop;
            }
            const props: RenderableProps<TreeEditorProps & { dataStorageObject: TreeEditorDataStorageObject }, any> = this.props;
            function onScroll(event: Event): void {
                const target: HTMLDivElement | null = event.currentTarget as HTMLDivElement | null;
                if (!target) return;
                props.dataStorageObject.treeEditor.scrollTop = target.scrollTop;
            }
            const onKeyDown = (event: KeyboardEvent): void => {
                if (!outerContainerElementRef.current) return;
                if (event.code === "Delete") {
                    if (event.target === document.body) {
                        event.preventDefault();
                        const selectedHeaders: HTMLDivElement[] = $(outerContainerElementRef.current)
                            .find<HTMLDivElement>(".treeEditorTreeNodeHeader.selected")
                            .not(
                                ".treeEditorTreeNode:has(> .treeEditorTreeNodeHeader.selected) > .treeEditorTreeNodeChildren .treeEditorTreeNodeHeader.selected"
                            )
                            .toArray();
                        const removedPropertyPaths: string[][] = [];
                        for (const headerElement of selectedHeaders) {
                            const propertyPath: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                            const parentObject: unknown = propertyPath
                                .slice(0, -1)
                                .reduce((value: unknown, property: string): unknown => value?.[property as never], this.props.dataStorageObject.data);
                            if (typeof parentObject !== "object" || !parentObject) return;
                            if (!(propertyPath.at(-1)! in parentObject)) return;
                            if (Array.isArray(parentObject)) parentObject.splice(Number(propertyPath.at(-1)!), 1);
                            else delete parentObject[propertyPath.at(-1)! as never];
                            const parentExpansionDataObject = propertyPath
                                .slice(0, -1)
                                .reduce(
                                    (
                                        value: TreeEditorDataStorageObjectExpansionData | undefined,
                                        property: string
                                    ): TreeEditorDataStorageObjectExpansionData | undefined => (!value ? undefined : value.data?.[property]),
                                    this.props.dataStorageObject.treeEditor.expansionData ?? {}
                                );
                            if (parentExpansionDataObject?.data?.[propertyPath.at(-1)!] !== undefined) {
                                if (Array.isArray(parentObject)) {
                                    const expData: Record<string, TreeEditorDataStorageObjectExpansionData> = parentExpansionDataObject.data;
                                    const deletedIndex: number = Number(propertyPath.at(-1)!);

                                    if (expData[deletedIndex] !== undefined) {
                                        delete expData[deletedIndex];
                                    }

                                    let i: number = deletedIndex + 1;
                                    while (expData[i] !== undefined) {
                                        expData[i - 1] = expData[i]!;
                                        delete expData[i];
                                        i++;
                                    }
                                } else {
                                    delete parentExpansionDataObject.data[propertyPath.at(-1)!];
                                }
                            }
                            headerElement.parentElement?.remove();
                            removedPropertyPaths.push(propertyPath);
                        }
                        if (removedPropertyPaths.length > 0) {
                            onValueChange?.(this.props.dataStorageObject, {
                                propertyPaths: removedPropertyPaths,
                                type: "removeProperties",
                            });
                        }
                    }
                }
            };
            outerContainerElementRef.current?.parentElement?.addEventListener("scroll", onScroll);
            if (!editorIsReadonly) {
                window.addEventListener("keydown", onKeyDown);
            }
            return (): void => {
                // console.log(5);
                outerContainerElementRef.current?.parentElement?.removeEventListener("scroll", onScroll);
                if (!editorIsReadonly) {
                    window.removeEventListener("keydown", onKeyDown);
                }
                if (this.props.overlayBarRegistry) {
                    this.props.overlayBarRegistry.unregisterWidget(widgetId);
                }
            };
        });
        const getDefaultValueTagForNodeType = (
            type: KeysOfUnion<(typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]>,
            listChildMode: boolean
        ): NBT.Tags[NBT.TagType] | string | boolean | number | bigint | [number, number] | Record<string, any> | any[] | undefined => {
            switch (type) {
                case "long":
                    if (listChildMode) return toLongParts(0n);
                    return { type, value: toLongParts(0n) };
                case "boolean":
                    return true;
                case "number":
                    return 0;
                case "byte":
                case "short":
                case "int":
                case "float":
                case "double":
                    if (listChildMode) return 0;
                    return { type, value: 0 };
                case "string":
                    if (this.props.dataStorageObject.dataType === "JSON" || listChildMode) return "";
                    return { type, value: "" };
                case "list":
                    if (this.props.dataStorageObject.dataType === "JSON") return [];
                    if (listChildMode) return { type: "end" as NBT.TagType, value: [] };
                    return { type, value: { type: "end" as NBT.TagType, value: [] } };
                case "byteArray":
                case "shortArray":
                case "intArray":
                case "longArray":
                    if (listChildMode) return [];
                    return { type, value: [] };
                case "compound":
                    if (listChildMode) return {};
                    return { type, value: {} };
                case "object":
                    return {};
                case "end":
                    return undefined;
                default:
                    console.error(`Error getting default node value tag, value type ${JSON.stringify(type)} is not a type that can hold a value.`);
                    return undefined;
            }
        };
        // Use an arrow function to bind `this`.
        const TreeNode = (props: {
            name?: string;
            /* children?: ComponentChildren; */ propertyPath: string[];
            depth: number;
            isInCreationMode?: boolean;
            typeToCreate?: KeysOfUnion<(typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]>;
            containerRef?: RefObject<HTMLDivElement> | undefined;
        }): JSX.Element | undefined => {
            const headerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
            const nameTextDisplayRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
            const nameTextBoxRef: RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
            const valueTextDisplayRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
            const valueTextBoxRef: RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);

            const getSubPropertyPathFromType = (type: KeysOfUnion<(typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]>): string[] => {
                switch (type) {
                    case "byteArray":
                    case "shortArray":
                    case "intArray":
                    case "longArray":
                    case "list":
                    case "object":
                    case "compound":
                    case "boolean":
                    case "number":
                    case "end": {
                        return [];
                    }
                    case "string": {
                        switch (this.props.dataStorageObject.dataType) {
                            case "NBTCompound":
                            case "NBT": {
                                return isDirectType ? [] : ["value"];
                            }
                            case "JSON": {
                                return [];
                            }
                            default:
                                throw new TypeError(
                                    `Missing handling for dataStorageObject.dataType of ${JSON.stringify((this.props.dataStorageObject as GenericDataStorageObject).dataType)}.`
                                );
                        }
                    }
                    case "byte":
                    case "short":
                    case "int":
                    case "float":
                    case "double":
                    case "long": {
                        return isDirectType ? [] : ["value"];
                    }
                    default:
                        return [];
                }
            };

            const getDefaultValueForNodeType = (
                type: KeysOfUnion<(typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]>
                // TODO: Fix this return type.
            ): NBTTreeNodeValue | JSONTreeNodeValue | undefined => {
                switch (type) {
                    case "long":
                        return toLongParts(0n);
                    case "boolean":
                        return true;
                    case "number":
                    case "byte":
                    case "short":
                    case "int":
                    case "float":
                    case "double":
                        return 0;
                    case "string":
                        return "";
                    case "list":
                        if (this.props.dataStorageObject.dataType === "JSON") return [];
                        return { type, value: { type: "end" as NBT.TagType, value: [] } };
                    case "byteArray":
                    case "shortArray":
                    case "intArray":
                    case "longArray":
                        return { type, value: [] };
                    case "compound":
                        return { type, value: {} };
                    case "object":
                        return {};
                    case "end":
                        return undefined;
                    default:
                        console.error(`Error getting default node value tag, value type ${JSON.stringify(type)} is not a type that can hold a value.`);
                        return undefined;
                }
            };

            useEffect((): (() => void) => {
                // TODO: The Escape key should also unfocus and exit the text box.
                // IDEA: Maybe the selection should persist when switching modes.
                const dataStorageObject: TreeEditorDataStorageObject = this.props.dataStorageObject;
                function clearTextDisplayErrorStates(): void {
                    if (nameTextDisplayRef.current) {
                        nameTextDisplayRef.current.classList.remove("treeEditorTextBoxError_duplicatePropertyName");
                        nameTextDisplayRef.current.classList.remove("treeEditorTextBoxCriticalInternalError");
                        nameTextDisplayRef.current.classList.remove("treeEditorTextBoxError");
                        nameTextDisplayRef.current.classList.remove("treeEditorTextBoxWarning");
                    }
                    if (valueTextDisplayRef.current) {
                        valueTextDisplayRef.current.classList.remove("treeEditorTextBoxError_duplicatePropertyName");
                        valueTextDisplayRef.current.classList.remove("treeEditorTextBoxCriticalInternalError");
                        valueTextDisplayRef.current.classList.remove("treeEditorTextBoxError");
                        valueTextDisplayRef.current.classList.remove("treeEditorTextBoxWarning");
                    }
                }
                function setTextDisplayErrorState(
                    box: RefObject<HTMLDivElement>,
                    state: "treeEditorTextBoxError_duplicatePropertyName" | "criticalInternalError" | "error" | "warning"
                ): void {
                    if (!box.current) return;
                    switch (state) {
                        case "treeEditorTextBoxError_duplicatePropertyName":
                            box.current.classList.add("treeEditorTextBoxError_duplicatePropertyName");
                            break;
                        case "criticalInternalError":
                            box.current.classList.add("treeEditorTextBoxCriticalInternalError");
                            break;
                        case "error":
                            box.current.classList.add("treeEditorTextBoxError");
                            break;
                        case "warning":
                            box.current.classList.add("treeEditorTextBoxWarning");
                            break;
                        default:
                            break;
                    }
                }
                let changeEventTriggered: boolean = false;
                function onNodeNameChange(_event: Event): void {
                    changeEventTriggered = true;
                    if (!nameTextBoxRef.current) return;
                    clearTextDisplayErrorStates();
                    nameTextBoxRef.current.classList.remove("visible");
                    if (!props.isInCreationMode && nameTextBoxRef.current.defaultValue === nameTextBoxRef.current.value) return;
                    let rawPreviousName: string;
                    try {
                        rawPreviousName = JSON.parse(`"${nameTextBoxRef.current.defaultValue.replaceAll('"', '\\"')}"`) as string;
                    } catch (e) {
                        setTextDisplayErrorState(nameTextDisplayRef, "criticalInternalError");
                        // TODO: Add a popup warning that something went wrong.
                        console.error(e);
                        return;
                    }
                    let rawNewName: string;
                    try {
                        rawNewName = JSON.parse(`"${nameTextBoxRef.current.value.replaceAll('"', '\\"')}"`) as string;
                    } catch (e) {
                        nameTextBoxRef.current.value = nameTextBoxRef.current.defaultValue;
                        nameTextBoxRef.current.dispatchEvent(new Event("input"));
                        setTextDisplayErrorState(nameTextDisplayRef, "error");
                        // TODO: Add a popup warning that they entered invalid input.
                        console.error(e);
                        return;
                    }
                    // console.log(_event);
                    const parentObject: unknown = props.propertyPath
                        .slice(0, -1)
                        .reduce((value: unknown, property: string): unknown => value?.[property as never], dataStorageObject.data);
                    if (typeof parentObject !== "object" || parentObject === null) {
                        setTextDisplayErrorState(nameTextDisplayRef, "criticalInternalError");
                        // TODO: Add a popup warning that something went wrong.
                        console.error("Parent object is not an object.", parentObject);
                        return;
                    }
                    if (!props.isInCreationMode && !(rawPreviousName in parentObject)) return;
                    if (rawNewName in parentObject) {
                        setTextDisplayErrorState(nameTextDisplayRef, "treeEditorTextBoxError_duplicatePropertyName");
                        // TODO: Add a popup warning to config if they want to overwrite the property with the same name.
                        console.error("Property name already exists");
                        return;
                    }
                    if (props.isInCreationMode) {
                        (parentObject as Record<string, unknown>)[rawNewName] = getDefaultValueTagForNodeType(props.typeToCreate!, Array.isArray(parentObject));
                        if (
                            props.typeToCreate &&
                            !(["byteArray", "shortArray", "intArray", "longArray", "compound", "list", "object"] as (typeof props.typeToCreate)[]).includes(
                                props.typeToCreate
                            )
                        ) {
                            dataStorageObject.treeEditor.currentListChildInCreationMode = [...props.propertyPath.slice(0, -1), rawNewName];
                        }
                        onValueChange?.(dataStorageObject, {
                            propertyPath: [...props.propertyPath.slice(0, -1), rawNewName],
                            type: "addProperty",
                        });
                    } else {
                        parentObject[rawNewName as never] = parentObject[rawPreviousName as never];
                        delete parentObject[rawPreviousName as never];
                        // console.log(5);
                        const parentExpansionDataObject = props.propertyPath
                            .slice(0, -1)
                            .reduce(
                                (
                                    value: TreeEditorDataStorageObjectExpansionData | undefined,
                                    property: string
                                ): TreeEditorDataStorageObjectExpansionData | undefined => (!value ? undefined : value.data?.[property]),
                                dataStorageObject.treeEditor.expansionData ?? {}
                            );
                        if (parentExpansionDataObject?.data?.[rawPreviousName] !== undefined) {
                            parentExpansionDataObject.data[rawNewName] = parentExpansionDataObject.data[rawPreviousName]!;
                            delete parentExpansionDataObject.data[rawPreviousName];
                        }
                        onValueChange?.(dataStorageObject, {
                            propertyPath: [...props.propertyPath.slice(0, -1), rawNewName],
                            type: "changeName",
                            previousName: rawPreviousName,
                            newName: rawNewName,
                        });
                    }
                    // console.log(6);
                }
                function onNodeValueChange(_event: Event): void {
                    changeEventTriggered = true;
                    if (!valueTextBoxRef.current) return;
                    clearTextDisplayErrorStates();
                    valueTextBoxRef.current.classList.remove("visible");
                    if (
                        valueTextBoxRef.current &&
                        valueTextDisplayRef.current &&
                        dataStorageObject.treeEditor.currentListChildInCreationMode?.length === props.propertyPath.length &&
                        dataStorageObject.treeEditor.currentListChildInCreationMode.every(
                            (value: string, index: number): boolean => value === props.propertyPath[index]
                        )
                    ) {
                        delete dataStorageObject.treeEditor.currentListChildInCreationMode;
                    }
                    if (valueTextBoxRef.current.defaultValue === valueTextBoxRef.current.value) return;
                    const actualPath: string[] = [...props.propertyPath, ...getSubPropertyPathFromType(type)];
                    const parentObject: unknown = actualPath
                        .slice(0, -1)
                        .reduce((value: unknown, property: string): unknown => value?.[property as never], dataStorageObject.data);
                    if (typeof parentObject !== "object" || parentObject === null) {
                        setTextDisplayErrorState(valueTextDisplayRef, "criticalInternalError");
                        // TODO: Add a popup warning that something went wrong.
                        console.error("Parent object is not an object.", parentObject);
                        return;
                    }
                    let newValue: string | boolean | number | bigint | [number, number];
                    function getPrimitiveTypeFromType(
                        type: KeysOfUnion<(typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]>
                    ): "string" | "boolean" | "number" | "bigint" | "never" | "longInArrayForm" {
                        switch (type) {
                            case "long":
                                return "longInArrayForm";
                            case "boolean":
                                return "boolean";
                            case "number":
                            case "byte":
                            case "short":
                            case "int":
                            case "float":
                            case "double":
                                return "number";
                            case "string":
                                return "string";
                            case "list":
                            case "byteArray":
                            case "shortArray":
                            case "intArray":
                            case "longArray":
                            case "compound":
                            case "object":
                            case "end":
                            default:
                                return "never";
                        }
                    }
                    let rawPreviousValue: string;
                    try {
                        rawPreviousValue = JSON.parse(`"${valueTextBoxRef.current.defaultValue.replaceAll('"', '\\"')}"`) as string;
                    } catch (e) {
                        setTextDisplayErrorState(valueTextDisplayRef, "criticalInternalError");
                        // TODO: Add a popup warning that something went wrong.
                        console.error(e);
                        return;
                    }
                    let rawNewValue: string;
                    try {
                        rawNewValue = String(JSON.parse(`"${valueTextBoxRef.current.value.replaceAll('"', '\\"')}"`));
                    } catch (e) {
                        valueTextBoxRef.current.value = valueTextBoxRef.current.defaultValue;
                        valueTextBoxRef.current.dispatchEvent(new Event("input"));
                        setTextDisplayErrorState(valueTextDisplayRef, "error");
                        // TODO: Add a popup warning that they entered invalid input.
                        console.error(e);
                        return;
                    }
                    switch (getPrimitiveTypeFromType(type)) {
                        case "string":
                            newValue = rawNewValue;
                            break;
                        case "bigint":
                            try {
                                newValue = BigInt(rawNewValue);
                            } catch (e) {
                                setTextDisplayErrorState(valueTextDisplayRef, "error");
                                // TODO: Add a popup warning that they entered invalid input.
                                console.error(e);
                                return;
                            }
                            break;
                        case "number":
                            newValue = Number(rawNewValue);
                            if (isNaN(newValue)) {
                                setTextDisplayErrorState(valueTextDisplayRef, "error");
                                // TODO: Add a popup warning that they entered invalid input.
                                console.error("Invalid number input, result is NaN.");
                                return;
                            }
                            break;
                        case "boolean":
                            newValue = rawNewValue.toLowerCase() === "true";
                            break;
                        case "longInArrayForm":
                            try {
                                newValue = toLongParts(BigInt(rawNewValue));
                            } catch (e) {
                                setTextDisplayErrorState(valueTextDisplayRef, "error");
                                // TODO: Add a popup warning that they entered invalid input.
                                console.error(e);
                                return;
                            }
                            break;
                        case "never":
                            setTextDisplayErrorState(valueTextDisplayRef, "criticalInternalError");
                            // TODO: Add a popup warning that something went wrong.
                            console.error(`Error saving new node value, value type ${JSON.stringify(type)} is not allowed to have its value directly edited.`);
                            return;
                        default:
                            setTextDisplayErrorState(valueTextDisplayRef, "criticalInternalError");
                            // TODO: Add a popup warning that something went wrong.
                            console.error(`Error saving new node value, unknown type ${JSON.stringify(type)}.`);
                            return;
                    }
                    parentObject[actualPath.at(-1)! as never] = newValue as never;
                    onValueChange?.(dataStorageObject, {
                        propertyPath: actualPath.slice(0, -1),
                        type: "changeValue",
                        previousValue: rawPreviousValue, // FIXME: This is not correct.
                        newValue: rawNewValue, // FIXME: This is not correct.
                    });
                }
                function onDblClick(event: MouseEvent): void {
                    // console.log(57);
                    // console.log(
                    //     nameTextBoxRef.current,
                    //     nameTextBoxRef.current?.classList.contains("visible"),
                    //     nameTextBoxRef.current?.contains(event.target as Node),
                    //     valueTextBoxRef.current,
                    //     valueTextBoxRef.current?.classList.contains("visible"),
                    //     valueTextBoxRef.current?.contains(event.target as Node)
                    // );
                    if (
                        nameTextBoxRef.current &&
                        nameTextDisplayRef.current &&
                        !nameTextBoxRef.current.classList.contains("visible") &&
                        nameTextDisplayRef.current.contains(event.target as Node)
                    ) {
                        event.preventDefault();
                        nameTextBoxRef.current.classList.add("visible");
                        nameTextBoxRef.current.focus();
                    } else if (
                        nameTextBoxRef.current &&
                        nameTextBoxRef.current.classList.contains("visible") &&
                        !nameTextBoxRef.current.contains(event.target as Node)
                    ) {
                        event.preventDefault();
                        clearTextDisplayErrorStates();
                        nameTextBoxRef.current.classList.remove("visible");
                        nameTextBoxRef.current.value = nameTextBoxRef.current.defaultValue;
                        nameTextBoxRef.current.dispatchEvent(new Event("input"));
                        // console.log(58);
                    }
                    if (
                        valueTextBoxRef.current &&
                        valueTextDisplayRef.current &&
                        !valueTextBoxRef.current.classList.contains("visible") &&
                        valueTextDisplayRef.current.contains(event.target as Node)
                    ) {
                        event.preventDefault();
                        valueTextBoxRef.current.classList.add("visible");
                        valueTextBoxRef.current.focus();
                    } else if (
                        valueTextBoxRef.current &&
                        valueTextBoxRef.current.classList.contains("visible") &&
                        !valueTextBoxRef.current.contains(event.target as Node)
                    ) {
                        event.preventDefault();
                        clearTextDisplayErrorStates();
                        valueTextBoxRef.current.classList.remove("visible");
                        valueTextBoxRef.current.value = valueTextBoxRef.current.defaultValue;
                        valueTextBoxRef.current.dispatchEvent(new Event("input"));
                        if (
                            dataStorageObject.treeEditor.currentListChildInCreationMode?.length === props.propertyPath.length &&
                            dataStorageObject.treeEditor.currentListChildInCreationMode.every(
                                (value: string, index: number): boolean => value === props.propertyPath[index]
                            )
                        ) {
                            delete dataStorageObject.treeEditor.currentListChildInCreationMode;
                        }
                        // console.log(59);
                    }
                }
                // HACK: This is to make the Enter key work as expected, where it will correctly exit the text box when pressed, even if the value in it hasn't been changed.
                function onTextBoxKeyDown(event: KeyboardEvent): void {
                    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
                    const eventSource: RefObject<HTMLInputElement> | null =
                        nameTextBoxRef.current === event.currentTarget ? nameTextBoxRef
                        : valueTextBoxRef.current === event.currentTarget ? valueTextBoxRef
                        : null;
                    if (!eventSource) return;
                    changeEventTriggered = false;
                    setImmediate((): void => {
                        if (!eventSource.current || changeEventTriggered) return;
                        eventSource.current.dispatchEvent(new Event("change"));
                    });
                }
                if (!editorIsReadonly) {
                    window.addEventListener("dblclick", onDblClick);
                    if (nameTextBoxRef.current) {
                        nameTextBoxRef.current.addEventListener("change", onNodeNameChange);
                        nameTextBoxRef.current.addEventListener("keydown", onTextBoxKeyDown);
                        nameTextBoxRef.current.dispatchEvent(new Event("input"));
                    }
                    if (valueTextBoxRef.current) {
                        valueTextBoxRef.current.addEventListener("change", onNodeValueChange);
                        valueTextBoxRef.current.addEventListener("keydown", onTextBoxKeyDown);
                        valueTextBoxRef.current.dispatchEvent(new Event("input"));
                    }
                }
                if (props.isInCreationMode && nameTextBoxRef.current && nameTextDisplayRef.current) {
                    nameTextBoxRef.current.classList.add("visible");
                    nameTextBoxRef.current.focus();
                } else if (
                    valueTextBoxRef.current &&
                    valueTextDisplayRef.current &&
                    dataStorageObject.treeEditor.currentListChildInCreationMode?.length === props.propertyPath.length &&
                    dataStorageObject.treeEditor.currentListChildInCreationMode.every(
                        (value: string, index: number): boolean => value === props.propertyPath[index]
                    )
                ) {
                    valueTextBoxRef.current.value = "";
                    valueTextBoxRef.current.dispatchEvent(new Event("input"));
                    valueTextBoxRef.current.classList.add("visible");
                    valueTextBoxRef.current.focus();
                }
                return (): void => {
                    if (!editorIsReadonly) {
                        window.removeEventListener("dblclick", onDblClick);
                        if (nameTextBoxRef.current) {
                            nameTextBoxRef.current.removeEventListener("change", onNodeNameChange);
                            nameTextBoxRef.current.removeEventListener("keydown", onTextBoxKeyDown);
                        }
                        if (valueTextBoxRef.current) {
                            valueTextBoxRef.current.removeEventListener("change", onNodeValueChange);
                            valueTextBoxRef.current.removeEventListener("keydown", onTextBoxKeyDown);
                        }
                    }
                };
            });
            const value: NBTTreeNodeValue | DirectNBTTreeNodeValue | JSONTreeNodeValue =
                props.typeToCreate ?
                    getDefaultValueForNodeType(props.typeToCreate)
                :   (props.propertyPath.reduce((value: unknown, property: string): unknown => value?.[property as never], this.props.dataStorageObject.data) as
                        | NBTTreeNodeValue
                        | DirectNBTTreeNodeValue
                        | JSONTreeNodeValue);
            // TODO: Figure out how this handled "end" type list entries (which are usually undefined).
            if (value === undefined) {
                console.warn("No value found for property path", props.propertyPath, "in data", this.props.dataStorageObject.data);
                return;
            }
            let type: KeysOfUnion<(typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]>;
            let listType: keyof (typeof treeEditorIcons)["NBT"] | undefined;
            let isDirectType: boolean = false;
            function fakeAssertIsNBTNodeTreeNodeValue(value: any): asserts value is NBTTreeNodeValue {
                void value;
            }
            function fakeAssertIsJSONNodeTreeNodeValue(value: any): asserts value is Exclude<JSONTreeNodeValue, NBT.Tags[NBT.TagType]> {
                void value;
            }
            if (!props.typeToCreate) {
                switch (this.props.dataStorageObject.dataType) {
                    case "NBTCompound":
                    case "NBT": {
                        fakeAssertIsNBTNodeTreeNodeValue(value);
                        if (Array.isArray(value)) {
                            // console.log(3);
                            // XXX: This code is designed to crash the editor if the data structure is invalid or when something is wrong with the code below.
                            const parentParentValue: NBT.List<NBT.TagType> = props.propertyPath
                                .slice(0, -2)
                                .reduce(
                                    (value: unknown, property: string): unknown => value?.[property as never],
                                    this.props.dataStorageObject.data
                                ) as NBT.List<NBT.TagType>;
                            if (parentParentValue.type === NBT.TagType.List) {
                                // console.log(4);
                                const parentValue: NBT.List<NBT.TagType>["value"] = props.propertyPath
                                    .slice(0, -1)
                                    .reduce(
                                        (value: unknown, property: string): unknown => value?.[property as never],
                                        this.props.dataStorageObject.data
                                    ) as NBT.List<NBT.TagType>["value"];
                                type = parentValue.type;
                            } else {
                                // console.log(4.1);
                                const parentValue: NBT.ByteArray | NBT.ShortArray | NBT.IntArray | NBT.LongArray | NBT.Long = props.propertyPath
                                    .slice(0, -1)
                                    .reduce((value: unknown, property: string): unknown => value?.[property as never], this.props.dataStorageObject.data) as
                                    | NBT.ByteArray
                                    | NBT.ShortArray
                                    | NBT.IntArray
                                    | NBT.LongArray
                                    | NBT.Long;
                                type =
                                    parentValue.type === "byteArray" ? "byte"
                                    : parentValue.type === "shortArray" ? "short"
                                    : parentValue.type === "intArray" ? "int"
                                    : parentValue.type === "longArray" ? "long"
                                    : parentValue.type;
                                isDirectType =
                                    (
                                        parentValue.type === "byteArray" ||
                                        parentValue.type === "shortArray" ||
                                        parentValue.type === "intArray" ||
                                        parentValue.type === "longArray"
                                    ) ?
                                        true
                                    :   isDirectType;
                            }
                        } else if (
                            typeof value === "object" &&
                            value !== null &&
                            !Array.isArray(
                                props.propertyPath
                                    .slice(0, -1)
                                    .reduce((value: unknown, property: string): unknown => value?.[property as never], this.props.dataStorageObject.data)
                            )
                        ) {
                            // console.log(5);
                            type = value.type;
                            if (type === "list" && (value.value as NBT.List<NBT.TagType>["value"] | undefined)?.type) {
                                listType = (value.value as NBT.List<NBT.TagType>["value"]).type; // as keyof (typeof treeEditorIcons)["NBT"]
                            }
                        } else {
                            // TEST: This needs to be tested for nested arrays, and other things inside nested arrays, and other things nested at the root of an array.
                            // console.log(6);
                            const parentParentParentValue: NBT.List<NBT.TagType> = props.propertyPath
                                .slice(0, -3)
                                .reduce(
                                    (value: unknown, property: string): unknown => value?.[property as never],
                                    this.props.dataStorageObject.data
                                ) as NBT.List<NBT.TagType>;
                            const parentValue: NBT.List<NBT.TagType>["value"] = props.propertyPath
                                .slice(0, -1)
                                .reduce(
                                    (value: unknown, property: string): unknown => value?.[property as never],
                                    this.props.dataStorageObject.data
                                ) as NBT.List<NBT.TagType>["value"];
                            // console.log(parentParentParentValue);
                            if (Array.isArray(parentValue) && Array.isArray(parentParentParentValue)) {
                                const parentParentValue: NBT.List<NBT.TagType>["value"] = props.propertyPath
                                    .slice(0, -2)
                                    .reduce(
                                        (value: unknown, property: string): unknown => value?.[property as never],
                                        this.props.dataStorageObject.data
                                    ) as NBT.List<NBT.TagType>["value"];
                                type = parentParentValue.type;
                                isDirectType = true;
                                if (type === "list" && (value as NBT.List<NBT.TagType>["value"] | undefined)?.type) {
                                    listType = (value as NBT.List<NBT.TagType>["value"]).type; // as keyof (typeof treeEditorIcons)["NBT"]
                                }
                            } else if (parentParentParentValue.type === NBT.TagType.List) {
                                // console.log(7);
                                const parentParentValue: NBT.List<NBT.TagType>["value"] = props.propertyPath
                                    .slice(0, -2)
                                    .reduce(
                                        (value: unknown, property: string): unknown => value?.[property as never],
                                        this.props.dataStorageObject.data
                                    ) as NBT.List<NBT.TagType>["value"];
                                type = parentParentValue.type;
                                isDirectType = true;
                                if (type === "list" && (value as NBT.List<NBT.TagType>["value"] | undefined)?.type) {
                                    listType = (value as NBT.List<NBT.TagType>["value"]).type; // as keyof (typeof treeEditorIcons)["NBT"]
                                }
                            } else {
                                // console.log(8);
                                const parentParentValue: NBT.ByteArray | NBT.ShortArray | NBT.IntArray | NBT.LongArray | NBT.Long = props.propertyPath
                                    .slice(0, -2)
                                    .reduce((value: unknown, property: string): unknown => value?.[property as never], this.props.dataStorageObject.data) as
                                    | NBT.ByteArray
                                    | NBT.ShortArray
                                    | NBT.IntArray
                                    | NBT.LongArray
                                    | NBT.Long;
                                type =
                                    parentParentValue.type === "byteArray" ? "byte"
                                    : parentParentValue.type === "shortArray" ? "short"
                                    : parentParentValue.type === "intArray" ? "int"
                                    : parentParentValue.type === "longArray" ? "long"
                                    : parentParentValue.type;
                                isDirectType =
                                    (
                                        parentParentValue.type === "byteArray" ||
                                        parentParentValue.type === "shortArray" ||
                                        parentParentValue.type === "intArray" ||
                                        parentParentValue.type === "longArray"
                                    ) ?
                                        true
                                    :   isDirectType;
                            }
                        }
                        break;
                    }
                    case "JSON": {
                        fakeAssertIsJSONNodeTreeNodeValue(value);
                        const value2: JSONTreeNodeValue = value;
                        if (Array.isArray(value2)) {
                            type = "list";
                        } else {
                            type = typeof value2 as "string" | "number" | "boolean" | "object";
                        }
                        break;
                    }
                    default:
                        throw new TypeError(
                            `Missing handling for dataStorageObject.dataType of ${JSON.stringify((this.props.dataStorageObject as GenericDataStorageObject).dataType)}.`
                        );
                }
            } else type = props.typeToCreate;
            // console.log(props, type, value);
            const hasChildren: boolean = (["byteArray", "shortArray", "intArray", "longArray", "compound", "list", "object"] as (typeof type)[]).includes(type);
            let childrenCount: number = 0;
            if (hasChildren) {
                switch (type) {
                    case "byteArray":
                    case "shortArray":
                    case "intArray":
                    case "longArray": {
                        const value2 = value as NBT.ByteArray | NBT.ShortArray | NBT.IntArray | NBT.LongArray;
                        childrenCount = value2.value.length;
                        break;
                    }
                    case "list": {
                        if (this.props.dataStorageObject.dataType === "JSON") {
                            const value2 = value as JSONTreeNodeValue[];
                            childrenCount = value2.length;
                            break;
                        }
                        const value2 = value as NBT.List<NBT.TagType> | NBT.List<NBT.TagType>["value"];
                        childrenCount = (isDirectType ? (value2 as NBT.List<NBT.TagType>["value"]).value : (value2 as NBT.List<NBT.TagType>).value.value)
                            .length;
                        break;
                    }
                    case "compound": {
                        const value2 = value as NBT.Compound | NBT.Compound["value"];
                        childrenCount = Object.keys(isDirectType ? value2 : (value2 as NBT.Compound).value).length;
                        break;
                    }
                    case "object": {
                        const value2 = value as Exclude<Extract<JSONTreeNodeValue, object>, any[]>;
                        childrenCount = Object.keys(value2).length;
                        break;
                    }
                    case "string":
                    case "number":
                    case "boolean":
                    case "byte":
                    case "short":
                    case "int":
                    case "long":
                    case "float":
                    case "double":
                    case "end":
                    default:
                        break;
                }
            }
            const getChildren = (): JSX.SpecificElement<"div">[] | undefined => {
                let children: JSX.SpecificElement<"div">[] | undefined;
                if (hasChildren) {
                    switch (type) {
                        case "byteArray":
                        case "shortArray":
                        case "intArray":
                        case "longArray": {
                            const value2 = value as NBT.ByteArray | NBT.ShortArray | NBT.IntArray | NBT.LongArray;
                            children = value2.value.map((_value: number | [number, number], index: number): JSX.SpecificElement<"div"> => {
                                return (
                                    <div class="treeEditorTreeNodeChild">
                                        <TreeNode propertyPath={props.propertyPath.concat(["value", index.toString()])} depth={props.depth + 1} />
                                    </div>
                                );
                            });
                            break;
                        }
                        case "list": {
                            if (this.props.dataStorageObject.dataType === "JSON") {
                                const value2 = value as JSONTreeNodeValue[];
                                children = value2.map((_value: JSONTreeNodeValue, index: number): JSX.SpecificElement<"div"> => {
                                    return (
                                        <div class="treeEditorTreeNodeChild">
                                            <TreeNode propertyPath={props.propertyPath.concat([index.toString()])} depth={props.depth + 1} />
                                        </div>
                                    );
                                });
                                break;
                            }
                            const value2 = value as NBT.List<NBT.TagType> | NBT.List<NBT.TagType>["value"];
                            children = (isDirectType ? (value2 as NBT.List<NBT.TagType>["value"]).value : (value2 as NBT.List<NBT.TagType>).value.value).map(
                                (_value: NBT.List<NBT.TagType>["value"]["value"][number], index: number): JSX.SpecificElement<"div"> => {
                                    return (
                                        <div class="treeEditorTreeNodeChild">
                                            <TreeNode
                                                propertyPath={props.propertyPath.concat([...(isDirectType ? ["value"] : ["value", "value"]), index.toString()])}
                                                depth={props.depth + 1}
                                            />
                                        </div>
                                    );
                                }
                            );
                            break;
                        }
                        case "compound": {
                            const value2 = value as NBT.Compound | NBT.Compound["value"];
                            children = Object.keys(isDirectType ? (value2 as NBT.Compound["value"]) : (value2 as NBT.Compound).value)
                                .sort()
                                .map((key: string): JSX.SpecificElement<"div"> => {
                                    return (
                                        <div class="treeEditorTreeNodeChild">
                                            <TreeNode
                                                name={key}
                                                propertyPath={props.propertyPath.concat([...(isDirectType ? [] : ["value"]), key])}
                                                depth={props.depth + 1}
                                            />
                                        </div>
                                    );
                                });
                            break;
                        }
                        case "object": {
                            const value2 = value as Exclude<Extract<JSONTreeNodeValue, object>, any[]>;
                            children = Object.keys(value2)
                                .sort()
                                .map((key: string): JSX.SpecificElement<"div"> => {
                                    return (
                                        <div class="treeEditorTreeNodeChild">
                                            <TreeNode name={key} propertyPath={props.propertyPath.concat([key])} depth={props.depth + 1} />
                                        </div>
                                    );
                                });
                            break;
                        }
                        case "string":
                        case "number":
                        case "boolean":
                        case "int":
                        case "byte":
                        case "short":
                        case "long":
                        case "float":
                        case "double":
                        case "end":
                        default:
                            break;
                    }
                }
                return children;
            };
            let expanded: boolean =
                hasChildren &&
                (props.propertyPath.length === 0 ?
                    this.props.dataStorageObject.treeEditor.expansionData?.value === true
                :   props.propertyPath.reduce(
                        (
                            value: TreeEditorDataStorageObjectExpansionData | boolean,
                            property: string,
                            index: number,
                            array: string[]
                        ): TreeEditorDataStorageObjectExpansionData | boolean =>
                            !value ? false : (
                                value === true || (index === array.length - 1 ? (value.data?.[property]?.value ?? false) : (value.data?.[property] ?? false))
                            ),
                        this.props.dataStorageObject.treeEditor.expansionData ?? {}
                    ) === true);
            let displayValue: string | undefined;
            switch (type) {
                case "byteArray":
                case "shortArray":
                case "intArray":
                case "longArray":
                case "list":
                case "object":
                case "compound":
                case "end": {
                    break;
                }
                case "boolean":
                case "number": {
                    displayValue = (value as number | boolean).toString();
                    break;
                }
                case "string": {
                    switch (this.props.dataStorageObject.dataType) {
                        case "NBTCompound":
                        case "NBT": {
                            displayValue = typeof value === "string" ? value : (value as NBT.String).value;
                            break;
                        }
                        case "JSON": {
                            displayValue = value as string;
                            break;
                        }
                        default:
                            throw new TypeError(
                                `Missing handling for dataStorageObject.dataType of ${JSON.stringify((this.props.dataStorageObject as GenericDataStorageObject).dataType)} for getting display value.`
                            );
                    }
                    break;
                }
                case "byte":
                case "short":
                case "int":
                case "float":
                case "double": {
                    displayValue = ((value as NBT.Byte | NBT.Short | NBT.Int | NBT.Float | NBT.Double).value ?? value).toString();
                    break;
                }
                case "long": {
                    displayValue = toLong((value as NBT.Long).value ?? value).toString();
                    break;
                }
                default:
                    throw new TypeError(
                        `Missing handling for type of ${JSON.stringify((this.props.dataStorageObject as GenericDataStorageObject).dataType)} for getting display value.`
                    );
            }
            // console.log(displayValue, value, type, expanded, props);
            const children = expanded ? getChildren() : undefined;
            const childrenRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
            return (
                <div class="treeEditorTreeNode" ref={props.containerRef!}>
                    {/* HACK: Passing undefined here may actually be bad, look into this at some point. */}
                    <div
                        class="treeEditorTreeNodeHeader"
                        onClick={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                            if (!outerContainerElementRef.current) return;
                            if (!event.ctrlKey && !event.altKey && !event.metaKey) {
                                event.currentTarget.classList.add("selected");
                                if (event.shiftKey) {
                                    const firstSelection: HTMLDivElement = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                        ".treeEditorTreeNodeHeader.selected"
                                    )[0]!;
                                    const lastSelection: HTMLDivElement = $(outerContainerElementRef.current)
                                        .find<HTMLDivElement>(".treeEditorTreeNodeHeader.selected")
                                        .get(-1)!;
                                    // TODO: Implement this to save the selection.
                                    const selectionData = this.props.dataStorageObject.treeEditor.selectionData ?? {};
                                    void selectionData; // TEMP
                                    if (firstSelection !== event.currentTarget || lastSelection !== event.currentTarget) {
                                        const elements: HTMLDivElement[] = $(outerContainerElementRef.current)
                                            .find<HTMLDivElement>(".treeEditorTreeNodeHeader")
                                            .toArray();
                                        $(elements.slice(elements.indexOf(firstSelection), elements.indexOf(lastSelection) + 1)).addClass("selected");
                                        // .map // TODO: Implement this to save the selection.
                                    } else {
                                        // TODO: Implement this to save the selection.
                                    }
                                    for (const button of [...Object.values(widgetButtons.NBT), ...Object.values(widgetButtons.JSON)]) {
                                        if (!button.current) continue;
                                        button.current.disabled = true;
                                    }
                                } else {
                                    $(outerContainerElementRef.current)
                                        .find<HTMLDivElement>(".treeEditorTreeNodeHeader.selected")
                                        .not(event.currentTarget)
                                        .removeClass("selected");
                                    event.currentTarget.classList.add("selectionStart");
                                    const headerElement: HTMLDivElement | undefined = event.currentTarget;
                                    if (!headerElement) {
                                        for (const button of [...Object.values(widgetButtons.NBT), ...Object.values(widgetButtons.JSON)]) {
                                            if (!button.current) continue;
                                            button.current.disabled = true;
                                        }
                                        return;
                                    }
                                    const childrenContainerElement: HTMLDivElement | null | undefined = childrenRef.current;
                                    if (!childrenContainerElement) {
                                        for (const button of [...Object.values(widgetButtons.NBT), ...Object.values(widgetButtons.JSON)]) {
                                            if (!button.current) continue;
                                            button.current.disabled = true;
                                        }
                                        return;
                                    }
                                    // if (!childrenContainerElement) {
                                    //     headerElement = $(headerElement)
                                    //         .parent()
                                    //         .parent()
                                    //         .parent()
                                    //         .parent()
                                    //         .find<HTMLDivElement>(".treeEditorTreeNodeHeader")[0];
                                    //     if (!headerElement) return;
                                    //     childrenContainerElement = $(headerElement).parent().find<HTMLDivElement>(".treeEditorTreeNodeChildren")[0];
                                    //     if (!childrenContainerElement) return;
                                    // }
                                    // const path: string[] = JSON.parse(headerElement.dataset.path!) as string[];
                                    // const depth: number = JSON.parse(headerElement.dataset.depth!) as number;
                                    const type = JSON.parse(headerElement.dataset.type!) as KeysOfUnion<
                                        (typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]
                                    >;
                                    const listType = JSON.parse(headerElement.dataset.listType ?? "null") as keyof (typeof treeEditorIcons)["NBT"] | null;
                                    const typeToEnabledButtonsMap: Record<
                                        KeysOfUnion<(typeof treeEditorIcons)[Exclude<keyof typeof treeEditorIcons, "generic">]>,
                                        {
                                            [dataType in Exclude<keyof typeof treeEditorIcons, "generic">]: Partial<
                                                Record<keyof (typeof treeEditorIcons)[dataType], true>
                                            >;
                                        }
                                    > = {
                                        boolean: { JSON: {}, NBT: {} },
                                        byte: { JSON: {}, NBT: {} },
                                        byteArray: {
                                            JSON: {},
                                            NBT: {
                                                byte: true,
                                            },
                                        },
                                        compound: {
                                            JSON: {},
                                            NBT: {
                                                byte: true,
                                                byteArray: true,
                                                compound: true,
                                                double: true,
                                                float: true,
                                                int: true,
                                                intArray: true,
                                                list: true,
                                                long: true,
                                                longArray: true,
                                                short: true,
                                                shortArray: true,
                                                string: true,
                                            },
                                        },
                                        double: { JSON: {}, NBT: {} },
                                        end: { JSON: {}, NBT: {} },
                                        float: { JSON: {}, NBT: {} },
                                        int: { JSON: {}, NBT: {} },
                                        intArray: {
                                            JSON: {},
                                            NBT: {
                                                int: true,
                                            },
                                        },
                                        list: {
                                            JSON: {
                                                boolean: true,
                                                list: true,
                                                number: true,
                                                object: true,
                                                string: true,
                                            },
                                            NBT: {
                                                byte: true,
                                                byteArray: true,
                                                compound: true,
                                                double: true,
                                                float: true,
                                                int: true,
                                                intArray: true,
                                                list: true,
                                                long: true,
                                                longArray: true,
                                                short: true,
                                                shortArray: true,
                                                string: true,
                                            },
                                        },
                                        long: { JSON: {}, NBT: {} },
                                        longArray: {
                                            JSON: {},
                                            NBT: {
                                                long: true,
                                            },
                                        },
                                        number: { JSON: {}, NBT: {} },
                                        object: {
                                            JSON: {
                                                boolean: true,
                                                list: true,
                                                number: true,
                                                object: true,
                                                string: true,
                                            },
                                            NBT: {},
                                        },
                                        short: { JSON: {}, NBT: {} },
                                        shortArray: {
                                            JSON: {},
                                            NBT: {
                                                short: true,
                                            },
                                        },
                                        string: { JSON: {}, NBT: {} },
                                    };
                                    for (const button of [
                                        ...(Object.entries(widgetButtons.NBT) as [keyof typeof widgetButtons.NBT, RefObject<HTMLButtonElement>][]).map(
                                            (v) => ["NBT", ...v] as const
                                        ),
                                        ...(Object.entries(widgetButtons.JSON) as [keyof typeof widgetButtons.JSON, RefObject<HTMLButtonElement>][]).map(
                                            (v) => ["JSON", ...v] as const
                                        ),
                                    ]) {
                                        if (!button[2].current) continue;
                                        if (listType && button[0] === "NBT" && type === "list" && listType !== "end") {
                                            button[2].current.disabled = button[1] !== listType;
                                        } else if (typeToEnabledButtonsMap[type][button[0]][button[1] as keyof (typeof treeEditorIcons)[(typeof button)[0]]]) {
                                            button[2].current.disabled = false;
                                        } else {
                                            button[2].current.disabled = true;
                                        }
                                    }
                                }
                            }
                        }}
                        data-path={JSON.stringify(props.propertyPath)}
                        data-depth={JSON.stringify(props.depth)}
                        data-type={JSON.stringify(type)}
                        data-list-type={JSON.stringify(listType)}
                        data-is-direct-type={JSON.stringify(isDirectType)}
                        ref={headerRef}
                    >
                        <div class="treeEditorTreeNodeHeaderIndent" style={{ width: `${props.depth * 32}px` }} />
                        <div class="treeEditorTreeNodeHeaderExpander">
                            {hasChildren && (
                                <div
                                    class="treeEditorTreeNodeHeaderExpanderIcon"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                                        if (event.shiftKey) return;
                                        event.stopPropagation();
                                        expanded = !expanded;
                                        this.props.dataStorageObject.treeEditor.expansionData ??= { data: {} };
                                        if (props.propertyPath.length === 0) {
                                            this.props.dataStorageObject.treeEditor.expansionData.value = expanded;
                                        } else {
                                            props.propertyPath.reduce(
                                                (
                                                    value: TreeEditorDataStorageObjectExpansionData | boolean,
                                                    property: string,
                                                    index: number,
                                                    array: string[]
                                                ): TreeEditorDataStorageObjectExpansionData | boolean => {
                                                    if (typeof value === "boolean") {
                                                        return value;
                                                    }
                                                    value.data ??= {};
                                                    if (index === array.length - 1) {
                                                        value.data[property] ??= { data: {} };
                                                        value.data[property].value = expanded;
                                                        return value.data[property].value;
                                                    }
                                                    return (value.data[property] ??= { data: {} });
                                                },
                                                this.props.dataStorageObject.treeEditor.expansionData
                                            );
                                        }
                                        if (expanded) {
                                            // let tempElement: HTMLDivElement = document.createElement("div");
                                            if (childrenRef.current) render(null, childrenRef.current);
                                            if (childrenRef.current) render(getChildren(), childrenRef.current /* tempElement */);
                                            // childrenRef.current?.replaceChildren(...tempElement.children);
                                            event.currentTarget.querySelector("img")?.setAttribute("src", treeEditorIcons.generic.arrowExpanded);
                                        } else {
                                            if (childrenRef.current) render(null, childrenRef.current);
                                            // childrenRef.current?.replaceChildren();
                                            event.currentTarget.querySelector("img")?.setAttribute("src", treeEditorIcons.generic.arrowCollapsed);
                                        }
                                    }}
                                >
                                    <img
                                        aria-hidden="true"
                                        class="invert_on_light_theme"
                                        src={treeEditorIcons.generic[expanded ? "arrowExpanded" : "arrowCollapsed"]}
                                    />
                                </div>
                            )}
                        </div>
                        <div class="treeEditorTreeNodeHeaderIcon">
                            <img
                                aria-hidden="true"
                                src={treeEditorIcons[treeEditorDataTypeToIconTypeMapping[this.props.dataStorageObject.dataType]][type as never] ?? type}
                            />
                        </div>
                        {(props.name !== undefined || props.isInCreationMode) && (
                            <>
                                <div
                                    class="treeEditorTreeNodeHeaderName"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                                        if (event.shiftKey) return;
                                    }}
                                    ref={nameTextDisplayRef}
                                >
                                    {JSON.stringify(String(props.name)).slice(1, -1).replaceAll('\\"', '"')}
                                </div>
                                {!editorIsReadonly && (
                                    <>
                                        <input
                                            type="text"
                                            class={`treeEditorTreeNodeHeaderNameTextBox${props.isInCreationMode ? " visible" : ""}`}
                                            autoCapitalize="off"
                                            autoCorrect="false"
                                            spellcheck={false}
                                            inputMode="text"
                                            value={JSON.stringify(String(props.name)).slice(1, -1).replaceAll('\\"', '"')}
                                            defaultValue={JSON.stringify(String(props.name)).slice(1, -1).replaceAll('\\"', '"')}
                                            placeholder={JSON.stringify(String(props.name)).slice(1, -1).replaceAll('\\"', '"')}
                                            onInput={(event: JSX.TargetedInputEvent<HTMLInputElement>): void => {
                                                const displayElement: HTMLDivElement | undefined = $(event.currentTarget)
                                                    .parent()
                                                    .find<HTMLDivElement>(".treeEditorTreeNodeHeaderNameTextBoxSizeGetter")[0];
                                                if (!displayElement) return;
                                                displayElement.textContent = event.currentTarget.value;
                                                event.currentTarget.style.width = `${Math.max(Math.min($(displayElement).width()!, 300), 10)}px`;
                                            }}
                                            ref={nameTextBoxRef}
                                        />
                                        <div class="treeEditorTreeNodeHeaderNameTextBoxSizeGetter">
                                            {JSON.stringify(String(props.name)).slice(1, -1).replaceAll('\\"', '"')}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                        {!hasChildren && (
                            <>
                                {props.name !== undefined && <div class="treeEditorTreeNodeHeaderNameAndValueSeparator">{": "}</div>}
                                <div
                                    class={`treeEditorTreeNodeHeaderValue${type === "end" ? " readonlyTreeEditorTreeNodeHeaderValue" : ""}`}
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                                        if (event.shiftKey) return;
                                    }}
                                    ref={valueTextDisplayRef}
                                >
                                    {type === "end" ? "undefined" : JSON.stringify(String(displayValue)).slice(1, -1).replaceAll('\\"', '"')}
                                </div>
                                {!editorIsReadonly && type !== "end" && (
                                    <>
                                        <input
                                            type="text"
                                            class="treeEditorTreeNodeHeaderValueTextBox"
                                            autoCapitalize="off"
                                            autoCorrect="false"
                                            spellcheck={false}
                                            inputMode={
                                                (["byte", "short", "int", "long"] as (typeof type)[]).includes(type) ? "numeric"
                                                : (["float", "double"] as (typeof type)[]).includes(type) ?
                                                    "decimal"
                                                :   "text" // Type number uses text input mode because it needs to allow for exponentional notation.
                                            }
                                            value={JSON.stringify(String(displayValue)).slice(1, -1).replaceAll('\\"', '"')}
                                            defaultValue={JSON.stringify(String(displayValue)).slice(1, -1).replaceAll('\\"', '"')}
                                            placeholder={JSON.stringify(String(displayValue)).slice(1, -1).replaceAll('\\"', '"')}
                                            onInput={(event: JSX.TargetedInputEvent<HTMLInputElement>): void => {
                                                const displayElement: HTMLDivElement | undefined = $(event.currentTarget)
                                                    .parent()
                                                    .find<HTMLDivElement>(".treeEditorTreeNodeHeaderValueTextBoxSizeGetter")[0];
                                                if (!displayElement) return;
                                                displayElement.textContent = event.currentTarget.value;
                                                event.currentTarget.style.width = `${Math.max(Math.min($(displayElement).width()!, 600), 10)}px`;
                                            }}
                                            ref={valueTextBoxRef}
                                        />
                                        <div class="treeEditorTreeNodeHeaderValueTextBoxSizeGetter">{displayValue}</div>
                                    </>
                                )}
                            </>
                        )}
                        {hasChildren && (
                            <div class="treeEditorTreeNodeHeaderEntryCount">
                                {props.name !== undefined && ": "}
                                {childrenCount} entries
                            </div>
                        )}
                    </div>
                    {hasChildren && (
                        <div class="treeEditorTreeNodeChildren" ref={childrenRef}>
                            {...expanded && children ? children : []}
                        </div>
                    )}
                </div>
            );
        };
        // console.log(this.state, this.props.dataStorageObject);
        switch (this.state.dataType) {
            case "NBTCompound": {
                return (
                    <div class={`treeEditorOuterContainer${editorIsReadonly ? " treeEditorReadonly" : ""}`} ref={outerContainerElementRef}>
                        <TreeNode depth={0} propertyPath={[]} containerRef={containerRef} />
                    </div>
                );
            }
            case "NBT": {
                return (
                    <div class={`treeEditorOuterContainer${editorIsReadonly ? " treeEditorReadonly" : ""}`} ref={outerContainerElementRef}>
                        <TreeNode depth={0} propertyPath={["parsed"]} containerRef={containerRef} />
                    </div>
                );
            }
            case "JSON": {
                return (
                    <div class={`treeEditorOuterContainer${editorIsReadonly ? " treeEditorReadonly" : ""}`} ref={outerContainerElementRef}>
                        <TreeNode depth={0} propertyPath={[]} containerRef={containerRef} />
                    </div>
                );
            }
            // TODO: Replace this with a better error message using the Notice component.
            default:
                return (
                    <p>
                        Unknown data type:{" "}
                        {"dataType" in this.state ? JSON.stringify((this.state as GenericDataStorageObject).dataType) : JSON.stringify(this.state)}
                    </p>
                );
        }
    }
}
