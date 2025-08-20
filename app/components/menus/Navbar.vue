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
      <div class="breadcrumbs">
        <ul>
          <li class="font-black">
            {{ app_name }}
          </li>
          <li v-for="(crumb, index) in breadcrumb" :key="index">
            <NuxtLink :to="`/${breadcrumb.slice(0, index + 1).join('/')}`">{{ crumb }}</NuxtLink>
          </li>
        </ul>
      </div>
    </div>
    <div class="flex-none">oi</div>
  </div>
</template>
