import Alpine from '@alpinejs/csp';
import persist from '@alpinejs/persist'
import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import defaultConfig from "./config";
import Tree from "./tree";
import {Transaction, MoneyMoneyCategoryTree, TransactionsManager, Category} from "./transaction";
import alertComponent from "./components/alert";
import categoriesTableComponent from "./components/categories-table";
import moreActionsComponent from "./components/more-actions";
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

    Alpine.store('error', {
        errorMessage: null,

        setMessage(message: string) {
            this.errorMessage = message;
        },

        clear() {
            this.errorMessage = null;
        }
    });

    const mainNodeId = 1;
    const data = new TransactionsManager(transactions);

    const categories = new MoneyMoneyCategoryTree(mainNodeId);
    categories.fromTransactions(data.transactions);

    try {
        Alpine.store('config', {
            scalingFactor: Alpine.$persist(defaultConfig.scalingFactor) as number,
            threshold: Alpine.$persist(defaultConfig.threshold) as number,
            currency: currency,
            _categories: Alpine.$persist([]) as Array<Category>, // Alpine.$persist does not work with Maps, so we save it as array internally and use an accessor
            mainNodeId: mainNodeId,

            init(): void {
                // merge transaction categories with persisted configuration
                this._categories = [...categories.list].map(([key, value]) => this.categories.has(key) ? this.categories.get(key) : value);
            },

            get categories(): Map<number, Category> {
                if (! (this._categories instanceof Array)) {
                    return new Map();
                }

                return new Map(this._categories.map((category: Category) => [category.id, category]));
            }
        });
    } catch (e) {
        console.error('error loading persisted config from storage: ' + e);
        Alpine.store('error').setMessage('Konfiguration kann nicht geladen werden.');
    }

    Alpine.data('alert-component',  alertComponent);
    Alpine.data('sankey-chart-component', () => sankeyChartComponent(categories.tree));
    Alpine.data('transaction-meta', () => {
        return {
            accounts: data.accounts.join(', '),
            start_date: data.startDate.toLocaleDateString(),
            end_date: data.endDate.toLocaleDateString(),
            transaction_count: data.transactions.length,
        }
    });
    Alpine.data('scaler-component', () => scalerComponent(data.calculateNumberOfMonths()));
    Alpine.data('threshold-slider-component', () => thresholdSliderComponent(categories.getOutgoingWeights()));
    Alpine.data('categories-table-component', categoriesTableComponent);
    Alpine.data('more-actions-component', () => moreActionsComponent(categories.tree));

    window.Alpine = Alpine;
    Alpine.start();
}
