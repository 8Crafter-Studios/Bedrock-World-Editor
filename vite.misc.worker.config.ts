import { type ConfigEnv, defineConfig } from "vite";
import path from "node:path";
import commonjsExternals from "vite-plugin-commonjs-externals";

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

