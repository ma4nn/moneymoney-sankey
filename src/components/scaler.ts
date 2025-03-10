import { Config } from "../config";
import Alpine from '@alpinejs/csp';

export default (factor: number = 5) => ({
    defaultScaling: 1,
    currentScaling: 1,
    factor: factor,

    init(): void {
        this.currentScaling = this.config().scalingFactor;
    },

    toggle(event: Event): void {
        this.currentScaling = (event.target as HTMLInputElement).checked ? this.factor : this.defaultScaling;

        this.config().scalingFactor = this.currentScaling;

        console.debug('scaling: ' + this.config().scalingFactor);
    },
    isScaled(): boolean {
        return this.currentScaling !== this.defaultScaling;
    },
    isDisabled(): boolean {
        return this.factor === 1;
    },
    reset(): void {
        this.currentScaling = this.defaultScaling;
    },
    config(): Config {
        return Alpine.store('config');
    }
});