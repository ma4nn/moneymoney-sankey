import Alpine from '@alpinejs/csp';
import {Config} from "../config";

export default () => ({
    sorts: {
        'custom.category.path': 'Name',
        'custom.real': 'Betrag'
    },

    get value(): string {
        return this.config.sortKey;
    },

    get label(): string {
        return this.sorts[this.value];
    },

    sort(event: Event) {
        const sortKey = (event.target as HTMLLinkElement).dataset.sortKey;
        if (! (sortKey in this.sorts)) {
            return;
        }

        this.config.sortKey = sortKey;
        document.dispatchEvent(new CustomEvent('ChartInvalidated'));
    },

    get config(): Config {
        return Alpine.store('config');
    }
});