import { Config } from "../config";
import Alpine from '@alpinejs/csp';

export default (rangeData: Array<number>) => ({
    minValue: 0,
    maxValue: 100,

    get currentValue(): number {
        return this.config.threshold;
    },

    set currentValue(threshold: number) {
        this.config.threshold = threshold;
    },

    // the slider is inverted so that sliding right increases the level of detail (= lowers the threshold)
    get sliderValue(): number {
        return this.minValue + this.maxValue - this.currentValue;
    },

    // only when the threshold exceeds the smallest flow does it actually hide something in the chart
    get isFiltering(): boolean {
        return this.currentValue > this.minValue;
    },

    get currentValueFormatted(): string {
        // the threshold is stored unscaled, so apply the scaling factor for display (e.g. "pro Monat")
        return '≥ ' + new Intl.NumberFormat(undefined, { style: 'currency', currency: this.config.currency, maximumFractionDigits: 0 }).format(this.currentValue / this.config.scalingFactor);
    },

    init(): void {
        ({ min: this.minValue, max: this.maxValue } = getSliderRange(rangeData));
    },

    update(event: Event): void {
        // round to cents so that the far-right position results in exactly the minimum threshold
        this.currentValue = Math.round((this.minValue + this.maxValue - Number((event.target as HTMLInputElement).value)) * 100) / 100;
    },

    zoom(event: Event): void {
        this.update(event);

        console.debug('threshold: ' + this.currentValue);

        document.dispatchEvent(new CustomEvent('ChartInvalidated'));
    },

    get config(): Config {
        return Alpine.store('config');
    }
});

function getSliderRange(data: Array<number>) {
    console.debug('calculating slider min/max');
    console.debug(data);

    const sorted = [...data].sort((a, b) => a - b);
    if (sorted.length === 0) { // e.g. an export without any expense flows
        return {min: 0, max: 0};
    }

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

    return {min: sliderMin, max: sliderMax};
}