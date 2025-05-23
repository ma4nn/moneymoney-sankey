import Alpine from '@alpinejs/csp';
import {Category} from "../transaction";
import {Config} from "../config";
import { getDefaultColorValue } from './sankey-chart';

export default () => ({
    pathFilter: '',

    get categories(): Map<number,Category> {
        return this.config.categories;
    },

    get config(): Config {
        return Alpine.store('config');
    },

    get categoriesArray(): Array<Category> { // AlpineJs needs an array for x-for
        return [...this.categories.values()].filter((a: Category) => a.id !== this.config.mainNodeId && a.path.toLowerCase().includes(this.pathFilter))
            .map((category: Category) => ({...category, budget: category.budget ?? '', color: category.color ?? getDefaultColorValue(category.id)} as Category))
            .sort((a, b) => a.path.localeCompare(b.path));
    },

    toggleRow(event: Event): void {
        const element = event.target as HTMLTableCellElement;
        const checkbox = element.closest('tr').querySelector<HTMLInputElement>('input[name="category-is-active"]');

        checkbox.click();
    },

    toggleStatus(event: Event): void {
        const element = event.target as HTMLInputElement;
        const category = this.getCategoryFromElement(element);

        if (category.id !== this.config.mainNodeId) {
            category.active = element.checked;
            document.dispatchEvent(new CustomEvent('ChartInvalidated'));
        }
    },

    setBudget(event: Event): void {
        const element = event.target as HTMLInputElement;
        const category = this.getCategoryFromElement(element);

        category.budget = element.valueAsNumber;

        document.dispatchEvent(new CustomEvent('ChartInvalidated'));
    },

    setColor(event: Event): void {
        const element = event.target as HTMLInputElement;
        const category = this.getCategoryFromElement(element);

        category.color = element.value;

        document.dispatchEvent(new CustomEvent('ChartInvalidated'));
    },

    setPathFilter(event: Event): void {
        const element = event.target as HTMLInputElement;

        this.pathFilter = element.value.toLowerCase();
    },

    reset(): void {
        this.config.categories.forEach((category: Category) => (category.active = true, category.budget = null));
        document.dispatchEvent(new CustomEvent('ChartInvalidated'));
    },

    getCategoryFromElement(element: HTMLElement): Category {
        const categoryId = Number(element.closest('tr').dataset.categoryId);

        return this.categories.get(categoryId);
    },
});