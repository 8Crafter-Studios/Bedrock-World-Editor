import type { JSX } from "preact";
import type { WorldEditor2DIntegrationMapImageItem, WorldEditor2D } from "../components/WorldEditor2D";
import { createObservable, type Observable, type ReadonlyObservable } from "../../src/utils/miscUtils";
import type { IntegrationWithOverlays } from ".";

voidTypes: {
    type _void_WorldEditor2D = typeof WorldEditor2D;
    break voidTypes;
}

/**
 * Options for rendering items in {@link IntegrationWorldEditor2DOverlay} instances.
 */
export interface IntegrationWorldEditor2DOverlayRenderItemOptions {
    /**
     * The dimension to render the items for.
     */
    dimension: number;
    /**
     * The current scale of the 2D world map.
     */
    currentScale: number;
}

/**
 * The load state of an {@link IntegrationWorldEditor2DOverlay}.
 */
export type IntegrationWorldEditor2DOverlayLoadState = "loaded" | "loading" | "error" | "no_data" | "not_loading" | "N/A";

/**
 * Data that is required to be loaded prior to loading the data for the overlay, and that should be passed to the load function.
 */
// OPTIMIZE: Implementing this will allow optimizing the code more.
export interface IntegrationWorldEditor2DOverlayRequiredData {
    /**
     * @todo This is not implemented yet.
     */
    levelDatStorageVersion?: boolean | undefined;
    /**
     * @todo This is not implemented yet.
     */
    isOldWorld?: boolean | undefined;
    /**
     * @todo This is not implemented yet.
     */
    dynamicProperties?: boolean | undefined;
    /**
     * @todo This is not implemented yet.
     */
    scoreboard?: boolean | undefined;
    /**
     * @todo This is not implemented yet.
     */
    dimensionNameIdTable?: boolean | undefined;
    /**
     * @todo This is not implemented yet.
     */
    biomeIdsTable?: boolean | undefined;
}

/**
 * An overlay from an integration for the {@link WorldEditor2D}.
 *
 * NOTE: If a `typeId` static property is not defined on the extending class, the constructor will throw an error.
 *
 * @template T The type of the items in the overlay.
 * @template M The type of the metadata for the rendered items for the overlay.
 *
 * @throws {Error} If the `typeId` static property is not defined on the extending class.
 */
export abstract class IntegrationWorldEditor2DOverlay<
    T extends object = object,
    M extends Omit<WorldEditor2DIntegrationMapImageItem["meta"], "overlay"> = Omit<WorldEditor2DIntegrationMapImageItem["meta"], "overlay">,
> {
    /**
     * The label for this overlay.
     */
    public abstract readonly label: string;
    /**
     * The namespaced ID for this overlay.
     */
    public readonly typeId: M["type"];
    /**
     * Gets the integration this overlay is associated with.
     */
    public abstract readonly integration: IntegrationWithOverlays;
    /**
     * The load state of this overlay.
     */
    protected readonly state: Observable<IntegrationWorldEditor2DOverlayLoadState> = createObservable("not_loading");
    /**
     * The load state of this overlay.
     */
    public readonly loadState: ReadonlyObservable<IntegrationWorldEditor2DOverlayLoadState> = this.state;
    /**
     * The currently loaded items for this overlay.
     */
    protected readonly items: T[] = [];
    /**
     * The currently loaded items for this overlay.
     */
    public readonly loadedItems: readonly T[] = this.items;
    protected constructor(
        /**
         * The tab this overlay is associated with.
         */
        protected readonly tab: TabManagerTab
    ) {
        if (new.target === IntegrationWorldEditor2DOverlay) throw new Error("Illegal constructor");

        const typeId: unknown = (new.target as { typeId?: unknown }).typeId;
        if (typeof typeId !== "string") throw new Error("Overlay must have a static typeId");
        this.typeId = typeId as M["type"];
    }
    /**
     * Whether the assets for this overlay have finished loading.
     */
    public abstract get assetsLoaded(): boolean;
    /**
     * Loads the data for this overlay.
     */
    public abstract loadData(): Promise<void>;
    /**
     * Unloads the data for this overlay.
     */
    public unloadData(): void {
        this.items.length = 0;
        this.state.set("not_loading");
    }
    /**
     * Renders the items for this overlay.
     *
     * @param options The options for rendering the items.
     * @returns The rendered items, or `false` if the items could not be rendered yet.
     */
    public renderItems(options: IntegrationWorldEditor2DOverlayRenderItemOptions): (WorldEditor2DIntegrationMapImageItem<this> & { meta: M })[] {
        return this.items.map((item: T): WorldEditor2DIntegrationMapImageItem<this> & { meta: M } => this.renderItem(item, options));
    }
    /**
     * Renders a single item for this overlay.
     *
     * @param item The item to render.
     * @param options The options for rendering the item.
     * @returns The rendered item.
     */
    public abstract renderItem(item: T, options: IntegrationWorldEditor2DOverlayRenderItemOptions): WorldEditor2DIntegrationMapImageItem<this> & { meta: M };
    /**
     * Renders the context menu contents for this overlay.
     *
     * This will be put inside of the `<MenuItem>` element.
     *
     * @param meta The metadata for the item.
     * @returns The context menu contents.
     */
    public abstract contextMenuContents(props: Record<"meta", WorldEditor2DIntegrationMapImageItem<this>["meta"] & M>): JSX.Element;
    /**
     * The data that is required to be loaded prior to loading the data for the overlay, and that should be passed to the load function.
     *
     * @todo This is not implemented yet.
     */
    public static readonly requiredData: IntegrationWorldEditor2DOverlayRequiredData = {};
}

/**
 * The constructor for an overlay from an integration for the {@link WorldEditor2D}.
 *
 * @see IntegrationWorldEditor2DOverlay
 */
export interface IntegrationWorldEditor2DOverlayConstructor<TypeId extends `integration_${string}:${string}` = `integration_${string}:${string}`> extends Omit<
    typeof IntegrationWorldEditor2DOverlay<object, Omit<WorldEditor2DIntegrationMapImageItem["meta"], "overlay"> & { type: TypeId }>,
    never
> {
    /**
     * Creates a new instance of an overlay from an integration for the {@link WorldEditor2D}.
     *
     * @param tab The tab this overlay is associated with.
     */
    new (tab: TabManagerTab): IntegrationWorldEditor2DOverlay;
    /**
     * The namespaced ID for this overlay.
     */
    readonly typeId: TypeId;
}
