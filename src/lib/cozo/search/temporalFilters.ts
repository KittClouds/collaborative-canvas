import { cozoDb } from '../db';

export interface DateRange {
    start: Date;
    end: Date;
}

export async function getNotesInDateRange(range: DateRange): Promise<string[]> {
    const query = `
    ?[id] := *note{id, created_at},
      created_at >= $start,
      created_at <= $end
  `;

    // Cozo stores dates as Float seconds or ms (implied by previous context).
    // Assuming ms based on types.ts check earlier.
    try {
        const result = await cozoDb.runQuery(query, {
            start: range.start.getTime(),
            end: range.end.getTime()
        });
        if (result.ok && result.rows) {
            return result.rows.map((row: any[]) => row[0]);
        }
    } catch (err) {
        console.error('Failed to filter notes by date', err);
    }
    return [];
}
