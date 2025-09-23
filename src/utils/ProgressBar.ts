/**
 * src/utils/ProgressBar.ts
 * @module
 * @description A file that defines the global ProgressBar class.
 * @supports Main, Preload, Renderer
 */
"use strict";

import { app as app_main, BrowserWindow as BrowserWindow_main, type BrowserWindowConstructorOptions } from "electron";
import ElectronProgressBar from "electron-progressbar";

let BrowserWindow: typeof Electron.CrossProcessExports.BrowserWindow = BrowserWindow_main;
BrowserWindow ??= require("@electron/remote").BrowserWindow as typeof import("@electron/remote").BrowserWindow;

let app: typeof Electron.CrossProcessExports.app = app_main;
app ??= require("@electron/remote").app as typeof import("@electron/remote").app;

// use 'extend' because 'Object.assign' doesn't work for deep copy
import extend from "extend";

namespace exports {
    export class ProgressBar implements Omit<ElectronProgressBar, "title" | "on" | "getOptions"> {
        public _defaultOptions: ProgressBarOptions;
        public _styleSelector: {
            determinate: {
                text: string;
                detail: string;
                bar: string;
                barPaused: string;
                barError: string;
                value: string;
                valuePaused: string;
                valueError: string;
            };
            indeterminate: { text: string; detail: string; bar: string; value: string };
        };
        public _callbacks: {
            ready: (() => void)[]; // a list of callbacks: function(){}
            progress: ((value: number) => void)[]; // a list of callbacks: function(value){}
            completed: ((value: number) => void)[]; // a list of callbacks: function(value){}
            aborted: ((value: number) => void)[];
        };
        public _inProgress: boolean;
        public _options: ProgressBarOptions;
        public _realValue: any;
        public _window: Electron.CrossProcessExports.BrowserWindow | null;
        public _manuallyCompleted: boolean = false;
        public progressBarMode: Electron.ProgressBarOptions["mode"] = "none";
        public completionEnabled: boolean;
        public constructor(options: ProgressBarOptions, electronApp?: typeof app) {
            this._defaultOptions = {
                abortOnError: false,
                debug: false,

                indeterminate: true,
                initialValue: 0,
                maxValue: 100,
                closeOnComplete: true,
                title: "Wait...",
                text: "Wait...",
                detail: null,
                lang: "",
                customHTML: "",
                completionEnabled: true,

                style: {
                    text: {},
                    detail: {},
                    bar: {
                        width: "100%",
                        background: "#BBE0F1",
                    },
                    barPaused: {
                        background: "#fffd80",
                    },
                    barError: {
                        background: "#ff8080",
                    },
                    value: {
                        background: "#0976A9",
                    },
                    valuePaused: {
                        background: "#9ea909",
                    },
                    valueError: {
                        background: "#a90909",
                    },
                },

                browserWindow: {
                    parent: null!,
                    modal: true,
                    resizable: false,
                    closable: false,
                    minimizable: false,
                    maximizable: false,
                    width: 500,
                    height: 170,
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false,
                    },
                },

                remoteWindow: null,
            };

            this._styleSelector = {
                determinate: {
                    text: "#text",
                    detail: "#detail",
                    bar: "#progressBar::-webkit-progress-bar",
                    barPaused: '#progressBar[mode="paused"]::-webkit-progress-bar',
                    barError: '#progressBar[mode="error"]::-webkit-progress-bar',
                    value: "#progressBar::-webkit-progress-value",
                    valuePaused: '#progressBar[mode="paused"]::-webkit-progress-value',
                    valueError: '#progressBar[mode="error"]::-webkit-progress-value',
                },
                indeterminate: {
                    text: "#text",
                    detail: "#detail",
                    bar: '#progressBar[indeterminate="t"]',
                    value: '#progressBar[indeterminate="t"] #progressBarValue',
                },
            };

            this._callbacks = {
                ready: [], // a list of callbacks: function(){}
                progress: [], // a list of callbacks: function(value){}
                completed: [], // a list of callbacks: function(value){}
                aborted: [], // a list of callbacks: function(value){}
            };

            this._inProgress = true;
            this._options = this._parseOptions(options);
            this._realValue = this._options.initialValue;
            this._window = null;
            this.completionEnabled = this._options.completionEnabled!;

            if (electronApp) {
                if (electronApp.isReady()) {
                    this._createWindow();
                } else {
                    electronApp.on("ready", () => this._createWindow.call(this));
                }
            } else {
                this._createWindow();
            }
        }

