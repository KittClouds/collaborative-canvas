/**
 * Time Module - Polymorphic Chronology Engine
 * 
 * Provides:
 * - ChronologyEngine: Register calendar time units in CozoDB
 * - TimeRegistry: Read API for time unit queries
 */

export {
    executeGenesis,
    clearCalendarTimeUnits,
    getCalendarTimeUnits
} from './ChronologyEngine';

export { TimeRegistry } from './TimeRegistry';

export type { GenesisResult } from './ChronologyEngine';
export type {
    MonthInfo,
    WeekdayInfo,
    EraInfo,
    DateValidation,
    CalendarDictionary
} from './TimeRegistry';
