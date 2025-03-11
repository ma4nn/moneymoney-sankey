import { Config } from "../config";
import Alpine from '@alpinejs/csp';

export default (factor: number) => ({
    defaultScaling: 1,
    factor: factor,

    get currentScaling(): number {
        return this.config.scalingFactor;
    },

    set currentScaling(scaling: number) {
        this.config.scalingFactor = scaling;
    },

    get isScaled(): boolean {
        return this.currentScaling !== this.defaultScaling;
    },

    get isDisabled(): boolean {
        return this.factor === 0 || this.factor === this.defaultScaling;
    },

    get factorLabel(): string {
        return String(Math.round(this.factor));
    },

    get config(): Config {
        return Alpine.store('config');
    },

    toggle(event: Event): void {
        this.currentScaling = (event.target as HTMLInputElement).checked ? this.factor : this.defaultScaling;

        console.debug('scaling: ' + this.currentScaling);

        document.dispatchEvent(new CustomEvent('ChartInvalidated'));
    },

    reset(): void {
        this.currentScaling = this.defaultScaling;
    },
});