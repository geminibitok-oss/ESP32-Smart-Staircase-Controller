/**
 * Astronomical Solar Calculator (Accurate Sunset & Sunrise calculation)
 * Standard NOAA solar position algorithm
 */

export interface SolarCalculationResult {
  sunriseMinutes: number; // Minutes from 00:00 UTC+TZ
  sunsetMinutes: number;  // Minutes from 00:00 UTC+TZ
  sunriseFormatted: string; // HH:MM
  sunsetFormatted: string;  // HH:MM
  turnOnFormatted: string;  // HH:MM (Sunset - offset)
  turnOffFormatted: string; // HH:MM (Sunrise + offset)
  isNightNow: boolean;
  dayLengthFormatted: string;
}

export const calculateSolarTimes = (
  latitude: number,
  longitude: number,
  timezoneOffsetHours: number,
  sunsetOffsetMinutes: number = -30,
  sunriseOffsetMinutes: number = 0,
  date: Date = new Date()
): SolarCalculationResult => {
  // Day of year
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - startOfYear.getTime()) + ((startOfYear.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Fractional year in radians
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1);

  // Equation of time in minutes
  const eqtime = 229.18 * (
    0.000075 + 
    0.001868 * Math.cos(gamma) - 
    0.032077 * Math.sin(gamma) - 
    0.014615 * Math.cos(2 * gamma) - 
    0.040849 * Math.sin(2 * gamma)
  );

  // Solar declination angle in radians
  const decl = 0.006918 - 
    0.399912 * Math.cos(gamma) + 
    0.070257 * Math.sin(gamma) - 
    0.006758 * Math.cos(2 * gamma) + 
    0.000907 * Math.sin(2 * gamma) - 
    0.002697 * Math.cos(3 * gamma) + 
    0.00148 * Math.sin(3 * gamma);

  const latRad = (latitude * Math.PI) / 180;
  const zenithRad = (90.833 * Math.PI) / 180; // Standard zenith for sunset/sunrise

  // Hour angle
  const cosH = (Math.cos(zenithRad) - Math.sin(latRad) * Math.sin(decl)) / (Math.cos(latRad) * Math.cos(decl));

  let haDeg = 90;
  if (cosH >= 1) {
    haDeg = 0; // Polar night
  } else if (cosH <= -1) {
    haDeg = 180; // Polar day / midnight sun
  } else {
    haDeg = (Math.acos(cosH) * 180) / Math.PI;
  }

  // Solar noon in minutes from 00:00 Local Time
  const timeOffset = eqtime + 4 * longitude - 60 * timezoneOffsetHours;
  const solarNoonMinutes = 720 - timeOffset;

  let sunriseMinutes = Math.round(solarNoonMinutes - haDeg * 4);
  let sunsetMinutes = Math.round(solarNoonMinutes + haDeg * 4);

  // Normalize into 0..1439
  sunriseMinutes = ((sunriseMinutes % 1440) + 1440) % 1440;
  sunsetMinutes = ((sunsetMinutes % 1440) + 1440) % 1440;

  const turnOnMinutes = ((sunsetMinutes + sunsetOffsetMinutes) % 1440 + 1440) % 1440;
  const turnOffMinutes = ((sunriseMinutes + sunriseOffsetMinutes) % 1440 + 1440) % 1440;

  const formatHM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const currentLocalMinutes = date.getHours() * 60 + date.getMinutes();
  
  // Night check
  let isNightNow = false;
  if (turnOnMinutes > turnOffMinutes) {
    isNightNow = currentLocalMinutes >= turnOnMinutes || currentLocalMinutes < turnOffMinutes;
  } else {
    isNightNow = currentLocalMinutes >= turnOnMinutes && currentLocalMinutes < turnOffMinutes;
  }

  const dayLenMin = ((sunsetMinutes - sunriseMinutes) + 1440) % 1440;
  const dayLengthFormatted = `${Math.floor(dayLenMin / 60)} ч ${dayLenMin % 60} мин`;

  return {
    sunriseMinutes,
    sunsetMinutes,
    sunriseFormatted: formatHM(sunriseMinutes),
    sunsetFormatted: formatHM(sunsetMinutes),
    turnOnFormatted: formatHM(turnOnMinutes),
    turnOffFormatted: formatHM(turnOffMinutes),
    isNightNow,
    dayLengthFormatted
  };
};
