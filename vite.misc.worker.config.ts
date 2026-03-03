import { type ConfigEnv, defineConfig, type LibraryOptions } from "vite";

// https://vitejs.dev/config
export default defineConfig((env: ConfigEnv) => ({
    define: {
        "process.env.NODE_ENV": JSON.stringify(env.mode),
    },
    build: {
        minify: false,
        assetsInlineLimit: 0,
        manifest: true,
        sourcemap: true,
        rollupOptions: {
            treeshake: false,
        },
        lib: {
            entry: [
                "node_modules/monaco-editor/esm/vs/editor/editor.worker.js",
                "node_modules/monaco-editor/esm/vs/language/json/json.worker",
                "node_modules/monaco-editor/esm/vs/language/css/css.worker",
                "node_modules/monaco-editor/esm/vs/language/html/html.worker",
                "node_modules/monaco-editor/esm/vs/language/typescript/ts.worker",
            ],
            formats: ["es"] satisfies LibraryOptions["formats"],
            fileName: (_format, entryName: string): string => `${entryName}.js`,
        },
    },
    esbuild: {
        jsxFactory: "h",
        jsxFragment: "Fragment",
        minifyIdentifiers: false,
        minifySyntax: false,
        minifyWhitespace: false,
        treeShaking: false,
    },
    resolve: {
        alias: {
            react: "preact/compat",
            "react-dom": "preact/compat",
            // // Not necessary unless you consume a module using `createClass`
            // 'create-react-class': 'preact/compat/lib/create-react-class',
            // // Not necessary unless you consume a module requiring `react-dom-factories`
            // 'react-dom-factories': 'preact/compat/lib/react-dom-factories',
        },
    },
}));
