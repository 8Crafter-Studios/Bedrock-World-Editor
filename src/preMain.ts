import { app } from "electron";
import started from "electron-squirrel-startup";

export const isSecondInstance: boolean = !started ? !app.requestSingleInstanceLock() ? (app.quit(), true) : false : false;
