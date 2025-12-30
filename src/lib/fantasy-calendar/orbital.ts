
import { OrbitalMechanics, StarType } from './types';

// Physical constants (approximated for gameplay feel over strict astrophysics)
const G = 6.67430e-11; // Gravitational constant
const SUN_MASS = 1.989e30; // kg
const EARTH_MASS = 5.972e24; // kg
const AU = 1.496e11; // meters
const EARTH_DAY_HOURS = 24;

/**
 * Calculate orbital period (year length) based on star mass and distance
 * Keplers Third Law: T^2 = (4 * pi^2 * a^3) / (G * M)
 * Result is in Earth Days
 */
export function calculateYearLength(massSolar: number, distanceAU: number): number {
    const massKg = massSolar * SUN_MASS;
    const radiusMeters = distanceAU * AU;

    // T in seconds
    const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(radiusMeters, 3) / (G * massKg));

    // Convert to Earth Days
    return periodSeconds / (24 * 3600);
}

/**
 * Estimate habitable zone range for a given star type/mass
 * Extremely simplified model
 */
export function getHabitableZone(massSolar: number): { min: number, max: number, optimal: number } {
    // Luminosity roughly M^3.5 for main sequence
    const luminosity = Math.pow(massSolar, 3.5);

    // Habitable zone is roughly sqrt(Luminosity)
    const optimal = Math.sqrt(luminosity);

    return {
        min: optimal * 0.95,
        max: optimal * 1.37,
        optimal: optimal
    };
}

/**
 * Get defaults for a star type
 */
export function getStarDefaults(type: StarType): Partial<OrbitalMechanics> {
    switch (type) {
        case 'red_dwarf':
            return { starMass: 0.3, orbitalRadius: 0.15 }; // TRAPPIST-1-ish
        case 'blue_giant':
            return { starMass: 16, orbitalRadius: 30 }; // Rigel-ish
        case 'binary':
            return { starMass: 2.0, orbitalRadius: 1.5 }; // Tatooine-ish
        case 'yellow_dwarf':
        default:
            return { starMass: 1.0, orbitalRadius: 1.0 }; // Sun-ish
    }
}

/**
 * Suggest a reasonable week length based on days per year
 */
export function suggestWeekLength(daysPerYear: number): number {
    if (daysPerYear < 100) return 5;
    if (daysPerYear < 400) return 7;
    if (daysPerYear < 600) return 8;
    return 10;
}

/**
 * Generate a calendar configuration based on orbital parameters
 */
export function generateOrbitalCalendar(mechanics: OrbitalMechanics) {
    const yearLengthEarthDays = calculateYearLength(mechanics.starMass, mechanics.orbitalRadius);

    // Calculate local days per year
    // (Total hours in year) / (Hours in local day)
    const totalHoursInYear = yearLengthEarthDays * 24;
    const daysPerYear = totalHoursInYear / mechanics.rotationPeriod;
    const flooredDays = Math.floor(daysPerYear);

    return {
        yearLengthEarthDays,
        daysPerYear: flooredDays,
        fractionalDay: daysPerYear % 1, // Leap year accumulation
        suggestedDaysPerWeek: suggestWeekLength(flooredDays),
        suggestedMonthCount: flooredDays <= 100 ? 10 : 12
    };
}

