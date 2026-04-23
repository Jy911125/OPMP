/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module '@vueuse/core' {
  export function useDark(): import('vue').Ref<boolean>;
  export function useToggle(value: import('vue').Ref<boolean>): () => void;
}

declare module '@element-plus/icons-vue' {
  import type { DefineComponent } from 'vue';
  const icons: Record<string, DefineComponent<{}, {}, any>>;
  export default icons;
}
