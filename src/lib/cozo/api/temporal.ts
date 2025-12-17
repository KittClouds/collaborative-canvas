import { getGraphSnapshot } from '../temporal/snapshotQueries';
import { traceEntityProvenance } from '../temporal/provenanceTracing';
import { getEntityHistory } from '../temporal/entityHistory';
import { getEdgeHistory } from '../temporal/edgeHistory';
import { compareGraphStates } from '../temporal/graphDiff';
import { search, SearchRequest } from '../search/searchOrchestrator';
import { getNarrativeTimeline } from '../temporal/narrativeTimeline';

export async function handleGetDiff(req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const groupId = url.searchParams.get('groupId');
        const dateAStr = url.searchParams.get('dateA');
        const dateBStr = url.searchParams.get('dateB');

        if (!groupId || !dateAStr || !dateBStr) {
            return new Response(JSON.stringify({ error: 'Missing params (groupId, dateA, dateB)' }), { status: 400 });
        }

        const dateA = new Date(dateAStr);
        const dateB = new Date(dateBStr);

        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            return new Response(JSON.stringify({ error: 'Invalid date format' }), { status: 400 });
        }

        const diff = await compareGraphStates(groupId, dateA, dateB);
        return new Response(JSON.stringify(diff), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export async function handleGetSnapshot(req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const groupId = url.searchParams.get('groupId');
        const timestampStr = url.searchParams.get('timestamp');
        const scope = url.searchParams.get('scope') as 'note' | 'folder' | 'vault' || 'folder';

        if (!groupId) {
            return new Response(JSON.stringify({ error: 'Missing groupId' }), { status: 400 });
        }

        const timestamp = timestampStr ? new Date(timestampStr) : new Date();
        if (isNaN(timestamp.getTime())) {
            return new Response(JSON.stringify({ error: 'Invalid timestamp' }), { status: 400 });
        }

        const snapshot = await getGraphSnapshot({
            groupId,
            timestamp,
            scope,
            includeEdges: true
        });

        return new Response(JSON.stringify(snapshot), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export async function handleGetProvenance(req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const entityId = url.searchParams.get('entityId'); // or verify path logic if using a router

        if (!entityId) {
            return new Response(JSON.stringify({ error: 'Missing entityId param' }), { status: 400 });
        }

        const history = await traceEntityProvenance(entityId);
        return new Response(JSON.stringify(history), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export async function handleGetEntityHistory(req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const entityId = url.searchParams.get('entityId');

        if (!entityId) {
            return new Response(JSON.stringify({ error: 'Missing entityId param' }), { status: 400 });
        }

        const history = await getEntityHistory(entityId);
        return new Response(JSON.stringify(history), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export async function handleGetEdgeHistory(req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const entity1Id = url.searchParams.get('entity1Id');
        const entity2Id = url.searchParams.get('entity2Id');
        const groupId = url.searchParams.get('groupId');

        if (!entity1Id || !entity2Id || !groupId) {
            return new Response(JSON.stringify({ error: 'Missing required params (entity1Id, entity2Id, groupId)' }), { status: 400 });
        }

        const history = await getEdgeHistory(entity1Id, entity2Id, groupId);
        return new Response(JSON.stringify(history), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}


export async function handleSearchWithDateRange(req: Request): Promise<Response> {
    try {
        const body = await req.json();

        // Validate dateRange if present
        let dateRange: { start: Date; end: Date } | undefined;
        if (body.dateRange) {
            const start = new Date(body.dateRange.start);
            const end = new Date(body.dateRange.end);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return new Response(JSON.stringify({ error: 'Invalid date format in dateRange' }), { status: 400 });
            }
            dateRange = { start, end };
        }

        const request: SearchRequest = {
            query: body.query,
            model: body.model,
            maxResults: body.maxResults,
            enableGraphExpansion: body.enableGraphExpansion,
            noteIds: body.noteIds,
            dateRange
        };

        const results = await search(request);

        return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}


export async function handleGetTimeline(req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const groupId = url.searchParams.get('groupId');
        const startDateStr = url.searchParams.get('startDate');
        const endDateStr = url.searchParams.get('endDate');

        if (!groupId) {
            return new Response(JSON.stringify({ error: 'Missing groupId param' }), { status: 400 });
        }

        const startDate = startDateStr ? new Date(startDateStr) : undefined;
        const endDate = endDateStr ? new Date(endDateStr) : undefined;

        if ((startDate && isNaN(startDate.getTime())) || (endDate && isNaN(endDate.getTime()))) {
            return new Response(JSON.stringify({ error: 'Invalid date format' }), { status: 400 });
        }

        const timeline = await getNarrativeTimeline(groupId, {
            startDate,
            endDate
        });

        return new Response(JSON.stringify(timeline), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
