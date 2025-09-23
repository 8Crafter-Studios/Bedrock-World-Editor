import type * as monaco from "monaco-editor";
import type { IRawTheme } from "vscode-textmate";

export default {
    textmate: {
        name: "Tomorrow Night Blue" /* 
    type: "dark",
    colors: {
        focusBorder: "#bbdaff",
        errorForeground: "#a92049",
        "input.background": "#001733",
        "dropdown.background": "#001733",
        "quickInputList.focusBackground": "#ffffff60",
        "list.activeSelectionBackground": "#ffffff60",
        "list.inactiveSelectionBackground": "#ffffff40",
        "list.hoverBackground": "#ffffff30",
        "list.highlightForeground": "#bbdaff",
        "pickerGroup.foreground": "#bbdaff",
        "editor.background": "#002451",
        "editor.foreground": "#ffffff",
        "editor.selectionBackground": "#003f8e",
        "minimap.selectionHighlight": "#003f8e",
        "editor.lineHighlightBackground": "#00346e",
        "editorLineNumber.activeForeground": "#949494",
        "editorCursor.foreground": "#ffffff",
        "editorWhitespace.foreground": "#404f7d",
        "editorWidget.background": "#001c40",
        "editorHoverWidget.background": "#001c40",
        "editorHoverWidget.border": "#ffffff44",
        "editorGroup.border": "#404f7d",
        "editorGroupHeader.tabsBackground": "#001733",
        "editorGroup.dropBackground": "#25375daa",
        "peekViewResult.background": "#001c40",
        "tab.inactiveBackground": "#001c40",
        "tab.lastPinnedBorder": "#007acc80",
        "debugToolBar.background": "#001c40",
        "titleBar.activeBackground": "#001126",
        "statusBar.background": "#001126",
        "statusBarItem.remoteBackground": "#0e639c",
        "ports.iconRunningProcessForeground": "#bbdaff",
        "statusBar.noFolderBackground": "#001126",
        "statusBar.debuggingBackground": "#001126",
        "activityBar.background": "#001733",
        "progressBar.background": "#bbdaffcc",
        "badge.background": "#bbdaffcc",
        "badge.foreground": "#001733",
        "sideBar.background": "#001c40",
        "terminal.ansiBlack": "#111111",
        "terminal.ansiRed": "#ff9da4",
        "terminal.ansiGreen": "#d1f1a9",
        "terminal.ansiYellow": "#ffeead",
        "terminal.ansiBlue": "#bbdaff",
        "terminal.ansiMagenta": "#ebbbff",
        "terminal.ansiCyan": "#99ffff",
        "terminal.ansiWhite": "#cccccc",
        "terminal.ansiBrightBlack": "#333333",
        "terminal.ansiBrightRed": "#ff7882",
        "terminal.ansiBrightGreen": "#b8f171",
        "terminal.ansiBrightYellow": "#ffe580",
        "terminal.ansiBrightBlue": "#80baff",
        "terminal.ansiBrightMagenta": "#d778ff",
        "terminal.ansiBrightCyan": "#78ffff",
        "terminal.ansiBrightWhite": "#ffffff",
    }, */,
        settings: [
            {
                settings: {
                    background: "#002451",
                    foreground: "#FFFFFF",
                },
            },
            {
                scope: ["meta.embedded", "source.groovy.embedded", "meta.jsx.children", "string meta.image.inline.markdown", "variable.legacy.builtin.python"],
                settings: {
                    //"background": "#002451",
                    foreground: "#FFFFFF",
                },
            },
            {
                name: "Comment",
                scope: "comment",
                settings: {
                    foreground: "#7285B7",
                },
            },
            {
                name: "Foreground, Operator",
                scope: "keyword.operator.class, keyword.operator, constant.other, source.php.embedded.line",
                settings: {
                    fontStyle: "",
                    foreground: "#FFFFFF",
                },
            },
            {
                name: "Variable, String Link, Regular Expression, Tag Name, GitGutter deleted",
                scope: "variable, support.other.variable, string.other.link, string.regexp, entity.name.tag, entity.other.attribute-name, meta.tag, declaration.tag, markup.deleted.git_gutter",
                settings: {
                    foreground: "#FF9DA4",
                },
            },
            {
                name: "Number, Constant, Function Argument, Tag Attribute, Embedded",
                scope: "constant.numeric, constant.language, support.constant, constant.character, variable.parameter, punctuation.section.embedded, keyword.other.unit",
                settings: {
                    fontStyle: "",
                    foreground: "#FFC58F",
                },
            },
            {
                name: "Class, Support",
                scope: "entity.name.class, entity.name.type, entity.name.namespace, entity.name.scope-resolution, support.type, support.class",
                settings: {
                    fontStyle: "",
                    foreground: "#FFEEAD",
                },
            },
            {
                name: "String, Symbols, Inherited Class, Markup Heading, GitGutter inserted",
                scope: "string, constant.other.symbol, entity.other.inherited-class, punctuation.separator.namespace.ruby, markup.heading, markup.inserted.git_gutter",
                settings: {
                    fontStyle: "",
                    foreground: "#D1F1A9",
                },
            },
            {
                name: "Operator, Misc",
                scope: "keyword.operator, constant.other.color",
                settings: {
                    foreground: "#99FFFF",
                },
            },
            {
                name: "Function, Special Method, Block Level, GitGutter changed",
                scope: "entity.name.function, meta.function-call, support.function, keyword.other.special-method, meta.block-level, markup.changed.git_gutter",
                settings: {
                    fontStyle: "",
                    foreground: "#BBDAFF",
                },
            },
            {
                name: "Keyword, Storage",
                scope: "keyword, storage, storage.type, entity.name.tag.css, entity.name.tag.less",
                settings: {
                    fontStyle: "",
                    foreground: "#EBBBFF",
                },
            },
            {
                name: "Invalid",
                scope: "invalid",
                settings: {
                    //"background": "#F99DA5",
                    fontStyle: "",
                    foreground: "#a92049",
                },
            },
            {
                name: "Separator",
                scope: "meta.separator",
                settings: {
                    //"background": "#BBDAFE",
                    foreground: "#FFFFFF",
                },
            },
            {
                name: "Deprecated",
                scope: "invalid.deprecated",
                settings: {
                    //"background": "#EBBBFF",
                    fontStyle: "",
                    foreground: "#cd9731",
                },
            },
            {
                name: "Diff foreground",
                scope: "markup.inserted.diff, markup.deleted.diff, meta.diff.header.to-file, meta.diff.header.from-file",
                settings: {
                    foreground: "#FFFFFF",
                },
            },
            {
                name: "Diff insertion",
                scope: "markup.inserted.diff, meta.diff.header.to-file",
                settings: {
                    foreground: "#718c00",
                },
            },
            {
                name: "Diff deletion",
                scope: "markup.deleted.diff, meta.diff.header.from-file",
                settings: {
                    foreground: "#c82829",
                },
            },
            {
                name: "Diff header",
                scope: "meta.diff.header.from-file, meta.diff.header.to-file",
                settings: {
                    foreground: "#4271ae",
                },
            },
            {
                name: "Diff range",
                scope: "meta.diff.range",
                settings: {
                    fontStyle: "italic",
                    foreground: "#3e999f",
                },
            },
            {
                name: "Markup Quote",
                scope: "markup.quote",
                settings: {
                    foreground: "#FFC58F",
                },
            },
            {
                name: "Markup Lists",
                scope: "markup.list",
                settings: {
                    foreground: "#BBDAFF",
                },
            },
            {
                name: "Markup Styling",
                scope: "markup.bold, markup.italic",
                settings: {
                    foreground: "#FFC58F",
                },
            },
            {
                name: "Markup: Strong",
                scope: "markup.bold",
                settings: {
                    fontStyle: "bold",
                },
            },
            {
                name: "Markup: Emphasis",
                scope: "markup.italic",
                settings: {
                    fontStyle: "italic",
                },
            },
            {
                scope: "markup.strikethrough",
                settings: {
                    fontStyle: "strikethrough",
                },
            },
            {
                name: "Markup Inline",
                scope: "markup.inline.raw",
                settings: {
                    fontStyle: "",
                    foreground: "#FF9DA4",
                },
            },
            {
                name: "Markup Headings",
                scope: "markup.heading",
                settings: {
                    fontStyle: "bold",
                },
            },
            {
                scope: "token.info-token",
                settings: {
                    foreground: "#6796e6",
                },
            },
            {
                scope: "token.warn-token",
                settings: {
                    foreground: "#cd9731",
                },
            },
            {
                scope: "token.error-token",
                settings: {
                    foreground: "#f44747",
                },
            },
            {
                scope: "token.debug-token",
                settings: {
                    foreground: "#b267e6",
                },
            },
        ],
    },
    monaco: {
        base: "vs-dark",
        inherit: false,
        rules: [
            {
                token: "",
                background: "#002451",
                foreground: "#FFFFFF",
            },
            {
                token: "meta.embedded",
                foreground: "#FFFFFF",
            },
            {
                token: "source.groovy.embedded",
                foreground: "#FFFFFF",
            },
            {
                token: "meta.jsx.children",
                foreground: "#FFFFFF",
            },
            {
                token: "string meta.image.inline.markdown",
                foreground: "#FFFFFF",
            },
            {
                token: "variable.legacy.builtin.python",
                foreground: "#FFFFFF",
            },
            {
                token: "comment",
                foreground: "#7285B7",
            },
            {
                token: "keyword.operator.class",
                fontStyle: "",
                foreground: "#FFFFFF",
            },
            {
                token: "keyword.operator",
                fontStyle: "",
                foreground: "#FFFFFF",
            },
            {
                token: "constant.other",
                fontStyle: "",
                foreground: "#FFFFFF",
            },
            {
                token: "source.php.embedded.line",
                fontStyle: "",
                foreground: "#FFFFFF",
            },
            {
                token: "variable",
                foreground: "#FF9DA4",
            },
            {
                token: "support.other.variable",
                foreground: "#FF9DA4",
            },
            {
                token: "string.other.link",
                foreground: "#FF9DA4",
            },
            {
                token: "string.regexp",
                foreground: "#FF9DA4",
            },
            {
                token: "entity.name.tag",
                foreground: "#FF9DA4",
            },
            {
                token: "entity.other.attribute-name",
                foreground: "#FF9DA4",
            },
            {
                token: "meta.tag",
                foreground: "#FF9DA4",
            },
            {
                token: "declaration.tag",
                foreground: "#FF9DA4",
            },
            {
                token: "markup.deleted.git_gutter",
                foreground: "#FF9DA4",
            },
            {
                token: "constant.numeric",
                fontStyle: "",
                foreground: "#FFC58F",
            },
            {
                token: "constant.language",
                fontStyle: "",
                foreground: "#FFC58F",
            },
            {
                token: "support.constant",
                fontStyle: "",
                foreground: "#FFC58F",
            },
            {
                token: "constant.character",
                fontStyle: "",
                foreground: "#FFC58F",
            },
            {
                token: "variable.parameter",
                fontStyle: "",
                foreground: "#FFC58F",
            },
            {
                token: "punctuation.section.embedded",
                fontStyle: "",
                foreground: "#FFC58F",
            },
            {
                token: "keyword.other.unit",
                fontStyle: "",
                foreground: "#FFC58F",
            },
            {
                token: "entity.name.class",
                fontStyle: "",
                foreground: "#FFEEAD",
            },
            {
                token: "entity.name.type",
                fontStyle: "",
                foreground: "#FFEEAD",
            },
            {
                token: "entity.name.namespace",
                fontStyle: "",
                foreground: "#FFEEAD",
            },
            {
                token: "entity.name.scope-resolution",
                fontStyle: "",
                foreground: "#FFEEAD",
            },
            {
                token: "support.type",
                fontStyle: "",
                foreground: "#FFEEAD",
            },
            {
                token: "support.class",
                fontStyle: "",
                foreground: "#FFEEAD",
            },
            {
                token: "string",
                fontStyle: "",
                foreground: "#D1F1A9",
            },
            {
                token: "constant.other.symbol",
                fontStyle: "",
                foreground: "#D1F1A9",
            },
            {
                token: "entity.other.inherited-class",
                fontStyle: "",
                foreground: "#D1F1A9",
            },
            {
                token: "punctuation.separator.namespace.ruby",
                fontStyle: "",
                foreground: "#D1F1A9",
            },
            {
                token: "markup.heading",
                fontStyle: "",
                foreground: "#D1F1A9",
            },
            {
                token: "markup.inserted.git_gutter",
                fontStyle: "",
                foreground: "#D1F1A9",
            },
            {
                token: "keyword.operator",
                foreground: "#99FFFF",
            },
            {
                token: "constant.other.color",
                foreground: "#99FFFF",
            },
            {
                token: "entity.name.function",
                fontStyle: "",
                foreground: "#BBDAFF",
            },
            {
                token: "meta.function-call",
                fontStyle: "",
                foreground: "#BBDAFF",
            },
            {
                token: "support.function",
                fontStyle: "",
                foreground: "#BBDAFF",
            },
            {
                token: "keyword.other.special-method",
                fontStyle: "",
                foreground: "#BBDAFF",
            },
            {
                token: "meta.block-level",
                fontStyle: "",
                foreground: "#BBDAFF",
            },
            {
                token: "markup.changed.git_gutter",
                fontStyle: "",
                foreground: "#BBDAFF",
            },
            {
                token: "keyword",
                fontStyle: "",
                foreground: "#EBBBFF",
            },
            {
                token: "storage",
                fontStyle: "",
                foreground: "#EBBBFF",
            },
            {
                token: "storage.type",
                fontStyle: "",
                foreground: "#EBBBFF",
            },
            {
                token: "entity.name.tag.css",
                fontStyle: "",
                foreground: "#EBBBFF",
            },
            {
                token: "entity.name.tag.less",
                fontStyle: "",
                foreground: "#EBBBFF",
            },
            {
                token: "invalid",
                fontStyle: "",
                foreground: "#a92049",
            },
            {
                token: "meta.separator",
                foreground: "#FFFFFF",
            },
            {
                token: "invalid.deprecated",
                fontStyle: "",
                foreground: "#cd9731",
            },
            {
                token: "markup.inserted.diff",
                foreground: "#FFFFFF",
            },
            {
                token: "markup.deleted.diff",
                foreground: "#FFFFFF",
            },
            {
                token: "meta.diff.header.to-file",
                foreground: "#FFFFFF",
            },
            {
                token: "meta.diff.header.from-file",
                foreground: "#FFFFFF",
            },
            {
                token: "markup.inserted.diff",
                foreground: "#718c00",
            },
            {
                token: "meta.diff.header.to-file",
                foreground: "#718c00",
            },
            {
                token: "markup.deleted.diff",
                foreground: "#c82829",
            },
            {
                token: "meta.diff.header.from-file",
                foreground: "#c82829",
            },
            {
                token: "meta.diff.header.from-file",
                foreground: "#4271ae",
            },
            {
                token: "meta.diff.header.to-file",
                foreground: "#4271ae",
            },
            {
                token: "meta.diff.range",
                fontStyle: "italic",
                foreground: "#3e999f",
            },
            {
                token: "markup.quote",
                foreground: "#FFC58F",
            },
            {
                token: "markup.list",
                foreground: "#BBDAFF",
            },
            {
                token: "markup.bold",
                foreground: "#FFC58F",
            },
            {
                token: "markup.italic",
                foreground: "#FFC58F",
            },
            {
                token: "markup.bold",
                fontStyle: "bold",
            },
            {
                token: "markup.italic",
                fontStyle: "italic",
            },
            {
                token: "markup.strikethrough",
                fontStyle: "strikethrough",
            },
            {
                token: "markup.inline.raw",
                fontStyle: "",
                foreground: "#FF9DA4",
            },
            {
                token: "markup.heading",
                fontStyle: "bold",
            },
            {
                token: "token.info-token",
                foreground: "#6796e6",
            },
            {
                token: "token.warn-token",
                foreground: "#cd9731",
            },
            {
                token: "token.error-token",
                foreground: "#f44747",
            },
            {
                token: "token.debug-token",
                foreground: "#b267e6",
            },
        ],
        colors: {
            focusBorder: "#bbdaff",
            errorForeground: "#a92049",
            "input.background": "#001733",
            "dropdown.background": "#001733",
            "quickInputList.focusBackground": "#ffffff60",
            "list.activeSelectionBackground": "#ffffff60",
            "list.inactiveSelectionBackground": "#ffffff40",
            "list.hoverBackground": "#ffffff30",
            "list.highlightForeground": "#bbdaff",
            "pickerGroup.foreground": "#bbdaff",
            "editor.background": "#002451",
            "editor.foreground": "#ffffff",
            "editor.selectionBackground": "#003f8e",
            "minimap.selectionHighlight": "#003f8e",
            "editor.lineHighlightBackground": "#00346e",
            "editorLineNumber.activeForeground": "#949494",
            "editorCursor.foreground": "#ffffff",
            "editorWhitespace.foreground": "#404f7d",
            "editorWidget.background": "#001c40",
            "editorHoverWidget.background": "#001c40",
            "editorHoverWidget.border": "#ffffff44",
            "editorGroup.border": "#404f7d",
            "editorGroupHeader.tabsBackground": "#001733",
            "editorGroup.dropBackground": "#25375daa",
            "peekViewResult.background": "#001c40",
            "tab.inactiveBackground": "#001c40",
            "tab.lastPinnedBorder": "#007acc80",
            "debugToolBar.background": "#001c40",
            "titleBar.activeBackground": "#001126",
            "statusBar.background": "#001126",
            "statusBarItem.remoteBackground": "#0e639c",
            "ports.iconRunningProcessForeground": "#bbdaff",
            "statusBar.noFolderBackground": "#001126",
            "statusBar.debuggingBackground": "#001126",
            "activityBar.background": "#001733",
            "progressBar.background": "#bbdaffcc",
            "badge.background": "#bbdaffcc",
            "badge.foreground": "#001733",
            "sideBar.background": "#001c40",
            "terminal.ansiBlack": "#111111",
            "terminal.ansiRed": "#ff9da4",
            "terminal.ansiGreen": "#d1f1a9",
            "terminal.ansiYellow": "#ffeead",
            "terminal.ansiBlue": "#bbdaff",
            "terminal.ansiMagenta": "#ebbbff",
            "terminal.ansiCyan": "#99ffff",
            "terminal.ansiWhite": "#cccccc",
            "terminal.ansiBrightBlack": "#333333",
            "terminal.ansiBrightRed": "#ff7882",
            "terminal.ansiBrightGreen": "#b8f171",
            "terminal.ansiBrightYellow": "#ffe580",
            "terminal.ansiBrightBlue": "#80baff",
            "terminal.ansiBrightMagenta": "#d778ff",
            "terminal.ansiBrightCyan": "#78ffff",
            "terminal.ansiBrightWhite": "#ffffff",
        },
    },
    details: {
        name: "Tomorrow Night Blue",
        id: "tomorrow-night-blue",
    },
} as const satisfies {
    textmate: IRawTheme;
    monaco: monaco.editor.IStandaloneThemeData;
    details: {
        name: string;
        id: string;
    };
};
