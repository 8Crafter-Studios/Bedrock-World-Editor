import mergeRefs from "merge-refs";
import type { JSX, RefObject } from "preact";
import { createRef, render, useRef } from "preact/compat";

export interface EditorWidgetOverlayBarRegisteredWidget {
    widget: JSX.Element;
    id: string;
    index: number;
    ref: RefObject<HTMLDivElement>;
}

export interface EditorWidgetOverlayBarWidgetRegistry {
    getRegisteredWidgets(): EditorWidgetOverlayBarRegisteredWidget[];
    registerWidget(widget: JSX.Element, id: string, index: number, ref?: RefObject<HTMLDivElement>): void;
    registerWidgets(widgets: EditorWidgetOverlayBarRegisteredWidget[]): void;
    unregisterWidget(id: string): void;
    unregisterAllWidgets(): void;
}

export interface EditorWidgetOverlayBarProps {
    children: JSX.Element | JSX.Element[];
    widgetRegistryRef?: RefObject<EditorWidgetOverlayBarWidgetRegistry>;
    barContainerRef?: RefObject<HTMLDivElement>;
    /**
     * The className of the outer container.
     *
     * @default "widget-overlay-bar widget-overlay-bar-transparent"
     */
    className?: string;
}

export default function EditorWidgetOverlayBar(props: EditorWidgetOverlayBarProps): JSX.Element {
    const barContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const registeredWidgets: EditorWidgetOverlayBarRegisteredWidget[] = [];
    const onBarContainerRenderCallbacks: (() => void)[] = [];
    if (props.widgetRegistryRef) {
        props.widgetRegistryRef.current = {
            getRegisteredWidgets(): EditorWidgetOverlayBarRegisteredWidget[] {
                return registeredWidgets;
            },
            registerWidget(widget: JSX.Element, id: string, index: number, ref?: RefObject<HTMLDivElement>): void {
                if (registeredWidgets.some((registeredWidget: EditorWidgetOverlayBarRegisteredWidget): boolean => registeredWidget.id === id))
                    registeredWidgets
                        .filter((registeredWidget: EditorWidgetOverlayBarRegisteredWidget): boolean => registeredWidget.id === id)
                        .forEach((registeredWidget: EditorWidgetOverlayBarRegisteredWidget): void => {
                            registeredWidget.ref.current?.remove();
                            if (registeredWidgets.includes(registeredWidget)) registeredWidgets.splice(registeredWidgets.indexOf(registeredWidget), 1);
                        });
                const registeredWidget = { widget, id, index, ref: ref ?? createRef<HTMLDivElement>() };
                registeredWidgets.splice(index, 0, registeredWidget);
                let tempElement: HTMLDivElement = document.createElement("div");
                render(<div class="widget-overlay-bar-widget-container" data-widget-id={id} ref={registeredWidget.ref}></div>, tempElement);
                let innerTempElement: HTMLDivElement = tempElement.children[0]! as HTMLDivElement;
                render(widget, innerTempElement);
                if (barContainerRef.current) {
                    registeredWidgets.indexOf(registeredWidget) !== -1 &&
                        barContainerRef.current.insertBefore(
                            tempElement.children[0]!,
                            barContainerRef.current.children[registeredWidgets.indexOf(registeredWidget)]?.nextSibling ?? null
                        );
                } else {
                    onBarContainerRenderCallbacks.push((): void => {
                        registeredWidgets.indexOf(registeredWidget) !== -1 &&
                            barContainerRef.current?.insertBefore(
                                tempElement.children[0]!,
                                barContainerRef.current.children[registeredWidgets.indexOf(registeredWidget)]?.nextSibling ?? null
                            );
                    });
                }
            },
            registerWidgets(widgets: EditorWidgetOverlayBarRegisteredWidget[]): void {
                for (const widget of [...widgets].sort(
                    (a: EditorWidgetOverlayBarRegisteredWidget, b: EditorWidgetOverlayBarRegisteredWidget): number => a.index - b.index
                ))
                    this.registerWidget(widget.widget, widget.id, widget.index, widget.ref);
            },
            unregisterWidget(id: string): void {
                if (!registeredWidgets.some((registeredWidget: EditorWidgetOverlayBarRegisteredWidget): boolean => registeredWidget.id === id)) return;
                registeredWidgets
                    .filter((registeredWidget: EditorWidgetOverlayBarRegisteredWidget): boolean => registeredWidget.id === id)
                    .forEach((registeredWidget: EditorWidgetOverlayBarRegisteredWidget): void => {
                        if (registeredWidget.ref.current) render(null, registeredWidget.ref.current);
                        registeredWidget.ref.current?.remove();
                        if (registeredWidgets.includes(registeredWidget)) registeredWidgets.splice(registeredWidgets.indexOf(registeredWidget), 1);
                    });
            },
            unregisterAllWidgets(): void {
                registeredWidgets.forEach((registeredWidget: EditorWidgetOverlayBarRegisteredWidget): void => {
                    if (registeredWidget.ref.current) render(null, registeredWidget.ref.current);
                    registeredWidget.ref.current?.remove();
                    if (registeredWidgets.includes(registeredWidget)) registeredWidgets.splice(registeredWidgets.indexOf(registeredWidget), 1);
                });
            },
        };
    }
    return (
        <div
            className={props.className ?? "widget-overlay-bar widget-overlay-bar-transparent"}
            style="display: flex; flex-direction: row;"
            ref={mergeRefs(barContainerRef, props.barContainerRef)}
        >
            {/* TO-DO: Double check if passing an array directly here without "..." works as expected or not. */}
            <div className="widget-overlay-bar-widget-container" data-widget-id="__MAIN_WIDGET__">
                {props.children}
            </div>
        </div>
    );
}
