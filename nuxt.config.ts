import tailwindcss from "@tailwindcss/vite";
import ViteYaml from "@modyfi/vite-plugin-yaml";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  vite: {
    plugins: [tailwindcss(), ViteYaml()],
  },
  css: ["~/assets/app.css"],
  modules: ['@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],
})