        public get value(): number {
            return this._options.indeterminate ? null! : this._realValue;
        }

        public set value(value: number) {
            if (!this._window) {
                this._error("Invalid call: trying to set value but the progress bar window is not active.");
            } else if (!this.isInProgress()) {
                this._error("Invalid call: trying to set value but the progress bar is already completed.");
            } else if (this._options.indeterminate) {
                this._error("Invalid call: setting value on an indeterminate progress bar is not allowed.");
            } else if (typeof value != "number") {
                this._error(`Invalid call: 'value' must be of type 'number' (type found: '` + typeof value + `').`);
            } else {
                this._realValue = Math.max(this._options.initialValue!, value);
                this._realValue = Math.min(this._options.maxValue!, this._realValue);

                this._window.webContents.send("SET_PROGRESS", this._realValue);

                this._updateTaskbarProgress();

                this._fire("progress", [this._realValue]);

                this._execWhenCompleted();
            }
        }

        public get maxValue(): number {
            return this._options.maxValue!;
        }

        public set maxValue(maxValue: number) {
            this._options.maxValue = maxValue;
            this._window!.webContents.send("SET_MAX", maxValue);
        }

        public get indeterminate(): boolean {
            return this._options.indeterminate!;
        }

        public set indeterminate(indeterminate: boolean) {
            if (indeterminate && (this.progressBarMode !== "indeterminate" || !this._options.indeterminate)) {
                this._options.indeterminate = indeterminate;
                this.setProgressBarMode("indeterminate");
            } else if (!indeterminate && (this.progressBarMode === "indeterminate" || this._options.indeterminate)) {
                this._options.indeterminate = indeterminate;
                this.progressBarMode === "indeterminate" ? this.setProgressBarMode("normal") : this.setProgressBarMode(this.progressBarMode);
            }
        }

        public get text(): string {
            return this._options.text!;
        }

        public set text(text: string) {
            this._options.text = text;
            this._window!.webContents.send("SET_TEXT", text);
        }

        public get detail(): string {
            return this._options.detail!;
        }

        public set detail(detail: string) {
            this._options.detail = detail;
            this._window!.webContents.send("SET_DETAIL", detail);
        }

        public get title(): string {
            if (this._window) {
                return this._window.getTitle();
            }
            return null!;
        }

        public set title(title: string) {
            if (this._window) {
                this._window.setTitle(title);
            }
        }

        public getOptions(): ProgressBarOptions {
            return extend({}, this._options);
        }

        public on(eventName: "ready" | "progress" | "completed" | "aborted", listener: () => void): this;
        public on(eventName: "progress" | "completed" | "aborted", listener: (value: number) => void): this;
        public on(event: keyof ProgressBar["_callbacks"], callback: ((value?: number) => void) | (() => void)): this {
            this._callbacks[event].push(callback);
            return this;
        }

        public setProgressBarMode(mode: Electron.ProgressBarOptions["mode"]): void {
            this._options.indeterminate = mode === "indeterminate";
            this.progressBarMode = mode;
            this._window?.setProgressBar(this._realValue, { mode });
            this._window?.webContents.send("SET_MODE", this.progressBarMode);
            this._updateTaskbarProgress();
        }

        public setCompleted(): void {
            if (!this.isInProgress()) {
                return;
            }

            this._realValue = this._options.maxValue;

            this._manuallyCompleted = true;

            if (!this._options.indeterminate) {
                if (this.progressBarMode === "none" || this.progressBarMode === "indeterminate") {
                    this.progressBarMode = "normal";
                }
                this._window!.webContents.send("SET_PROGRESS", this._realValue);
            }

            this._updateTaskbarProgress();

            this._execWhenCompleted();
        }

        public close(): void {
            if (!this._window || this._window.isDestroyed()) {
                return;
            }

            this._window.destroy();
        }

        public isInProgress(): boolean {
            return this._inProgress;
        }

        public isCompleted(): boolean {
            return this._manuallyCompleted || (this.completionEnabled && this._realValue >= this._options.maxValue!);
        }

        public _error(message: string): void {
            if (this._options.abortOnError) {
                if (this._window && !this._window.isDestroyed()) {
                    this._window && this._window.destroy();
                }

                throw Error(message);
            } else {
                console.warn(message);
            }
        }

