<script setup>
import { ref, computed } from "vue";
import app_config from "~/app_config.yaml";
const app_name = ref(app_config.app_name);
const route = useRoute();

const breadcrumb = computed(() => {
  return route.fullPath.split("/").filter((p) => p);
});
</script>

<template>
  <div class="flex items-center justify-between p-2 px-4">
    <div class="flex-1">
      <div class="breadcrumbs text-secondary">
        <ul>
          <li class="font-black ">
            {{ app_name }}
          </li>
          <li v-for="(crumb, index) in breadcrumb" :key="index">
              <NuxtLink class="opacity-70 hover:opacity-100 transition-opacity hover:no-underline! " v-if="index + 1 <= breadcrumb.length -1" :to="`/${breadcrumb.slice(0, index + 1).join('/')}`">{{
                  crumb
                }}</NuxtLink>
                <span v-else class="pointer-events-none font-medium">
                    {{ crumb }}
                </span>
          </li>
        </ul>
      </div>
    </div>
    <div class="flex-none">
      <!-- Direita na navbar -->
       <!-- TODO theme toggle https://color-mode.nuxtjs.org/ -->
    </div>
  </div>
</template>
