/**
 * Spring presets — Apple's motion model, expressed in Motion's spring API.
 *
 * Apple's "Designing Fluid Interfaces" (WWDC18) replaced the physics triplet
 * (mass / stiffness / damping) with two parameters a designer can reason about:
 *
 *   damping ratio — overshoot. 1.0 = critically damped, settles with no bounce.
 *                   below 1.0 overshoots; lower = bouncier.
 *   response      — how quickly the value reaches the target, in seconds.
 *                   NOT a duration: a spring has no fixed duration, its settle
 *                   time emerges from the parameters.
 *
 * Motion's { bounce, duration } spring maps onto that pair directly:
 *   damping 1.0  -> bounce 0      (critically damped)
 *   damping ~0.8 -> bounce ~0.2   (a little overshoot)
 *   response     -> duration
 *
 * The rule for picking one: default to critically damped. Reserve bounce for
 * motion that follows a gesture carrying momentum (a flick, a drag release).
 * Overshoot on a menu that just faded in feels wrong; overshoot on a card you
 * threw feels right.
 *
 * Springs are used here rather than fixed-duration easing curves because they
 * are interruptible by nature: a new target re-aims the spring from wherever
 * the value currently is, at its current velocity, instead of restarting the
 * motion from a jump.
 */

/** damping 1.0 / response 0.4 — Apple's move-and-reposition spring. The default. */
export const ui = { type: "spring", bounce: 0, duration: 0.4 };

/** damping 1.0 / response 0.28 — the same feel, tuned for small elements. */
export const snappy = { type: "spring", bounce: 0, duration: 0.28 };

/** damping 1.0 / response 0.4 — repositioning a surface (Apple's PiP value). */
export const move = { type: "spring", bounce: 0, duration: 0.4 };

/** damping ~0.8 / response 0.4 — only after a gesture that carried momentum. */
export const momentum = { type: "spring", bounce: 0.2, duration: 0.4 };

/** damping ~0.8 / response 0.3 — drawers and sheets (Apple's value). */
export const drawer = { type: "spring", bounce: 0.2, duration: 0.3 };

/** damping ~0.8 / response 0.4 — rotation (Apple's value). */
export const rotation = { type: "spring", bounce: 0.2, duration: 0.4 };

/**
 * Opacity-only cross-fades stay tweens. A spring describes how a thing moves
 * through space; there is no space for a fade to move through, and a bouncing
 * opacity reads as a flicker.
 */
export const fade = { duration: 0.2, ease: "easeOut" };

export const spring = { ui, snappy, move, momentum, drawer, rotation, fade };

export default spring;
