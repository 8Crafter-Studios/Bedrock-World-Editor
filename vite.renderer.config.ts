import { type ConfigEnv, defineConfig } from "vite";
import path from "node:path";
import commonjsExternals from "vite-plugin-commonjs-externals";

const externals: (string | RegExp)[] = [/^node:.+$/, /^module:.+$/, "@electron/remote", "path" /* , "@8crafter/leveldb-zlib" */];

// https://vitejs.dev/config
export default defineConfig((env: ConfigEnv) => ({
    define: {
        ...(env.mode === "development" ?
            {
                "process.env.NODE_ENV": JSON.stringify(env.mode),
            }
        :   {
                "process.env": "process.env",
            }),
    },
    build: {
        minify: false,
        assetsInlineLimit: 0,
        manifest: true,
        sourcemap: true,
        rollupOptions: {
            treeshake: false,
            external: [
                // "@8crafter/leveldb-zlib", // mark native module as external
                path.resolve(__dirname, "build/node-leveldb.node"), // native binary
            ],
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
    // optimizeDeps: { exclude: ["monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard.js"] },
    optimizeDeps: {
        esbuildOptions: {
            plugins: [
                {
                    name: "override-monaco-clipboard",
                    setup(build) {
                        build.onResolve({ filter: /^\.\/contrib\/clipboard\/browser\/clipboard\.js$/ }, (args) => {
                            return {
                                path: path.resolve(__dirname, "module_file_overrides/monaco-editor.clipboard.override.js"),
                            };
                        });
                    },
                },
            ],
        },
    },
    plugins: [
        commonjsExternals({
            externals,
        }),
        // {
        //     name: "override-module",
        //     transform(code, id, options) {
        //         console.log(id);
        //         if (id.includes("node_modules/monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard.js")) {
        //             console.log("found file", id);
        //             return { code: readFileSync(path.resolve(__dirname, "module_file_overrides/monaco-editor.clipboard.override.js"), "utf-8") };
        //         }
        //     },
        // },
    ],
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
