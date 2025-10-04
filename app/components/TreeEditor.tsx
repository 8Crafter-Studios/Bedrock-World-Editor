import { toLong, toLongParts } from "mcbe-leveldb";
import { render, type ComponentChild, type ComponentChildren, type JSX, type RefObject, type RenderableProps } from "preact";
import React, { useEffect, useRef } from "preact/compat";
import NBT from "prismarine-nbt";
import "./treeEditor.css";
import type { EditorWidgetOverlayBarWidgetRegistry } from "./EditorWidgetOverlayBar";
const mime = require("mime-types") as typeof import("mime-types");

export interface TreeEditorDataStorageObjectExpansionData {
    [key: string]: { data?: TreeEditorDataStorageObjectExpansionData; value?: boolean };
}

interface TreeEditorDataStorageObjectBase {
    treeEditor: {
        scrollTop?: number;
        expansionData?: TreeEditorDataStorageObjectExpansionData;
    };
}

export type TreeEditorDataStorageObjectInput = GenericDataStorageObject & Partial<TreeEditorDataStorageObjectBase>;

export type TreeEditorDataStorageObject = GenericDataStorageObject & TreeEditorDataStorageObjectBase;

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
                  previousValueType: KeysOfUnion<(typeof treeEditorIcons)[keyof typeof treeEditorIcons]>;
                  newValueType: KeysOfUnion<(typeof treeEditorIcons)[keyof typeof treeEditorIcons]>;
              }
    ): boolean | undefined;
    /**
     * Whether the tree editor should be read-only.
     *
     * @default false
     */
    readonly?: boolean;
    /**
     * An optional overlay bar widget registry to allow the tree editor to register widgets for the overlay bar.
     *
     * @default undefined
     */
    overlayBarRegistry?: EditorWidgetOverlayBarWidgetRegistry;
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
            .then((response: Response): Promise<Blob> => response.blob())
            .then(
                async (blob: Blob): Promise<void> =>
                    void ((treeEditorIcons[key as keyof typeof treeEditorIcons][
                        key2 as keyof (typeof treeEditorIcons)[keyof typeof treeEditorIcons]
                    ] as any) = `data:${mime.lookup(value2)};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`)
            )
            .catch((): void => {});
    });
});

