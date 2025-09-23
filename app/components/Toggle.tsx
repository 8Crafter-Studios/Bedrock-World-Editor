import type { JSX, RefObject } from "preact";

export interface ToggleProps extends JSX.HTMLAttributes<HTMLDivElement> {
    children?: never;
    onChange?: JSX.GenericEventHandler<HTMLInputElement>;
    label: string;
    description?: JSX.Element | JSX.Element[] | string;
    checked?: boolean;
    inputProperties?: JSX.InputHTMLAttributes<HTMLInputElement> & { [key: PropertyKey]: unknown };
    inputRef?: RefObject<HTMLInputElement>;
}

export default function Toggle(options: ToggleProps): JSX.SpecificElement<"div"> {
    return (
        <div
            class="mctogglecontainer nsel"
            onTouchStart={(): void => {}}
            onMouseDown={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                SoundEffects.popB();
                const element: HTMLInputElement = event.currentTarget.children[0] as HTMLInputElement;
                element.checked = !element.checked;
                element.dispatchEvent(new Event("change"));
            }}
            style="display: inline-block;"
        >
            <input type="checkbox" class="mctoggle" ref={options.inputRef} onChange={options.onChange} checked={options.checked} {...options.inputProperties} />
            <div class="mctoggleswitch"></div>
            <label>{options.label}</label>
            {options.description && (
                <>
                    <br />
                    {typeof options.description === "string" ? (
                        <div class="mctoggledescription">{options.description}</div>
                    ) : options.description instanceof Array ? (
                        options.description
                    ) : (
                        options.description
                    )}
                </>
            )}
        </div>
    );
}
