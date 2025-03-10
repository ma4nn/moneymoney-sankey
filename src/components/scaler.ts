import { Config } from "../config";
import Alpine from '@alpinejs/csp';

export default (factor: number) => ({
    defaultScaling: 1,
    currentScaling: Alpine.$persist(1),
    factor: factor,

    toggle(event: Event): void {
        this.currentScaling = (event.target as HTMLInputElement).checked ? this.factor : this.defaultScaling;
        this.config().scalingFactor = this.currentScaling;

        console.debug('scaling: ' + this.config().scalingFactor);
    },

    isScaled(): boolean {
        return this.currentScaling !== this.defaultScaling;
    },

    isDisabled(): boolean {
        return this.factor === 0 || this.factor === this.defaultScaling;
    },

    reset(): void {
        this.currentScaling = this.defaultScaling;
    },

    get factorLabel(): string {
        return String(Math.round(this.factor));
    },

    config(): Config {
        return Alpine.store('config');
    }
});