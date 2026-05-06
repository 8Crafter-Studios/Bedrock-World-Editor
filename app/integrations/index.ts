import type { JSX } from "preact";
import WorldEdit_Bedrock from "./WorldEdit_Bedrock";

/**
 * An integration.
 */
export interface Integration {
    /**
     * The ID of this integration.
     *
     * @example "WorldEdit_Bedrock"
     */
    readonly id: string;
    /**
     * The name of what this integration integrates with.
     *
     * This is rendered as plain text, not Markdown.
     *
     * @example "WorldEdit Bedrock"
     */
    readonly name: string;
    /**
     * The author or list of authors of what this integration integrates with.
     *
     * This is rendered as plain text, not Markdown.
     *
     * @example "SIsilicon"
     *
     * @example ["8Crafter", "StormStqr"]
     */
    readonly author: string | string[];
    /**
     * The description of this integration.
     *
     * This is rendered as plain text, not Markdown.
     *
     * @example "A port of the original WorldEdit mod for Minecraft: Java Edition."
     */
    readonly description: string;
    /**
     * Links for this integration.
     *
     * The property key is the button label.
     *
     * The button label is rendered as plain text, not Markdown.
     *
     * @default {}
     */
    readonly links?: {
        [buttonLabel: string]: {
            /**
             * The URI of the link.
             */
            url: string;
            /**
             * The description of the link.
             *
             * This is rendered as plain text, not Markdown.
             *
             * @default undefined
             */
            description?: string;
        };
    };
    /**
     * Actions for this integration that can be automatically applied to the provided tab if enabled by the user.
     *
     * @default []
     */
    readonly autoApplyActions?: IntegrationAutoApplyAction[];
    /**
     * Checks if this integration should show in the "Detected" section of the "Integrations" sidebar tab of the provided tab.
     *
     * @param tab The tab to check.
     * @returns A value or promise that resolves to `true` if this integration should show in the "Detected" section of the "Integrations" sidebar tab of the provided tab, `false` otherwise.
     *
     * @throws {unknown} If an error occurs.
     */
    checkIfDetected(tab: TabManagerTab): boolean | Promise<boolean>;
    /**
     * A JSX component that renders the integration menu for this integration in the integrations sidebar tab.
     *
     * @param props The props for the integration menu.
     * @returns The JSX element.
     */
    integrationMenu(props: IntegrationMenuProps): JSX.Element;
}

/**
 * An auto-apply action for an integration.
 */
export interface IntegrationAutoApplyAction {
    /**
     * The ID of this auto-apply action.
     *
     * @example "command_setbiome_legacy"
     */
    readonly id: string;
    /**
     * The name of this auto-apply action.
     *
     * This is rendered as plain text, not Markdown.
     *
     * @example "setbiome Command (Legacy Scoreboard Values)"
     */
    readonly name: string;
    /**
     * The description of this auto-apply action.
     *
     * This is rendered as plain text, not Markdown.
     *
     * @example "Applies biome changes from the setbiome command from when the WorldEdit Bedrock add-on saved the biome change data to the scoreboard."
     */
    readonly description: string;
    /**
     * Whether to wait for the world to load before running the {@link checkIfApplicable} method to check if this auto-apply action can be applied to the provided tab.
     */
    readonly waitToCheckUntilWorldLoaded: boolean;
    /**
     * Checks if this auto-apply action can be applied to the provided tab.
     *
     * @param tab The tab to check.
     * @returns A value or promise that resolves to `true` if this auto-apply action is applicable to the provided tab, `false` otherwise.
     *
     * @throws {unknown} If an error occurs.
     */
    checkIfApplicable(tab: TabManagerTab): boolean | Promise<boolean>;
    /**
     * Applies this auto-apply action to the provided tab.
     *
     * @param tab The tab to apply the auto-apply action to.
     * @returns A promise that resolves when the auto-apply action has been applied.
     *
     * @throws {unknown} If an error occurs.
     */
    apply(tab: TabManagerTab): Promise<void>;
}

/**
 * Props for {@link Integration.integrationMenu | integration menu} components.
 */
export interface IntegrationMenuProps {
    /**
     * The tab this integration menu is being rendered for.
     */
    tab: TabManagerTab;
    /**
     * Closes the integration menu.
     */
    closeIntegrationMenu(): void;
}

/**
 * All integrations.
 */
export const integrations = {
    WorldEdit_Bedrock,
} as const satisfies Record<string, Integration>;

/**
 * A list of URI protocols that are allowed to be opened by clicking on an integration link button without prompting the user.
 */
export const INTEGRATION_BUTTON_LINK_ALLOWED_UNPROMPTED_PROTOCOLS: string[] = ["mailto:"];

/**
 * A list of URI protocols that are classified as website protocols so have a slightly different prompt.
 */
export const INTEGRATION_BUTTON_LINK_WEBSITE_PROTOCOLS: string[] = ["http:", "https:"];
