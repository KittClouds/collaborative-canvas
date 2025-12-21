export class Node {
    id: number;
    level: number;
    vector: Float32Array;
    neighbors: number[][];
    public deleted: boolean;

    private _magnitude?: number; // Cached magnitude
    private _normalized?: Float32Array; // Cached normalized vector

    constructor(id: number, vector: Float32Array | number[], level: number, M: number, magnitude?: number) {
        this.id = id;
        this.vector = vector instanceof Float32Array
            ? vector
            : new Float32Array(vector);
        this.level = level;
        this.neighbors = Array.from(
            { length: level + 1 },
            () => new Array(M).fill(-1)
        );
        this.deleted = false;
        this._magnitude = magnitude;
    }

    getMagnitude(): number {
        if (this._magnitude === undefined) {
            let sum = 0;
            for (let i = 0; i < this.vector.length; i++) {
                sum += this.vector[i] * this.vector[i];
            }
            this._magnitude = Math.sqrt(sum);
        }
        return this._magnitude;
    }

    getNormalized(): Float32Array {
        if (!this._normalized) {
            const mag = this.getMagnitude();
            this._normalized = new Float32Array(this.vector.length);
            if (mag > 0) {
                for (let i = 0; i < this.vector.length; i++) {
                    this._normalized[i] = this.vector[i] / mag;
                }
            }
        }
        return this._normalized;
    }

    // Backwards compatibility for the magnitude property if needed, but getMagnitude is preferred
    get magnitude(): number {
        return this.getMagnitude();
    }

    invalidateCache(): void {
        this._magnitude = undefined;
        this._normalized = undefined;
    }

    // Get count of valid neighbors at each level
    getNeighborCounts(): number[] {
        return this.neighbors.map(level =>
            level.filter(id => id !== -1).length
        );
    }

    // Get total edge count
    getTotalEdges(): number {
        return this.getNeighborCounts().reduce((sum, count) => sum + count, 0);
    }
}
