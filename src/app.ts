import Alpine from '@alpinejs/csp';
import persist from '@alpinejs/persist'
import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import defaultConfig, {Config} from "./config";
import Tree from "./tree";
import {Transaction, MoneyMoneyCategoryTree, TransactionsManager, Category} from "./transaction";
import categoriesTableComponent from "./components/categories-table";
import sankeyChartComponent from "./components/sankey-chart";
import scalerComponent from "./components/scaler";
import thresholdSliderComponent from "./components/threshold-slider";
import './style.css';

export { Tree }

declare global {
  interface Window {
    Alpine: Alpine;
  }
}

export function ready(fn: any): void {
    if (document.readyState !== 'loading') {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}

export function initApp(transactions: Array<Transaction>, currency: string = 'EUR'): void {
    Alpine.plugin(persist);

    const mainNodeId = 1;
    const data = new TransactionsManager(transactions);

    const categories = new MoneyMoneyCategoryTree(mainNodeId);
    categories.fromTransactions(data.transactions);

    Alpine.store('config', {
        scalingFactor: Alpine.$persist(defaultConfig.scalingFactor),
        threshold: Alpine.$persist(defaultConfig.threshold),
        currency: currency,
        _categories: Alpine.$persist([...categories.list.values()]), // Alpine.$persist does not work with Maps, so we save it as array internally and use an accessor
        mainNodeId: mainNodeId,

        get categories(): Map<number,Category> {
             // @todo ignore categories that are not in export
            return new Map(this._categories.map((category: Category) => [category.id, category]));
        }
    });
    const config: Config = Alpine.store('config');

    Alpine.data('sankey-chart-component', () => sankeyChartComponent(categories.tree));
    Alpine.data('transaction-meta', () => {
        return {
            accounts: data.accounts,
            start_date: data.startDate.toLocaleDateString(),
            end_date: data.endDate.toLocaleDateString(),
            transaction_count: data.transactions.length,
        }
    });
    Alpine.data('scaler-component', () => scalerComponent(data.calculateNumberOfMonths()));
    Alpine.data('threshold-slider-component', () => thresholdSliderComponent(categories.getOutgoingWeights()));
    Alpine.data('categories-table-component', () => categoriesTableComponent());

    window.Alpine = Alpine;
    Alpine.start();

    document.querySelector("#reset-settings-btn").addEventListener('click', (event) => {
        event.preventDefault();

        reset();
    });
}

function reset(): void {
    const config = Alpine.store('config');

    // @todo clear storage

    config.categories.forEach(category => (category.active = true, category.budget = null));
    config.threshold = defaultConfig.threshold;
    config.scalingFactor = defaultConfig.scalingFactor;
}
