const mockDb = {
    run: () => JSON.stringify({ ok: true, headers: [], rows: [] }),
    export_relations: () => JSON.stringify({}),
    import_relations: () => JSON.stringify({ ok: true }),
    free: () => {},
};

export class CozoDb {
    static new() {
        return mockDb;
    }
}

export default function init() {
    return Promise.resolve();
}
