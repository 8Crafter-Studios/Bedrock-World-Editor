import WorldEdit_Bedrock from "./WorldEdit_Bedrock";

export interface Integration {
    readonly id: string;
    readonly name: string;
    readonly author?: string | string[];
    readonly description: string;
    readonly links?: { [buttonLabel: string]: { url: string; description?: string } };
    readonly autoApplyActions?: IntegrationAutoApplyAction[];
}

export interface IntegrationAutoApplyAction {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly waitToCheckUntilWorldLoaded: boolean;
    checkIfApplicable(tab: TabManagerTab): boolean | Promise<boolean>;
    apply(tab: TabManagerTab): Promise<void>;
}

export const integrations = {
    WorldEdit_Bedrock,
} as const satisfies Record<string, Integration>;
