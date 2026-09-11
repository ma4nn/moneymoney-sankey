import Alpine from '@alpinejs/csp';
import {Config} from "../config";

const sorts = {
    'custom.category.path': 'Name',
    'custom.real': 'Betrag'
};

type SortKey = keyof typeof sorts;

// the sort key comes from persisted config or a data attribute, so it is not necessarily one we know
function isSortKey(key: string|undefined): key is SortKey {
    return key !== undefined && key in sorts;
}

export default () => ({
    sorts,

    get value(): string {
        return this.config.sortKey;
    },

    get label(): string {
        const value = this.value;

        return isSortKey(value) ? this.sorts[value] : '';
    },

    sort(event: Event) {
        const sortKey = (event.target as HTMLLinkElement).dataset.sortKey;
        if (! isSortKey(sortKey)) {
            return;
        }

        this.config.sortKey = sortKey;
        document.dispatchEvent(new CustomEvent('ChartInvalidated'));
    },

    get config(): Config {
        return Alpine.store('config');
    }
});