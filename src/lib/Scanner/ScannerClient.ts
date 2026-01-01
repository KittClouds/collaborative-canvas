import type { ScannerMessage, ScanResult, InitPayload } from './ScannerProtocol';

export class ScannerClient {
    private worker: Worker;
    private listeners: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();

    constructor() {
        // Vite worker import
        this.worker = new Worker(new URL('./ScannerWorker.ts', import.meta.url), {
            type: 'module',
        });

        this.worker.onmessage = this.handleMessage.bind(this);
    }

    private handleMessage(event: MessageEvent<ScannerMessage>) {
        const { type, id, payload, error } = event.data;

        if (id && this.listeners.has(id)) {
            const { resolve, reject } = this.listeners.get(id)!;
            this.listeners.delete(id);

            if (type === 'ERROR' || error) {
                reject(new Error(error || 'Unknown Worker Error'));
            } else {
                resolve(payload);
            }
        }
    }

    private send<T>(type: string, payload?: any): Promise<T> {
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            this.listeners.set(id, { resolve, reject });
            this.worker.postMessage({ type, id, payload });
        });
    }

    public async init(config: InitPayload = {}): Promise<void> {
        await this.send('INIT', config);
    }

    public addPattern(entityId: string, pattern: string): void {
        this.worker.postMessage({
            type: 'ADD_PATTERN',
            payload: { entityId, pattern }
        });
    }

    /**
     * Build the Aho-Corasick automaton from added patterns.
     * Must be called after adding patterns and before scanning.
     */
    public async buildReflex(): Promise<void> {
        await this.send('BUILD_REFLEX');
    }

    public async scan(text: string): Promise<ScanResult> {
        return this.send<ScanResult>('SCAN', { text });
    }

    public terminate() {
        this.worker.terminate();
    }
}
