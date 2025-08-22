import tailwindcss from "@tailwindcss/vite";
import ViteYaml from "@modyfi/vite-plugin-yaml";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  vite: {
    plugins: [tailwindcss(), ViteYaml()],
  },
  css: ["~/assets/app.css"],
  modules: ['@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt', '@nuxt/test-utils/module', ['@nuxtjs/localforage', {
    driver: ['localforage.INDEXEDDB', 'localforage.LOCALSTORAGE'],
    name: 'imageCache',
    storeName: 'images',
    version: 1.0,
    size: 4980736, // 5MB
  }]],
  plugins: ['~/plugins/deck-db.ts'],

})