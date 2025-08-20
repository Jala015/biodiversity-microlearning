import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
    test: {
        environment: 'nuxt',
        projects: [
            await defineVitestProject({
                test: {
                    name: 'nuxt',
                    environment: 'nuxt',
                },
            }),
        ],
    },
})
