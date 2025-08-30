import tailwindcss from "@tailwindcss/vite";
import ViteYaml from "@modyfi/vite-plugin-yaml";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  vite: {
    plugins: [tailwindcss(), ViteYaml()],
  },
  css: [
    "~/assets/app.css",
    "notivue/notification.css",
    "notivue/animations.css",
  ],
  modules: [
    "@pinia/nuxt",
    "pinia-plugin-persistedstate/nuxt",
    "@nuxt/test-utils/module",
    "notivue/nuxt",
  ],
  ssr: false,
  runtimeConfig: {
    // As chaves privadas são acessíveis apenas no lado do servidor
    // NUXT_SECRET_KEY: process.env.NUXT_SECRET_KEY, // Exemplo
    public: {
      // As chaves públicas são acessíveis em qualquer lugar (cliente e servidor)
      upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL,
      upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    },
  },
  notivue: {
    position: "bottom-right",
  },
});
