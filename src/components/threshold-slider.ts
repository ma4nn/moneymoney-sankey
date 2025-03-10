import { Config } from "../config";
import Alpine from '@alpinejs/csp';

export default (rangeData: Array<number>) => ({
    minValue: 0,
    maxValue: 100,
    currentValue: Alpine.$persist(0),

    init(): void {
        ({ min: this.minValue, max: this.maxValue } = getSliderRange(rangeData));
    },

    zoom(event: Event): void {
        this.currentValue = Number((event.target as HTMLInputElement).value);
        this.config().threshold = this.currentValue;

        console.debug('threshold: ' + this.config().threshold);

        document.dispatchEvent(new CustomEvent('config-updated'));
    },

    config(): Config {
        return Alpine.store('config');
    }
});

function getSliderRange(data: Array<number>) {
    const sorted = [...data].sort((a, b) => a - b);

    // Helper function to compute percentile
    function percentile(arr, p) {
        const index = (arr.length - 1) * p;
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        if (upper >= arr.length) return arr[lower];
        return arr[lower] * (1 - weight) + arr[upper] * weight;
    }

    const q1 = percentile(sorted, 0.25);
    const q3 = percentile(sorted, 0.75);
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const filtered = sorted.filter(value => value >= lowerBound && value <= upperBound);

    const sliderMin = sorted[0]; // assure that the minimum value is always included
    const sliderMax = Math.max(...filtered);

    return {min: String(sliderMin), max: String(sliderMax)};
}