type NBTTreeNodeValue = NBT.Tags[NBT.TagType] | NBT.Tags[NBT.TagType.List]["value"]["value"];
type JSONTreeNodeValue = { [key: string | number]: JSONTreeNodeValue } | string | number | boolean | null | JSONTreeNodeValue[];

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
                        {this.props.dataStorageObject.dataType === "JSON" ? (
                            <></>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    title="Byte"
                                    class="image-only-button"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                        if (!outerContainerElementRef.current) {
                                            event.currentTarget.disabled = true;
                                            return;
                                        }
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
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
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
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
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
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
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
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
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
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
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
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
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
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
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
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
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
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
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
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
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
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
                                        const headerElement: HTMLDivElement | undefined = $(outerContainerElementRef.current).find<HTMLDivElement>(
                                            ".treeEditorTreeNodeHeader.selected"
                                        )[0];
                                        if (!headerElement) return;
                                        // TO-DO
                                    }}
                                    disabled
                                    ref={widgetButtons.NBT.compound}
                                >
                                    <img src={treeEditorIcons.NBT.compound} style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                                </button>
                            </>
                        )}
                    </div>,
                    widgetId,
                    -1,
                    widgetRef
                );
            }
            if (outerContainerElementRef.current?.parentElement)
                outerContainerElementRef.current.parentElement.scrollTop =
                    this.props.dataStorageObject.treeEditor.scrollTop ?? outerContainerElementRef.current.parentElement.scrollTop;
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
                        let removedPropertyPaths: string[][] = [];
                        for (const headerElement of selectedHeaders) {
                            const propertyPath: string[] = JSON.parse(headerElement.dataset.path!);
                            const parentObject: any = propertyPath
                                .slice(0, -1)
                                .reduce((value: any, property: string): any => value?.[property], this.props.dataStorageObject.data);
                            if (!(propertyPath.at(-1)! in parentObject)) return;
                            delete parentObject[propertyPath.at(-1)!];
                            const parentExpansionDataObject = propertyPath
                                .slice(0, -1)
                                .reduce(
                                    (
                                        value: { data?: Record<string, any>; value?: boolean } | undefined,
                                        property: string
                                    ): { data?: Record<string, any>; value?: boolean } | undefined => (!value ? undefined : value.data?.[property]),
                                    this.props.dataStorageObject.treeEditor.expansionData ?? {}
                                );
                            if (parentExpansionDataObject?.data !== undefined && parentExpansionDataObject.data[propertyPath.at(-1)!] !== undefined) {
                                delete parentExpansionDataObject.data[propertyPath.at(-1)!];
                            }
                            headerElement.parentElement?.remove();
                            removedPropertyPaths.push(propertyPath);
                        }
                        if (removedPropertyPaths.length > 0)
                            onValueChange?.(this.props.dataStorageObject, {
                                propertyPaths: removedPropertyPaths,
                                type: "removeProperties",
                            });
                    }
                }
            };
            outerContainerElementRef.current?.parentElement?.addEventListener("scroll", onScroll);
            if (!editorIsReadonly) {
                window.addEventListener("keydown", onKeyDown);
            }
            return (): void => {
                console.log(5);
                outerContainerElementRef.current?.parentElement?.removeEventListener("scroll", onScroll);
                if (!editorIsReadonly) {
                    window.removeEventListener("keydown", onKeyDown);
                }
                if (this.props.overlayBarRegistry) {
                    this.props.overlayBarRegistry.unregisterWidget(widgetId);
                }
            };
        });
        // Use an arrow function to bind `this`.
        const TreeNode = (props: {
            name?: string;
            /* children?: ComponentChildren; */ propertyPath: string[];
            depth: number;
            containerRef?: RefObject<HTMLDivElement> | undefined;
        }): JSX.Element | undefined => {
            const headerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
            const nameTextDisplayRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
            const nameTextBoxRef: RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
            const valueTextDisplayRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
            const valueTextBoxRef: RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);

            const getSubPropertyPathFromType = (type: KeysOfUnion<(typeof treeEditorIcons)[keyof typeof treeEditorIcons]>): string[] => {
                switch (type) {
                    case "byteArray":
                    case "shortArray":
                    case "intArray":
                    case "longArray":
                    case "list":
                    case "object":
                    case "compound":
                    case "boolean":
                    case "number": {
                        return [];
                    }
                    case "string": {
                        switch (this.props.dataStorageObject.dataType) {
                            case "NBTCompound":
                            case "NBT": {
                                return ["value"];
                            }
                            case "JSON": {
                                return [];
                            }
                        }
                        break;
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

            useEffect((): (() => void) => {
                const dataStorageObject: TreeEditorDataStorageObject = this.props.dataStorageObject;
                function onNodeNameChange(_event: Event): void {
                    if (!nameTextBoxRef.current) return;
                    nameTextBoxRef.current.classList.remove("visible");
                    if (nameTextBoxRef.current.defaultValue === nameTextBoxRef.current.value) return;
                    // console.log(_event);
                    const parentObject: any = props.propertyPath
                        .slice(0, -1)
                        .reduce((value: any, property: string): any => value?.[property], dataStorageObject.data);
                    if (!(nameTextBoxRef.current.defaultValue in parentObject)) return;
                    if (nameTextBoxRef.current.value in parentObject) {
                        // TO-DO: Add a popup warning to config if they want to overwrite the property with the same name.
                        console.error("Property name already exists");
                        return;
                    }
                    parentObject[nameTextBoxRef.current.value] = parentObject[nameTextBoxRef.current.defaultValue];
                    delete parentObject[nameTextBoxRef.current.defaultValue];
                    // console.log(5);
                    const parentExpansionDataObject = props.propertyPath
                        .slice(0, -1)
                        .reduce(
                            (
                                value: { data?: Record<string, any>; value?: boolean } | undefined,
                                property: string
                            ): { data?: Record<string, any>; value?: boolean } | undefined => (!value ? undefined : value.data?.[property]),
                            dataStorageObject.treeEditor.expansionData ?? {}
                        );
                    if (parentExpansionDataObject?.data !== undefined && parentExpansionDataObject.data[nameTextBoxRef.current.defaultValue] !== undefined) {
                        parentExpansionDataObject.data[nameTextBoxRef.current.value] = parentExpansionDataObject.data[nameTextBoxRef.current.defaultValue];
                        delete parentExpansionDataObject.data[nameTextBoxRef.current.defaultValue];
                    }
                    onValueChange?.(dataStorageObject, {
                        propertyPath: [...props.propertyPath.slice(0, -1), nameTextBoxRef.current.value],
                        type: "changeName",
                        previousName: nameTextBoxRef.current.defaultValue,
                        newName: nameTextBoxRef.current.value,
                    });
                    // console.log(6);
                }
                function onNodeValueChange(_event: Event): void {
                    if (!valueTextBoxRef.current) return;
                    valueTextBoxRef.current.classList.remove("visible");
                    if (valueTextBoxRef.current.defaultValue === valueTextBoxRef.current.value) return;
                    const actualPath: string[] = [...props.propertyPath, ...getSubPropertyPathFromType(type)];
                    const parentObject: any = actualPath.slice(0, -1).reduce((value: any, property: string): any => value?.[property], dataStorageObject.data);
                    let newValue: string | boolean | number | bigint | [number, number];
                    function getPrimitiveTypeFromType(
                        type: KeysOfUnion<(typeof treeEditorIcons)[keyof typeof treeEditorIcons]>
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
                            default:
                                return "never";
                        }
                    }
                    switch (getPrimitiveTypeFromType(type)) {
                        case "string":
                            newValue = valueTextBoxRef.current.value;
                            break;
                        case "bigint":
                            try {
                                newValue = BigInt(valueTextBoxRef.current.value);
                            } catch (e) {
                                // TO-DO: Add a popup warning that they entered invalid input.
                                console.error(e);
                                return;
                            }
                            break;
                        case "number":
                            newValue = Number(valueTextBoxRef.current.value);
                            if (isNaN(newValue)) {
                                // TO-DO: Add a popup warning that they entered invalid input.
                                console.error("Invalid number input, result is NaN.");
                                return;
                            }
                            break;
                        case "boolean":
                            newValue = valueTextBoxRef.current.value.toLowerCase() === "true";
                            break;
                        case "longInArrayForm":
                            try {
                                newValue = toLongParts(BigInt(valueTextBoxRef.current.value));
                            } catch (e) {
                                // TO-DO: Add a popup warning that they entered invalid input.
                                console.error(e);
                                return;
                            }
                            break;
                        case "never":
                            // TO-DO: Add a popup warning that something went wrong.
                            console.error(`Error saving new node value, value type ${JSON.stringify(type)} is not allowed to have its value directly edited.`);
                            return;
                    }
                    parentObject[actualPath.at(-1)!] = newValue;
                    onValueChange?.(dataStorageObject, {
                        propertyPath: actualPath.slice(0, -1),
                        type: "changeValue",
                        previousValue: valueTextBoxRef.current.defaultValue,
                        newValue: valueTextBoxRef.current.value,
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
                    } else if (
                        nameTextBoxRef.current &&
                        nameTextBoxRef.current.classList.contains("visible") &&
                        !nameTextBoxRef.current.contains(event.target as Node)
                    ) {
                        event.preventDefault();
                        nameTextBoxRef.current.classList.remove("visible");
                        nameTextBoxRef.current.value = nameTextBoxRef.current.defaultValue;
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
                    } else if (
                        valueTextBoxRef.current &&
                        valueTextBoxRef.current.classList.contains("visible") &&
                        !valueTextBoxRef.current.contains(event.target as Node)
                    ) {
                        event.preventDefault();
                        valueTextBoxRef.current.classList.remove("visible");
                        valueTextBoxRef.current.value = valueTextBoxRef.current.defaultValue;
                        // console.log(59);
                    }
                }
                if (!editorIsReadonly) {
                    window.addEventListener("dblclick", onDblClick);
                    if (nameTextBoxRef.current) {
                        nameTextBoxRef.current.addEventListener("change", onNodeNameChange);
                        nameTextBoxRef.current.dispatchEvent(new Event("input"));
                    }
                    if (valueTextBoxRef.current) {
                        valueTextBoxRef.current.addEventListener("change", onNodeValueChange);
                        valueTextBoxRef.current.dispatchEvent(new Event("input"));
                    }
                }
                return (): void => {
                    if (!editorIsReadonly) {
                        window.removeEventListener("dblclick", onDblClick);
                        if (nameTextBoxRef.current) nameTextBoxRef.current.removeEventListener("change", onNodeNameChange);
                        if (valueTextBoxRef.current) valueTextBoxRef.current.removeEventListener("change", onNodeValueChange);
                    }
                };
            });
            const value: NBTTreeNodeValue | JSONTreeNodeValue = props.propertyPath.reduce(
                (value: any, property: string): any => value[property],
                this.props.dataStorageObject.data
            );
            if (value === undefined) {
                console.warn("No value found for property path", props.propertyPath, "in data", this.props.dataStorageObject.data);
                return;
            }
            let type: KeysOfUnion<(typeof treeEditorIcons)[keyof typeof treeEditorIcons]>;
            let isDirectType: boolean = false;
            function fakeAssertIsNBTNodeTreeNodeValue(value: any): asserts value is NBTTreeNodeValue {}
            function fakeAssertIsJSONNodeTreeNodeValue(value: any): asserts value is Exclude<JSONTreeNodeValue, NBT.Tags[NBT.TagType]> {}
            switch (this.props.dataStorageObject.dataType) {
                case "NBTCompound":
                case "NBT": {
                    fakeAssertIsNBTNodeTreeNodeValue(value);
                    if (Array.isArray(value)) {
                        // console.log(3);
                        const parentParentValue: NBT.List<NBT.TagType> = props.propertyPath
                            .slice(0, -2)
                            .reduce((value: any, property: string): any => value[property], this.props.dataStorageObject.data);
                        if (parentParentValue.type === NBT.TagType.List) {
                            // console.log(4);
                            const parentValue: NBT.List<NBT.TagType>["value"] = props.propertyPath
                                .slice(0, -1)
                                .reduce((value: any, property: string): any => value[property], this.props.dataStorageObject.data);
                            type = parentValue.type;
                        } else {
                            // console.log(4.1);
                            const parentValue: NBT.ByteArray | NBT.ShortArray | NBT.IntArray | NBT.LongArray | NBT.Long = props.propertyPath
                                .slice(0, -1)
                                .reduce((value: any, property: string): any => value[property], this.props.dataStorageObject.data);
                            type =
                                parentValue.type === "byteArray"
                                    ? "byte"
                                    : parentValue.type === "shortArray"
                                    ? "short"
                                    : parentValue.type === "intArray"
                                    ? "int"
                                    : parentValue.type === "longArray"
                                    ? "long"
                                    : parentValue.type;
                            isDirectType =
                                parentValue.type === "byteArray" ||
                                parentValue.type === "shortArray" ||
                                parentValue.type === "intArray" ||
                                parentValue.type === "longArray"
                                    ? true
                                    : isDirectType;
                        }
                    } else if (
                        typeof value === "object" &&
                        value !== null &&
                        !Array.isArray(
                            props.propertyPath.slice(0, -1).reduce((value: any, property: string): any => value[property], this.props.dataStorageObject.data)
                        )
                    ) {
                        // console.log(5);
                        type = value.type;
                    } else {
                        // console.log(6);
                        const parentParentParentValue: NBT.List<NBT.TagType> = props.propertyPath
                            .slice(0, -3)
                            .reduce((value: any, property: string): any => value[property], this.props.dataStorageObject.data);
                        // console.log(parentParentParentValue);
                        if (parentParentParentValue.type === NBT.TagType.List) {
                            // console.log(7);
                            const parentParentValue: NBT.List<NBT.TagType>["value"] = props.propertyPath
                                .slice(0, -2)
                                .reduce((value: any, property: string): any => value[property], this.props.dataStorageObject.data);
                            type = parentParentValue.type;
                            isDirectType = true;
                        } else {
                            // console.log(8);
                            const parentParentValue: NBT.ByteArray | NBT.ShortArray | NBT.IntArray | NBT.LongArray | NBT.Long = props.propertyPath
                                .slice(0, -2)
                                .reduce((value: any, property: string): any => value[property], this.props.dataStorageObject.data);
                            type =
                                parentParentValue.type === "byteArray"
                                    ? "byte"
                                    : parentParentValue.type === "shortArray"
                                    ? "short"
                                    : parentParentValue.type === "intArray"
                                    ? "int"
                                    : parentParentValue.type === "longArray"
                                    ? "long"
                                    : parentParentValue.type;
                            isDirectType =
                                parentParentValue.type === "byteArray" ||
                                parentParentValue.type === "shortArray" ||
                                parentParentValue.type === "intArray" ||
                                parentParentValue.type === "longArray"
                                    ? true
                                    : isDirectType;
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
            }
            // console.log(props, type, value);
            const hasChildren: boolean = (["byteArray", "shortArray", "intArray", "longArray", "compound", "list", "object"] as (typeof type)[]).includes(type);
            let childrenCount: number = 0;
            if (hasChildren) {
                switch (type) {
                    case "byteArray":
                    case "shortArray":
                    case "intArray":
                    case "longArray": {
                        const value2: NBT.ByteArray | NBT.ShortArray | NBT.IntArray | NBT.LongArray = value as any;
                        childrenCount = value2.value.length;
                        break;
                    }
                    case "list": {
                        if (this.props.dataStorageObject.dataType === "JSON") {
                            const value2: JSONTreeNodeValue[] = value as any;
                            childrenCount = value2.length;
                            break;
                        }
                        const value2: NBT.List<NBT.TagType> | NBT.List<NBT.TagType>["value"] = value as any;
                        childrenCount = (isDirectType ? (value2 as NBT.List<NBT.TagType>["value"]).value : (value2 as NBT.List<NBT.TagType>).value.value)
                            .length;
                        break;
                    }
                    case "compound": {
                        const value2: NBT.Compound | NBT.Compound["value"] = value as any;
                        childrenCount = Object.keys(isDirectType ? (value2 as NBT.Compound["value"]) : (value2 as NBT.Compound).value).length;
                        break;
                    }
                    case "object": {
                        const value2: Exclude<Extract<JSONTreeNodeValue, object>, any[]> = value as any;
                        childrenCount = Object.keys(value2).length;
                        break;
                    }
                }
            }
            const getChildren = (): JSX.SpecificElement<"div">[] | undefined => {
                let children: JSX.SpecificElement<"div">[] | undefined = undefined;
                if (hasChildren) {
                    switch (type) {
                        case "byteArray":
                        case "shortArray":
                        case "intArray":
                        case "longArray": {
                            const value2: NBT.ByteArray | NBT.ShortArray | NBT.IntArray | NBT.LongArray = value as any;
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
                                const value2: JSONTreeNodeValue[] = value as any;
                                children = value2.map((_value: JSONTreeNodeValue, index: number): JSX.SpecificElement<"div"> => {
                                    return (
                                        <div class="treeEditorTreeNodeChild">
                                            <TreeNode propertyPath={props.propertyPath.concat([index.toString()])} depth={props.depth + 1} />
                                        </div>
                                    );
                                });
                                break;
                            }
                            const value2: NBT.List<NBT.TagType> | NBT.List<NBT.TagType>["value"] = value as any;
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
                            const value2: NBT.Compound | NBT.Compound["value"] = value as any;
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
                            const value2: Exclude<Extract<JSONTreeNodeValue, object>, any[]> = value as any;
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
                    }
                }
                return children;
            };
            let expanded: boolean =
                hasChildren &&
                props.propertyPath.reduce(
                    (
                        value: { data?: Record<string, any>; value?: boolean } | boolean,
                        property: string,
                        index: number,
                        array: string[]
                    ): { data?: Record<string, any>; value?: boolean } | boolean =>
                        !value
                            ? false
                            : value === true || (index === array.length - 1 ? value.data?.[property]?.value ?? false : value.data?.[property] ?? false),
                    this.props.dataStorageObject.treeEditor.expansionData ?? {}
                ) === true;
            let displayValue: string | undefined = undefined;
            switch (type) {
                case "byteArray":
                case "shortArray":
                case "intArray":
                case "longArray":
                case "list":
                case "object":
                case "compound": {
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
                            displayValue = (value as NBT.String).value;
                            break;
                        }
                        case "JSON": {
                            displayValue = value as string;
                            break;
                        }
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
            }
            // console.log(displayValue, value, type, expanded, props);
            const children = expanded ? getChildren() : undefined;
            const childrenRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
            return (
                <div class="treeEditorTreeNode" ref={props.containerRef}>
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
                                    if (firstSelection !== event.currentTarget || lastSelection !== event.currentTarget) {
                                        const elements: HTMLDivElement[] = $(outerContainerElementRef.current)
                                            .find<HTMLDivElement>(".treeEditorTreeNodeHeader")
                                            .toArray();
                                        $(elements.slice(elements.indexOf(firstSelection), elements.indexOf(lastSelection) + 1)).addClass("selected");
                                    }
                                } else {
                                    $(outerContainerElementRef.current)
                                        .find<HTMLDivElement>(".treeEditorTreeNodeHeader.selected")
                                        .not(event.currentTarget)
                                        .removeClass("selected");
                                    event.currentTarget.classList.add("selectionStart");
                                }
                            }
                        }}
                        data-path={JSON.stringify(props.propertyPath)}
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
                                        props.propertyPath.reduce(
                                            (
                                                value: { data?: Record<string, any>; value?: boolean } | boolean,
                                                property: string,
                                                index: number,
                                                array: string[]
                                            ): { data?: Record<string, any>; value?: boolean } | boolean => {
                                                if (typeof value === "boolean") {
                                                    return value;
                                                }
                                                value["data"] ??= {};
                                                if (index === array.length - 1) {
                                                    value["data"][property] ??= { data: {} };
                                                    value["data"][property]["value"] = expanded;
                                                    return value["data"][property]["value"];
                                                }
                                                return (value["data"][property] ??= { data: {} });
                                            },
                                            this.props.dataStorageObject.treeEditor.expansionData
                                        );
                                        if (expanded) {
                                            // let tempElement: HTMLDivElement = document.createElement("div");
                                            childrenRef.current && render(null, childrenRef.current);
                                            childrenRef.current && render(getChildren(), childrenRef.current /* tempElement */);
                                            // childrenRef.current?.replaceChildren(...tempElement.children);
                                            event.currentTarget.querySelector("img")?.setAttribute("src", treeEditorIcons.generic.arrowExpanded);
                                        } else {
                                            childrenRef.current && render(null, childrenRef.current);
                                            // childrenRef.current?.replaceChildren();
                                            event.currentTarget.querySelector("img")?.setAttribute("src", treeEditorIcons.generic.arrowCollapsed);
                                        }
                                    }}
                                >
                                    <img aria-hidden="true" src={treeEditorIcons.generic[expanded ? "arrowExpanded" : "arrowCollapsed"]} />
                                </div>
                            )}
                        </div>
                        <div class="treeEditorTreeNodeHeaderIcon">
                            <img
                                aria-hidden="true"
                                src={treeEditorIcons[treeEditorDataTypeToIconTypeMapping[this.props.dataStorageObject.dataType]][type as never] ?? type}
                            />
                        </div>
                        {props.name && (
                            <>
                                <div
                                    class="treeEditorTreeNodeHeaderName"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                                        if (event.shiftKey) return;
                                    }}
                                    ref={nameTextDisplayRef}
                                >
                                    {props.name}
                                </div>
                                {!editorIsReadonly && (
                                    <>
                                        <input
                                            type="text"
                                            class="treeEditorTreeNodeHeaderNameTextBox"
                                            autoCapitalize="off"
                                            autoCorrect="false"
                                            spellcheck={false}
                                            inputMode={
                                                (["byte", "short", "int", "long"] as (typeof type)[]).includes(type)
                                                    ? "numeric"
                                                    : (["float", "double"] as (typeof type)[]).includes(type)
                                                    ? "decimal"
                                                    : "text" // Type number uses text input mode because it needs to allow for exponentional notation.
                                            }
                                            value={props.name}
                                            defaultValue={props.name}
                                            placeholder={props.name}
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
                                        <div class="treeEditorTreeNodeHeaderNameTextBoxSizeGetter">{props.name}</div>
                                    </>
                                )}
                            </>
                        )}
                        {!hasChildren && (
                            <>
                                {props.name && <div class="treeEditorTreeNodeHeaderNameAndValueSeparator">{": "}</div>}
                                <div
                                    class="treeEditorTreeNodeHeaderValue"
                                    onClick={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                                        if (event.shiftKey) return;
                                    }}
                                    ref={valueTextDisplayRef}
                                >
                                    {displayValue}
                                </div>
                                {!editorIsReadonly && (
                                    <>
                                        <input
                                            type="text"
                                            class="treeEditorTreeNodeHeaderValueTextBox"
                                            autoCapitalize="off"
                                            autoCorrect="false"
                                            spellcheck={false}
                                            inputMode={
                                                (["byte", "short", "int", "long"] as (typeof type)[]).includes(type)
                                                    ? "numeric"
                                                    : (["float", "double"] as (typeof type)[]).includes(type)
                                                    ? "decimal"
                                                    : "text" // Type number uses text input mode because it needs to allow for exponentional notation.
                                            }
                                            value={displayValue}
                                            defaultValue={displayValue}
                                            placeholder={displayValue}
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
                                {props.name && ": "}
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
            default:
                return <p>Unknown data type: {"dataType" in this.state ? JSON.stringify((this.state as any).dataType) : JSON.stringify(this.state)}</p>;
        }
    }
}
