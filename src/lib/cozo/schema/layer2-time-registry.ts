/**
 * Time Unit Registry Schema
 * 
 * Stores calendar-specific time units (months, weekdays, eras) with:
 * - Causal ordering (index)
 * - Physics metadata (days_in_unit)
 * - Calendar association
 * - Sequential linking (NEXT edges)
 */

export const TIME_UNIT_SCHEMA = `
:create time_unit {
    id: Uuid,
    calendar_id: String,
    
    unit_type: String,
    name: String,
    normalized_name: String,
    short_name: String? default null,
    
    idx: Int,
    days_in_unit: Int? default null,
    
    direction: String? default null,
    start_year: Int? default null,
    end_year: Int? default null,
    
    created_at: Float default now()
}
`;

export const TIME_UNIT_EDGE_SCHEMA = `
:create time_unit_sequence {
    from_id: Uuid,
    to_id: Uuid,
    calendar_id: String
    =>
    edge_type: String default "NEXT"
}
`;

export const TIME_UNIT_QUERIES = {
    upsert: `
        ?[id, calendar_id, unit_type, name, normalized_name, short_name,
          idx, days_in_unit, direction, start_year, end_year, created_at] <- 
          [[$id, $calendar_id, $unit_type, $name, $normalized_name, $short_name,
            $idx, $days_in_unit, $direction, $start_year, $end_year, $created_at]]
        :put time_unit {
            id, calendar_id, unit_type, name, normalized_name, short_name,
            idx, days_in_unit, direction, start_year, end_year, created_at
        }
    `,

    getByCalendar: `
        ?[id, unit_type, name, normalized_name, short_name, idx, days_in_unit,
          direction, start_year, end_year] := 
          *time_unit{id, calendar_id, unit_type, name, normalized_name, short_name,
            idx, days_in_unit, direction, start_year, end_year},
          calendar_id == $calendar_id
        :order unit_type, idx
    `,

    getMonthsByCalendar: `
        ?[id, name, normalized_name, short_name, idx, days_in_unit] := 
          *time_unit{id, calendar_id, unit_type, name, normalized_name, short_name,
            idx, days_in_unit},
          calendar_id == $calendar_id,
          unit_type == "MONTH"
        :order idx
    `,

    getWeekdaysByCalendar: `
        ?[id, name, normalized_name, short_name, idx] := 
          *time_unit{id, calendar_id, unit_type, name, normalized_name, short_name, idx},
          calendar_id == $calendar_id,
          unit_type == "WEEKDAY"
        :order idx
    `,

    getErasByCalendar: `
        ?[id, name, normalized_name, short_name, idx, direction, start_year, end_year] := 
          *time_unit{id, calendar_id, unit_type, name, normalized_name, short_name,
            idx, direction, start_year, end_year},
          calendar_id == $calendar_id,
          unit_type == "ERA"
        :order start_year
    `,

    findByName: `
        ?[id, calendar_id, unit_type, name, idx, days_in_unit] := 
          *time_unit{id, calendar_id, unit_type, name, normalized_name, idx, days_in_unit},
          normalized_name == $normalized_name,
          calendar_id == $calendar_id
    `,

    linkSequence: `
        ?[from_id, to_id, calendar_id, edge_type] <- 
          [[$from_id, $to_id, $calendar_id, "NEXT"]]
        :put time_unit_sequence {from_id, to_id, calendar_id, edge_type}
    `,

    getNextUnit: `
        ?[to_id, to_name, to_idx] := 
          *time_unit_sequence{from_id, to_id, edge_type},
          from_id == $from_id,
          edge_type == "NEXT",
          *time_unit{id: to_id, name: to_name, idx: to_idx}
    `,

    delete: `
        ?[id] <- [[$id]]
        :rm time_unit { id }
    `,

    deleteByCalendar: `
        ?[id] := 
          *time_unit{id, calendar_id},
          calendar_id == $calendar_id
        :rm time_unit { id }
    `,

    deleteSequencesByCalendar: `
        ?[from_id, to_id, calendar_id] := 
          *time_unit_sequence{from_id, to_id, calendar_id},
          calendar_id == $calendar_id
        :rm time_unit_sequence { from_id, to_id, calendar_id }
    `,
};

export type TimeUnitType = 'MONTH' | 'WEEKDAY' | 'ERA' | 'EPOCH';

export interface TimeUnitRow {
    id: string;
    calendarId: string;
    unitType: TimeUnitType;
    name: string;
    normalizedName: string;
    shortName?: string;
    index: number;
    daysInUnit?: number;
    direction?: 'ascending' | 'descending';
    startYear?: number;
    endYear?: number;
    createdAt: number;
}
