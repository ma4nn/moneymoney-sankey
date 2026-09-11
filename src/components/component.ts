import type { Magics } from '@alpinejs/csp';

/**
 * Identity helper that only exists to give an Alpine component literal its contextual type:
 * `ThisType` makes the magics Alpine injects at runtime ($el, $refs, …) visible on `this`,
 * which a standalone object literal cannot know about.
 */
export default function component<T extends object>(definition: T & ThisType<T & Magics<T>>): T {
    return definition;
}
