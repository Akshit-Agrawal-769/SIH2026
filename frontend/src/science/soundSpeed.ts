/**
 * Speed of sound in seawater, Mackenzie (1981), J. Acoust. Soc. Am. 70(3), 807-812.
 * T in °C, S in PSU, D in metres. Valid for T 2-30 °C, S 25-40, D 0-8000 m.
 * Check value from the paper: T=25, S=35, D=1000 -> 1550.744 m/s.
 */
export function mackenzieSoundSpeed(T: number, S: number, D: number): number {
  return (
    1448.96 +
    4.591 * T -
    5.304e-2 * T * T +
    2.374e-4 * T * T * T +
    1.34 * (S - 35) +
    1.63e-2 * D +
    1.675e-7 * D * D -
    1.025e-2 * T * (S - 35) -
    7.139e-13 * T * D * D * D
  );
}

export function mackenzieInRange(T: number, S: number, D: number): boolean {
  return T >= 2 && T <= 30 && S >= 25 && S <= 40 && D >= 0 && D <= 8000;
}
