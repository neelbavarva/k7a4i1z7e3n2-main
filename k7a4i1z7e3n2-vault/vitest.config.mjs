import { fileURLToPath } from "node:url";
import { transformWithEsbuild } from "vite";
import { defineConfig } from "vitest/config";

// The app writes JSX in .js files, which Vite only reads as plain JavaScript; this
// compiles our own .js files as JSX (the .ts ones go through Vite's usual path).
const jsxInJs = {
    name: "jsx-in-js",
    enforce: "pre",
    transform(code, id) {
        if (id.includes("/node_modules/") || !/\.js$/.test(id.split("?")[0])) return null;
        return transformWithEsbuild(code, id, { loader: "jsx", jsx: "automatic" });
    },
};

export default defineConfig({
    plugins: [jsxInJs],
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    test: {
        environment: "jsdom",
        include: ["test/**/*.test.js"],
        setupFiles: ["test/setup.js"],
    },
});
