/* eslint-disable import/no-unresolved */
import "./index.css";
import "overlayscrollbars/overlayscrollbars.css";
import "../src/libs/@szhsin/react-menu/index.css";
import "../src/libs/@szhsin/react-menu/core.css";
import "../src/importjQueryUtils.ts";
import { render } from "preact";
import App from "./app.tsx";
import "jquery";
// #DEBUG
// @ts-expect-error
globalThis.mcbeLeveldbUri = (() => import("mcbe-leveldb")).toString().split('"')[1];

declare module "preact" {
    namespace JSX {
        interface SpecificElement<
            V extends keyof JSX.IntrinsicElements | HTMLAttributes<any>,
            P = V extends keyof IntrinsicElements ? IntrinsicElements[V] : V,
            T = P extends HTMLAttributes<infer T> ? T : never
        > extends VNode<ClassAttributes<T> & P> {}
        interface OnlyVisibleOnThemesHTMLAttributes<T extends EventTarget = HTMLUnknownElement> extends HTMLAttributes<T> {
            /**
             * Whether the contents of the element should be visible when the current theme is light.
             *
             * @default false
             */
            light?: boolean;
            /**
             * Whether the contents of the element should be visible when the current theme is dark.
             *
             * @default false
             */
            dark?: boolean;
            /**
             * Whether the contents of the element should be visible when the current theme is blue.
             *
             * @default false
             */
            blue?: boolean;
        }
        interface IntrinsicElements {
            /**
             * A custom element used to make the elements inside of it only show when the current theme is one of the specified themes.
             */
            only_visible_on_themes: OnlyVisibleOnThemesHTMLAttributes<HTMLUnknownElement> /* 
            ItemListItemColumn: HTMLAttributes<HTMLDivElement> & ItemListItemColumnOptions; */;
            /**
             * The deprecated HTML center element.
             */
            center: HTMLAttributes<HTMLElement>;
            "purple-border_background": {
                children?: any[] | any;
            };
        }
        interface InputHTMLAttributes {
            inputmode?: Signalish<LooseAutocomplete<"decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url"> | undefined>;
            inputMode?: Signalish<LooseAutocomplete<"decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url"> | undefined>;
        }
    }
}

class PurpleBorderBackgroundElement extends HTMLElement {
    public constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot!.innerHTML = `
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceL.png" style="height: calc(100% - 1.75vw); width: 1vw; left: 0px; top: 0.875vw; z-index: -5;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceR.png" style="height: calc(100% - 1.75vw); width: 1vw; right: 0px; top: 0.875vw; z-index: -5;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceT.png" style="height: 1vw; width: calc(100% - 1.75vw); left: 0.875vw; top: 0px; z-index: -5;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceB.png" style="height: 1vw; width: calc(100% - 1.75vw); left: 0.875vw; bottom: 0px; z-index: -5;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceTL.png" style="height: 1vw; width: 1vw; left: 0px; top: 0px; z-index: -4;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceTR.png" style="height: 1vw; width: 1vw; right: 0px; top: 0px; z-index: -4;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceBL.png" style="height: 1vw; width: 1vw; left: 0px; bottom: 0px; z-index: -4;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceBR.png" style="height: 1vw; width: 1vw; right: 0px; bottom: 0px; z-index: -4;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceC.png" style="height: calc(100% - 1.75vw); width: calc(100% - 1.75vw); right: 0.875vw; bottom: 0.875vw; z-index: -6;
    position: absolute; image-rendering: pixelated;">
    <slot></slot>`;
    }
}

customElements.define("purple-border_background", PurpleBorderBackgroundElement);

render(<App />, document.getElementById("app")!);

// console.log(document.getElementById("app"));

