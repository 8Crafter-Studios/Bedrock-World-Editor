import type { JSX } from "preact";
import { INTEGRATION_BUTTON_LINK_ALLOWED_UNPROMPTED_PROTOCOLS, INTEGRATION_BUTTON_LINK_WEBSITE_PROTOCOLS } from "../constants";
import { dialog, shell, clipboard, app } from "@electron/remote";
import type { LinkData } from "..";

export default function LinkButton(props: LinkData): JSX.Element {
    const { linkType, url, description, iconPath } = props
    const iconSize = 100
    
    function onClickFunction(): void {
        try {
            var parsedUri: URL | undefined = new URL(url);
        } catch {}
        if (parsedUri === undefined || !INTEGRATION_BUTTON_LINK_ALLOWED_UNPROMPTED_PROTOCOLS.includes(parsedUri.protocol)) {
            switch (
                dialog.showMessageBoxSync(getCurrentWindow(), {
                    type: "info",
                    title: "Bedrock World Editor",
                    message:
                        parsedUri === undefined ? "Do you want Bedrock World Editor to open the URI?"
                        : INTEGRATION_BUTTON_LINK_WEBSITE_PROTOCOLS.includes(parsedUri.protocol) ?
                            "Do you want Bedrock World Editor to open the external website?"
                        :   `Do you want Bedrock World Editor to open the URI in ${app.getApplicationNameForProtocol(url)}?`,
                    detail: url,
                    buttons: [
                        "Open",
                        "Copy",
                        // "Configure Trusted Domains", // IDEA: Implement a trusted domains config option.
                        "Cancel",
                    ],
                    noLink: true,
                })
            ) {
                case 0:
                    shell.openExternal(url);
                    break;
                case 1:
                    clipboard.writeText(url);
                    break;
            }
            return;
        }
        shell.openExternal(url);
    }

    return (
        <button
            type="button"
            class="genericRoundButton"
            title={description}
            onClick={onClickFunction}
        >
            <div>
                {linkType}
            </div>
            <div>
                {iconPath && <img src={iconPath} alt="" style={{ width: iconSize, height: iconSize }} />}
            </div>
        </button>
    );
}

