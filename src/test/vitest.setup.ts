import { vi } from 'vitest';

vi.mock('cozo-lib-wasm/cozo_lib_wasm_bg.wasm?url', () => {
    return { default: 'mock-wasm-url' };
});
