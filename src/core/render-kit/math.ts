//Scalar math primitives shared across the card. Pure, no deps.

export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
