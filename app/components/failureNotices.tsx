import type { JSX } from "preact";
import Notice from "./Notice";
import { stringifyError } from "../../src/utils/miscUtils";
import type { WorldEditorDataStorageObject } from "../tabs/worldEditor";

/**
 * A notice to show when an editor fails to render.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export function EditorRenderFailureNotice({
    reason,
    viewMode,
}: {
    reason: unknown;
    viewMode?: Extract<TabManagerSubTabCurrentState["options"], { viewMode?: any }>["viewMode"] | WorldEditorDataStorageObject["viewMode"] | undefined;
}): JSX.SpecificElement<"div"> {
    return (
        <div style="display: flex; width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1; flex-direction: column; align-items: center; justify-content: center;">
            <Notice
                title="Editor Render Error"
                subtitle={null}
                detail={`An error occurred while rendering the ${viewMode !== undefined ? `${JSON.stringify(viewMode)} ` : ""}editor.`}
                image="generic_error"
                style={{ height: "auto" }}
            />
            <div style={{ color: "red", fontFamily: "monospace", whiteSpace: "pre" }}>{stringifyError(reason)}</div>
        </div>
    );
}
