<template>
    <div>
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
    </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
    transition: all 0.2s;
}
.page-enter-from,
.page-leave-to {
    opacity: 0;
}
</style>
