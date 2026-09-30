// Replaced by vi.mock('#app') in the tests; Nuxt provides the real alias at runtime.
export const defineNuxtPlugin = (plugin: unknown) => plugin
export const useRuntimeConfig = () => ({ public: {} as Record<string, unknown> })