        public _fire(event: keyof ProgressBar["_callbacks"], params?: [value?: number] | undefined): void {
            this._callbacks[event] &&
                this._callbacks[event].forEach((cb: (value: number) => void): void => {
                    cb.apply(cb, (params || []) as [number]);
                });
        }

        public _parseOptions(originalOptions: ProgressBarOptions): ProgressBarOptions {
            const options = extend(true, {}, this._defaultOptions, originalOptions);

            if (options.indeterminate) {
                options.initialValue = 0;
                options.maxValue = 100;
            }

            if (options.title && !options.browserWindow!.title) {
                options.browserWindow!.title = options.title;
            }

            return options;
        }

        public _parseStyle(): string {
            const style = [];
            const styleSelector = this._styleSelector[this._options.indeterminate ? "indeterminate" : "determinate"];

            (Object.keys(styleSelector) as (keyof typeof styleSelector)[]).forEach((el: keyof typeof styleSelector): void => {
                if (!styleSelector[el]) {
                    return;
                }

                style.push(`${styleSelector[el]}{`);
                for (const prop in this._options.style![el]) {
                    style.push(`${prop}:${this._options.style![el][prop as keyof NonNullable<ProgressBar["_options"]["style"]>[typeof el]]} !important;`);
                }
                style.push(`}`);
            });

            if (this._options.indeterminate) {
                if (this._options.style && this._options.style.value && this._options.style.value.background) {
                    style.push(`
                    .completed${this._styleSelector.indeterminate.bar},
                    .completed${this._styleSelector.indeterminate.value}{
                        background: ${this._options.style.value.background} !important;
                    }
                `);
                }
            }

            return style.join("");
        }

        public _createWindow(): void {
            if (this._options.remoteWindow) {
                this._window = new this._options.remoteWindow(this._options.browserWindow!);
            } else {
                this._window = new BrowserWindow(this._options.browserWindow!);
            }

            this._window.setMenu(null);

            if (this._options.debug) {
                this._window.webContents.openDevTools({ mode: "detach" });
            }

            this._window.on("closed", () => {
                this._inProgress = false;

                if (this._realValue < this._options.maxValue!) {
                    this._fire("aborted", [this._realValue]);
                }

                this._updateTaskbarProgress();

                this._window = null;
            });

            const langAttribute = this._options.lang ? `lang="${this._options.lang}"` : "";
            const $htmlContent = this._options.customHTML ? this._options.customHTML.replace(/<html ([^>]*)>/, "<html lang='{{REPLACE:LANG}}>") : htmlContent;
            this._window.loadURL("data:text/html;charset=UTF8," + encodeURIComponent($htmlContent.replace("{{REPLACE:LANG}}", langAttribute)));

            this._window.webContents.on("did-finish-load", () => {
                if (this._options.text !== null) {
                    this.text = this._options.text!;
                }

                if (this._options.detail !== null) {
                    this.detail = this._options.detail!;
                }

                this._window!.webContents.insertCSS(this._parseStyle());

                if (this._options.maxValue !== null) {
                    this._window!.webContents.send("CREATE_PROGRESS_BAR", {
                        indeterminate: this._options.indeterminate,
                        maxValue: this._options.maxValue,
                        mode: this.progressBarMode,
                    });
                }

                this._fire("ready");
            });

            this._updateTaskbarProgress();
        }

        _updateTaskbarProgress() {
            let mainWindow;

            if (this._options.browserWindow && this._options.browserWindow.parent) {
                mainWindow = this._options.browserWindow.parent;
            } else {
                mainWindow = this._window;
            }

            if (!mainWindow || mainWindow.isDestroyed()) {
                return;
            }

            if (!this.isInProgress() || this.isCompleted()) {
                // remove the progress bar from taskbar
                this.progressBarMode = "none";
                return mainWindow.setProgressBar(-1, { mode: "none" });
            }

            if (this._options.indeterminate) {
                // any number above 1 turns the taskbar's progress bar indeterminate
                this.progressBarMode = "indeterminate";
                mainWindow.setProgressBar(9, { mode: "indeterminate" });
            } else {
                const percentage = (this.value * 100) / this._options.maxValue!;

                // taskbar's progress bar must be a number between 0 and 1, e.g.:
                // 63% should be 0.63, 99% should be 0.99...
                const taskbarProgressValue = Math.max(percentage / 100, 0.00001);

                if (this.progressBarMode === "none" || this.progressBarMode === "indeterminate") {
                    this.progressBarMode = "normal";
                }
                mainWindow.setProgressBar(taskbarProgressValue, { mode: this.progressBarMode });
            }
        }

