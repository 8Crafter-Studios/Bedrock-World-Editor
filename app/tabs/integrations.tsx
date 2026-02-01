import type { JSX, RefObject } from "preact";
import _React, { render, useRef } from "preact/compat";
import { integrations, type Integration } from "../integrations";

// DEBUG: This is to allow testing the functionality manually through the DevTools console.
// @ts-ignore: // TEMP
globalThis.integrations = integrations;
console.log(integrations);

export interface IntegrationsTabProps {
    tab: TabManagerTab;
}

export default function IntegrationsTab(props: IntegrationsTabProps): JSX.SpecificElement<"center"> {
    const tablesContainerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
    const viewOptionsRefs = {
        viewOptionsContainer: useRef<HTMLDivElement>(null),
        viewOptionsTabbedSelector: useRef<HTMLDivElement>(null),
    };
    type IntegrationsTabMode = "detected" | "undetected" | "loading";
    let mode: IntegrationsTabMode = "detected" as IntegrationsTabMode; // TEMP: This `as` statement is just temporary to prevent the errors about no overlap.
    const detectedAndUndetectedIntegrations: Record<"detected" | "undetected" | "loading", Integration[]> = {
        detected: [],
        undetected: [],
        loading: [],
    };
    function updateTablesContents(): void {
        if (!tablesContainerRef.current) return;
        render(null, tablesContainerRef.current);
        render(<TablesContents />, tablesContainerRef.current);
    }
    Object.values(integrations).forEach((integration: Integration): void => {
        const result: boolean | Promise<boolean> = integration.checkIfDetected(props.tab);
        if (typeof result === "boolean") return void detectedAndUndetectedIntegrations[result ? "detected" : "undetected"].push(integration);
        detectedAndUndetectedIntegrations.loading.push(integration);
        result.then((detected: boolean): void => {
            detectedAndUndetectedIntegrations[detected ? "detected" : "undetected"].push(integration);
            const index: number = detectedAndUndetectedIntegrations.loading.indexOf(integration);
            if (index !== -1) detectedAndUndetectedIntegrations.loading.splice(index, 1);
            if (
                mode === (detected ? "detected" : "undetected") ||
                (mode === "loading" && index !== -1) ||
                (mode !== "loading" &&
                    detectedAndUndetectedIntegrations.loading.length === 0 &&
                    index !== -1 &&
                    detectedAndUndetectedIntegrations[mode].length === 0)
            )
                updateTablesContents();
        });
    });
    function TablesContents(): JSX.SpecificElement<"div"> {
        const displayIntegrations: Integration[] = detectedAndUndetectedIntegrations[mode];
        return (
            <div style={{ display: "grid" }}>
                {...displayIntegrations.map((integration: Integration): JSX.Element => {
                    // TODO
                    return (
                        <button
                            type="button"
                            class="integrationsTabIntegrationButton"
                            onClick={(): void => {
                                console.warn(`[integrationsTab::integrationButton::${integration.id}] This button has not been implemented yet.`); // TEMP: This is just until this is implemented.
                            }}
                            title="This button has not been implemented yet." // TEMP: This is just until this is implemented.
                            disabled={true} // TEMP: This is just until this is implemented.
                        >
                            {integration.name}
                            {/* TODO: Add icon, author, and description. */}
                        </button>
                    );
                })}
                {displayIntegrations.length === 0 && (
                    <center>
                        {mode === "loading" ?
                            <h2>All integrations have finished checking for detection.</h2>
                        : detectedAndUndetectedIntegrations.loading.length ?
                            <h2>Loading integrations...</h2>
                        :   <h2>No {mode === "detected" ? "detected" : "undetected"} integrations.</h2>}
                    </center>
                )}
            </div>
        );
    }
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div
                class="widget-overlay-bar widget-overlay-bar-transparent"
                style="display: flex; flex-direction: row;"
                ref={viewOptionsRefs.viewOptionsContainer}
            >
                <div class="widget-overlay tabbed-selector" ref={viewOptionsRefs.viewOptionsTabbedSelector}>
                    <button
                        type="button"
                        class={mode === "detected" ? "selected" : ""}
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (event.currentTarget.classList.contains("selected")) return;
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            mode = "detected";
                            updateTablesContents();
                        }}
                    >
                        Detected
                    </button>
                    <button
                        type="button"
                        class={mode === "undetected" ? "selected" : ""}
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (event.currentTarget.classList.contains("selected")) return;
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            mode = "undetected";
                            updateTablesContents();
                        }}
                    >
                        Undetected
                    </button>
                    <button
                        type="button"
                        class={mode === "loading" ? "selected" : ""}
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (event.currentTarget.classList.contains("selected")) return;
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            mode = "loading";
                            updateTablesContents();
                        }}
                    >
                        Loading
                    </button>
                </div>
            </div>
            <div style="display: flex; flex-direction: column;" ref={tablesContainerRef}>
                <TablesContents />
            </div>
        </div>
    );
}
