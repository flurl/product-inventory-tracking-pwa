import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from 'vite-plugin-pwa';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestIcons = [
  {
    src: 'pwa-192.svg',
    sizes: '192x192',
    type: 'image/svg+xml',
  },
  {
    src: 'pwa-512.svg',
    sizes: '512x512',
    type: 'image/svg+xml',
  }
]

// Include PNG fallbacks for broader platform compatibility
manifestIcons.push(
  {
    src: 'pwa-192.png',
    sizes: '192x192',
    type: 'image/png',
  },
  {
    src: 'pwa-512.png',
    sizes: '512x512',
    type: 'image/png',
  }
)


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Product Inventory Tracker',
        short_name: 'ProductTracker',
        description: 'A Progressive Web App used for tracking product inventory levels.',
        theme_color: '#ffffff',
        icons: manifestIcons,
      },
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
