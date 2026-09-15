import mergeRefs from "merge-refs";
import type { JSX, RefObject } from "preact";
import { createRef, render, useRef } from "preact/compat";

/**
 * A registered widget in the {@link EditorWidgetOverlayBar}.
 */
export interface EditorWidgetOverlayBarRegisteredWidget {
    /**
     * The JSX element of the widget.
     */
    widget: JSX.Element;
    /**
     * The ID of the widget.
     */
    id: string;
    /**
     * The index of the widget.
     */
    index: number;
    /**
     * The ref of the rendered widget.
     */
    ref: RefObject<HTMLDivElement>;
}

/**
 * A registry for widgets in the {@link EditorWidgetOverlayBar}.
 */
export interface EditorWidgetOverlayBarWidgetRegistry {
    /**
     * Returns the registered widgets.
     *
     * @returns The registered widgets.
     */
    getRegisteredWidgets(): EditorWidgetOverlayBarRegisteredWidget[];
    /**
     * Registers a widget.
     *
     * @param widget The JSX element of the widget.
     * @param id The ID of the widget.
     * @param index The index of the widget.
     * @param ref An optional ref to allow access to the rendered widget. If not provided, one will be created automatically and stored in the returned widget object.
     * @returns The registered widget.
     */
    registerWidget(widget: JSX.Element, id: string, index: number, ref?: RefObject<HTMLDivElement>): EditorWidgetOverlayBarRegisteredWidget;
    /**
     * Registers a list of widgets.
     *
     * @param widgets The widgets to register.
     * @returns The registered widgets.
     */
    registerWidgets(widgets: EditorWidgetOverlayBarRegisteredWidget[]): EditorWidgetOverlayBarRegisteredWidget[];
    /**
     * Unregisters a widget.
     *
     * If multiple widgets exist with the provided ID, they will all be removed.
     *
     * @param id The ID of the widget to unregister.
     */
    unregisterWidget(id: string): void;
    /**
     * Unregisters all widgets.
     */
    unregisterAllWidgets(): void;
}

/**
 * Props for the {@link EditorWidgetOverlayBar} component.
 */
export interface EditorWidgetOverlayBarProps {
    /**
     * The children of the component.
     */
    children: JSX.Element | JSX.Element[];
    /**
     * A ref used to access the {@link EditorWidgetOverlayBarWidgetRegistry | widget registry}.
     */
    widgetRegistryRef?: RefObject<EditorWidgetOverlayBarWidgetRegistry>;
    /**
     * A ref used to access the outer container element of the component.
     */
    barContainerRef?: RefObject<HTMLDivElement>;
    /**
     * The className of the outer container.
     *
     * @default "widget-overlay-bar widget-overlay-bar-transparent"
     */
    className?: string;
}

/**
 * An editor widget overlay bar.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function EditorWidgetOverlayBar(props: EditorWidgetOverlayBarProps): JSX.Element {
    const barContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const registeredWidgets: EditorWidgetOverlayBarRegisteredWidget[] = [];
    const onBarContainerRenderCallbacks: (() => void)[] = [];
    if (props.widgetRegistryRef) {
        props.widgetRegistryRef.current = {
            getRegisteredWidgets(): EditorWidgetOverlayBarRegisteredWidget[] {
                return registeredWidgets;
            },
            registerWidget(widget: JSX.Element, id: string, index: number, ref?: RefObject<HTMLDivElement>): EditorWidgetOverlayBarRegisteredWidget {
                if (registeredWidgets.some((registeredWidget: EditorWidgetOverlayBarRegisteredWidget): boolean => registeredWidget.id === id)) {
                    registeredWidgets
                        .filter((registeredWidget: EditorWidgetOverlayBarRegisteredWidget): boolean => registeredWidget.id === id)
                        .forEach((registeredWidget: EditorWidgetOverlayBarRegisteredWidget): void => {
                            registeredWidget.ref.current?.remove();
                            if (registeredWidgets.includes(registeredWidget)) registeredWidgets.splice(registeredWidgets.indexOf(registeredWidget), 1);
                        });
                }
                const registeredWidget = { widget, id, index, ref: ref ?? createRef<HTMLDivElement>() };
                registeredWidgets.splice(index, 0, registeredWidget);
                const tempElement: HTMLDivElement = document.createElement("div");
                render(<div class="widget-overlay-bar-widget-container" data-widget-id={id} ref={registeredWidget.ref}></div>, tempElement);
                const innerTempElement: HTMLDivElement = tempElement.children[0]! as HTMLDivElement;
                render(widget, innerTempElement);
                if (barContainerRef.current) {
                    if (registeredWidgets.includes(registeredWidget)) {
                        barContainerRef.current.insertBefore(
                            tempElement.children[0]!,
                            barContainerRef.current.children[registeredWidgets.indexOf(registeredWidget)]?.nextSibling ?? null
                        );
                    }
                } else {
                    onBarContainerRenderCallbacks.push((): void => {
                        if (registeredWidgets.includes(registeredWidget)) {
                            barContainerRef.current?.insertBefore(
                                tempElement.children[0]!,
                                barContainerRef.current.children[registeredWidgets.indexOf(registeredWidget)]?.nextSibling ?? null
                            );
                        }
                    });
                }
                return registeredWidget;
            },
            registerWidgets(widgets: EditorWidgetOverlayBarRegisteredWidget[]): EditorWidgetOverlayBarRegisteredWidget[] {
                const newlyRegisteredWidgets: EditorWidgetOverlayBarRegisteredWidget[] = [];
                for (const widget of [...widgets].sort(
                    (a: EditorWidgetOverlayBarRegisteredWidget, b: EditorWidgetOverlayBarRegisteredWidget): number => a.index - b.index
                )) {
                    newlyRegisteredWidgets.push(this.registerWidget(widget.widget, widget.id, widget.index, widget.ref));
                }
                return newlyRegisteredWidgets;
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
