import type { JSX } from "preact";
import _React from "preact/compat";

export default function HomeTab(): JSX.SpecificElement<"h1"> {
    return (
        <center>
            <div
                class="nsel ndrg customizer-version-text-container version-text-container"
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    padding: "calc((1px * 3) - 1px) calc((1px * 3) - 1px) calc((1px * 3) - 1px) 1px",
                    color: "#FFFFFFFF",
                    fontSize: "calc(10px * max(var(--gui-scale), 2))",
                    letterSpacing: "calc((max(var(--gui-scale), 2) - 2) * 1px)",
                }}
            >
                <div
                    class="crispy customizer-version-text version-text"
                    style={{
                        transform: "translate(calc((max(var(--gui-scale), 2) - round(down, max(var(--gui-scale), 2), 2)) * 0.5px), 0)",
                    }}
                >
                    App: v{VERSION}
                </div>
            </div>
            {/* <h1>Home</h1> */}
            <img
                aria-hidden="true"
                class="nsel ndrg"
                src="resource://images/title_image.png"
                style={{
                    width: "min(55vw, 2048px)",
                    marginTop: "calc(min(15vw, ((1 / 8.75) * 100vw)) - ((56/2048) * 55vw))",
                }}
            />
        </center>
    );
}
