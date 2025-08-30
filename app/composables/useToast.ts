// composables/useToast.ts
import { ref, type Ref } from "vue";

// Map global para armazenar os refs
const messageRefs = new Map<string, Ref<string>>();

export function useToast() {
  function setMessage(key: string, message: string) {
    const existingRef = messageRefs.get(key);
    if (existingRef) {
      existingRef.value = message;
    } else {
      // Se não existe, cria um novo ref
      messageRefs.set(key, ref(message));
    }
  }

  function getMessageRef(key: string): Ref<string> {
    const existingRef = messageRefs.get(key);
    if (existingRef) {
      return existingRef;
    }

    // Se não existe, cria um novo
    const newRef = ref("");
    messageRefs.set(key, newRef);
    return newRef;
  }

  function createMessageRef(
    key: string,
    initialMessage: string = "",
  ): Ref<string> {
    const existingRef = messageRefs.get(key);
    if (existingRef) {
      existingRef.value = initialMessage;
      return existingRef;
    }

    const newRef = ref(initialMessage);
    messageRefs.set(key, newRef);
    return newRef;
  }

  function clearMessageRef(key: string) {
    messageRefs.delete(key);
  }

  return {
    setMessage,
    getMessageRef,
    createMessageRef,
    clearMessageRef,
  };
}
