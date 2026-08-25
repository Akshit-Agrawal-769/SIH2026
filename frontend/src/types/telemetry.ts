/**
 * Marine Platform & Sensor Telemetry Types
 */

export interface PlatformTelemetry {
  id: string;
  name: string;
  type: 'moored_station' | 'buoy_array' | 'autonomous_glider' | 'argo_profiler';
  latitude: number;
  longitude: number;
  depth: number;
  status: 'operational' | 'transmitting' | 'standby' | 'calibrating';
  battery_level: number; // percentage
  sea_surface_temp: number; // °C
  salinity: number; // PSU
  wave_height_hs: number; // meters
  wave_period_tp: number; // seconds
  current_speed: number; // m/s
  current_direction: number; // degrees
  wind_speed: number; // knots
  wind_direction: number; // degrees
  atmospheric_pressure: number; // hPa
  last_transmission_utc: string;
}

export interface SensorAlert {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  source: string;
}