        _execWhenCompleted() {
            if (!this.isInProgress() || !this.isCompleted() || !this._window || !this._window.webContents || !this.completionEnabled) {
                return;
            }

            this._inProgress = false;

            this._window.webContents.send("SET_COMPLETED");

            this._updateTaskbarProgress();

            this._fire("completed", [this._realValue]);

            if (this._options.closeOnComplete) {
                const delayToFinishAnimation = 500;
                setTimeout(() => this.close(), delayToFinishAnimation);
            }
        }
    }
    interface ProgressBarOptions {
        abortOnError?: boolean | null | undefined;
        indeterminate?: boolean | null | undefined;
        initialValue?: number | null | undefined;
        maxValue?: number | null | undefined;
        closeOnComplete?: boolean | null | undefined;
        title?: string | null | undefined;
        text?: string | null | undefined;
        detail?: string | null | undefined;
        style?: StyleOptions | null | undefined;
        browserWindow?: BrowserWindowConstructorOptions | null | undefined;
        remoteWindow?: typeof BrowserWindow | null | undefined;
        debug?: boolean | null | undefined;
        lang?: string | null | undefined;
        customHTML?: string | null | undefined;
        /**
         * Whether the automatic completion of the progress bar is enabled.
         *
         * @default true
         */
        completionEnabled?: boolean | null | undefined;
    }

    interface StyleOptions {
        text?: Partial<CSSStyleDeclaration> | null | undefined;
        detail?: Partial<CSSStyleDeclaration> | null | undefined;
        bar?: Partial<CSSStyleDeclaration> | null | undefined;
        barPaused?: Partial<CSSStyleDeclaration> | null | undefined;
        barError?: Partial<CSSStyleDeclaration> | null | undefined;
        value?: Partial<CSSStyleDeclaration> | null | undefined;
        valuePaused?: Partial<CSSStyleDeclaration> | null | undefined;
        valueError?: Partial<CSSStyleDeclaration> | null | undefined;
    }
}

globalThis.ProgressBar = exports.ProgressBar;

declare global {
    export import ProgressBar = exports.ProgressBar;
}

