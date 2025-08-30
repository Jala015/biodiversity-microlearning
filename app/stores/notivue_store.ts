// stores/notifier.ts
import { defineStore } from "pinia";
import { reactive } from "vue";

export const useToastStore = defineStore("toast", () => {
  const messages = reactive<Record<string, string>>({});

  function setMessage(key: string, message: string) {
    messages[key] = message;
  }

  function getMessage(key: string) {
    return messages[key];
  }

  function clearMessage(key: string) {
    delete messages[key];
  }

  return { messages, setMessage, getMessage, clearMessage };
});
