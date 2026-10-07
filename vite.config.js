import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import adminApi from "./vite-admin-plugin.js";

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        adminApi({ password: "admin123" }), // change this password
    ],
    server: {
        watch: {
            // saving a job writes these files (plus a .tmp first); don't reload the page for it
            ignored: [
                "**/public/**/*.json",
                "**/public/**/*.tmp",
                "**/clicks.json",
                "**/clicks.json.tmp",
            ],
        },
    },
});