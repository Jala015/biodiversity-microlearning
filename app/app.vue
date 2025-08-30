<template>
    <div class="flex flex-col min-h-screen">
        <MenusNavbar />
        <div class="p-4 pb-22" i>
            <NuxtPage />
        </div>
        <MenusDock />
    </div>

    <Notivue v-slot="item">
        <Notification :item="item" />
    </Notivue>
</template>
