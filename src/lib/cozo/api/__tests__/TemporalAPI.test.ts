import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cozoDb } from '../../db';
import {
    getTemporalMentionsByNote,
    getTemporalMentionsByKind,
    getEraTimeline,
    getTemporalKindCounts,
    getUniqueEras,
} from '../TemporalAPI';

// Mock CozoDB
vi.mock('../../db', () => ({
    cozoDb: {
        isReady: vi.fn(),
        runQuery: vi.fn(),
    },
}));

describe('TemporalAPI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getTemporalMentionsByNote', () => {
        it('should return empty array when CozoDB not ready', () => {
            vi.mocked(cozoDb.isReady).mockReturnValue(false);

            const result = getTemporalMentionsByNote('note-123');

            expect(result).toEqual([]);
        });

        it('should return parsed mentions from CozoDB', () => {
            vi.mocked(cozoDb.isReady).mockReturnValue(true);
            vi.mocked(cozoDb.runQuery).mockReturnValue({
                ok: true,
                rows: [
                    ['id-1', 'ERA', 'Third Age 3019', 0, 15, 'In the Third Age 3019, the war ended.', 0.9, null, null, null, null, 'third age', 3019],
                ],
            });

            const result = getTemporalMentionsByNote('note-123');

            expect(result.length).toBe(1);
            expect(result[0].kind).toBe('ERA');
            expect(result[0].text).toBe('Third Age 3019');
            expect(result[0].metadata.eraName).toBe('third age');
            expect(result[0].metadata.eraYear).toBe(3019);
        });

        it('should handle errors gracefully', () => {
            vi.mocked(cozoDb.isReady).mockReturnValue(true);
            vi.mocked(cozoDb.runQuery).mockImplementation(() => {
                throw new Error('Query failed');
            });

            const result = getTemporalMentionsByNote('note-123');

            expect(result).toEqual([]);
        });
    });

    describe('getTemporalMentionsByKind', () => {
        it('should filter by kind correctly', () => {
            vi.mocked(cozoDb.isReady).mockReturnValue(true);
            vi.mocked(cozoDb.runQuery).mockReturnValue({
                ok: true,
                rows: [
                    ['id-1', 'note-1', 'Monday', 0, 6, 'On Monday morning...', 0.9, 0, null, null, null, null, null],
                ],
            });

            const result = getTemporalMentionsByKind('WEEKDAY');

            expect(result.length).toBe(1);
            expect(result[0].kind).toBe('WEEKDAY');
            expect(result[0].metadata.weekdayIndex).toBe(0);
        });
    });

    describe('getEraTimeline', () => {
        it('should return era mentions sorted by year', () => {
            vi.mocked(cozoDb.isReady).mockReturnValue(true);
            vi.mocked(cozoDb.runQuery).mockReturnValue({
                ok: true,
                rows: [
                    ['id-1', 'note-1', 'Third Age 3018', 3018, 'Before the war...', 10],
                    ['id-2', 'note-2', 'Third Age 3019', 3019, 'The ring was destroyed...', 20],
                ],
            });

            const result = getEraTimeline('Third Age');

            expect(result.length).toBe(2);
            expect(result[0].metadata.eraYear).toBe(3018);
            expect(result[1].metadata.eraYear).toBe(3019);
        });
    });

    describe('getTemporalKindCounts', () => {
        it('should return counts per kind', () => {
            vi.mocked(cozoDb.isReady).mockReturnValue(true);
            vi.mocked(cozoDb.runQuery).mockReturnValue({
                ok: true,
                rows: [
                    ['ERA', 15],
                    ['WEEKDAY', 8],
                    ['RELATIVE', 42],
                ],
            });

            const result = getTemporalKindCounts();

            expect(result.length).toBe(3);
            expect(result[0]).toEqual({ kind: 'ERA', count: 15 });
        });
    });

    describe('getUniqueEras', () => {
        it('should extract unique era names', () => {
            vi.mocked(cozoDb.isReady).mockReturnValue(true);
            vi.mocked(cozoDb.runQuery).mockReturnValue({
                ok: true,
                rows: [
                    ['id-1', 'note-1', 'Third Age 3019', 0, 15, '...', 0.9, null, null, null, null, 'third age', 3019],
                    ['id-2', 'note-2', 'Second Age', 0, 10, '...', 0.9, null, null, null, null, 'second age', null],
                    ['id-3', 'note-3', 'Third Age 3020', 0, 15, '...', 0.9, null, null, null, null, 'third age', 3020],
                ],
            });

            const result = getUniqueEras();

            expect(result).toEqual(['second age', 'third age']);
        });
    });
});
