import { type ConfigEnv, defineConfig } from "vite";
import path from "node:path";
import commonjsExternals from "vite-plugin-commonjs-externals";

const externals: (string | RegExp)[] = [/^node:.+$/, /^module:.+$/, "@electron/remote", "path" /* , "leveldb-zlib" */];

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
            external: [
                // "leveldb-zlib", // mark native module as external
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
    plugins: [
        commonjsExternals({
            externals,
        }),
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