const htmlContent = `
<!DOCTYPE html>
<html {{REPLACE:LANG}}>
    <head>
        <meta charset="UTF-8">
        <style>
            *{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body{
                margin: 20px;
                margin-bottom: 0;
                font: 13px normal Verdana, Arial, "sans-serif";
            }
            
            #text{
                height: 26px;
                overflow: auto;
                font-size: 14px;
                font-weight: bold;
                padding: 5px 0;
                word-break: break-all;
            }
            
            #detail{
                height: 40px;
                margin: 5px 0;
                padding: 5px 0;
                word-break: break-all;
            }
            
            #progressBarContainer{
                text-align: center;
            }
            
            progress{
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 25px;
            }
            
            progress::-webkit-progress-bar{
                width: 100%;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25) inset;
                border-radius: 2px;
                background: #DEDEDE;
            }
            
            progress::-webkit-progress-value{
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25) inset;
                border-radius: 2px;
                background: #22328C;
            }
            
            progress[mode="paused"]:not(#a#a#a#a)::-webkit-progress-value{
                background: #858c22;
            }
            
            progress[mode="error"]:not(#a#a#a#a)::-webkit-progress-value{
                background: #8c2222;
            }
            
            #progressBar[indeterminate="t"]{
                overflow: hidden;
                position: relative;
                display: block;
                margin: 0.5rem 0 1rem 0;
                width: 100%;
                height: 10px;
                border-radius: 2px;
                background-color: #DEDEDE;
                background-clip: padding-box;
            }
            
            #progressBar[indeterminate="t"] #progressBarValue::before{
                content: "";
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                will-change: left, right;
                background: inherit;
            }
            
            #progressBar[indeterminate="t"] #progressBarValue::before{
                -webkit-animation: indeterminate 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
                animation: indeterminate 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
            }
            
            #progressBar[indeterminate="t"] #progressBarValue::after{
                content: "";
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                will-change: left, right;
                background: inherit;
            }
            
            #progressBar[indeterminate="t"] #progressBarValue::after{
                -webkit-animation: indeterminate-short 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) infinite;
                animation: indeterminate-short 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) infinite;
                -webkit-animation-delay: 1.15s;
                animation-delay: 1.15s;
            }
            
            #progressBar[indeterminate="t"].completed #progressBarValue::before,
            #progressBar[indeterminate="t"].completed #progressBarValue::after{
                display: none;
            }
            
            .completed#progressBar[indeterminate="t"],
            .completed#progressBar[indeterminate="t"] #progressBarValue{
                -webkit-transition: 0.5s;
                transition: 0.5s;
            }
            
            @-webkit-keyframes indeterminate{
                0%{ left: -35%; right: 100%; }
                60%{ left: 100%; right: -90%; }
                100%{ left: 100%; right: -90%; }
            }
            
            @keyframes indeterminate{
                0%{ left: -35%; right: 100%; }
                60%{ left: 100%; right: -90%; }
                100%{ left: 100%; right: -90%; }
            }
            
            @-webkit-keyframes indeterminate-short{
                0%{ left: -200%; right: 100%; }
                60%{ left: 107%; right: -8%; }
                100%{ left: 107%; right: -8%; }
            }
            
            @keyframes indeterminate-short{
                0%{ left: -200%; right: 100%; }
                60%{ left: 107%; right: -8%; }
                100%{ left: 107%; right: -8%; }
            }
        </style>
    </head>
    <body>
        <div id="text"></div>
        <div id="detail"></div>
        <div id="progressBarContainer"></div>
        <script>
            const { ipcRenderer } = require('electron');
            var currentValue = {
                progress : null,
                text : null,
                detail : null,
                mode : "normal",
                maxValue : 100
            };
            
            var elements = {
                text : document.querySelector("#text"),
                detail : document.querySelector("#detail"),
                progressBarContainer : document.querySelector("#progressBarContainer"),
                progressBar : null // set by createProgressBar()
            };
            
            function createProgressBar(settings){
                currentValue.mode = settings.indeterminate ? "indeterminate" : settings.mode ?? "normal";
                if(settings.indeterminate || settings.mode === "indeterminate"){
                    var progressBar = document.createElement("div");
                    progressBar.setAttribute("id", "progressBar");
                    progressBar.setAttribute("indeterminate", "t");
                    progressBar.setAttribute("mode", settings.mode);
                    
                    var progressBarValue = document.createElement("div");
                    progressBarValue.setAttribute("id", "progressBarValue");
                    progressBar.appendChild(progressBarValue);
                    
                    elements.progressBar = progressBar;
                    elements.progressBarContainer.appendChild(elements.progressBar);
                }else{
                    var progressBar = document.createElement("progress");
                    progressBar.setAttribute("id", "progressBar");
                    progressBar.setAttribute("mode", settings.mode);
                    progressBar.max = settings.maxValue;
                    
                    elements.progressBar = progressBar;
                    elements.progressBarContainer.appendChild(elements.progressBar);
                }
                
                window.requestAnimationFrame(synchronizeUi);
            }
            
            function synchronizeUi(){
                elements.progressBar.value = currentValue.progress;
                elements.progressBar.setAttribute("mode", currentValue.mode);
                elements.progressBar.max = currentValue.maxValue;
                elements.text.innerHTML = currentValue.text;
                elements.detail.innerHTML = currentValue.detail;

                if(currentValue.mode === "indeterminate" && !elements.progressBar.tagName !== "DIV" || currentValue.mode !== "indeterminate" && elements.progressBar.tagName !== "PROGRESS"){
                    elements.progressBar.remove();
                    createProgressBar(currentValue);
                } else {
                    window.requestAnimationFrame(synchronizeUi);
                }
            }
            
            ipcRenderer.on("CREATE_PROGRESS_BAR", (event, settings) => {
                createProgressBar(settings);
            });
            
            ipcRenderer.on("SET_PROGRESS", (event, value) => {
                currentValue.progress = value;
            });
            
            ipcRenderer.on("SET_MAX", (event, value) => {
                currentValue.maxValue = value;
            });
            
            ipcRenderer.on("SET_MODE", (event, value) => {
                currentValue.mode = value;
            });
            
            ipcRenderer.on("SET_COMPLETED", (event) => {
                elements.progressBar.classList.add('completed');
            });
            
            ipcRenderer.on("SET_TEXT", (event, value) => {
                currentValue.text = value;
            });
            
            ipcRenderer.on("SET_DETAIL", (event, value) => {
                currentValue.detail = value;
            });
        </script>
    </body>
</html>
`;

module.exports = ProgressBar;
