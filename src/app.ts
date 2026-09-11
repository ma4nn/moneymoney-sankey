import Alpine from '@alpinejs/csp';
import persist from '@alpinejs/persist'
import 'bootstrap';

import defaultConfig from "./config";
import Tree from "./tree";
import {Transaction, MoneyMoneyCategoryTree, TransactionsManager, Category} from "./transaction";
import alertComponent from "./components/alert";
import categoriesTableComponent from "./components/categories-table";
import moreActionsComponent from "./components/more-actions";
import sankeyChartComponent from "./components/sankey-chart";
import sorterComponent from "./components/sorter";
import scalerComponent from "./components/scaler";
import thresholdSliderComponent from "./components/threshold-slider";
import themeToggleComponent from "./components/theme-toggle";
import './style.css';

export { Tree }

declare global {
  interface Window {
    Alpine: typeof Alpine;
  }
}

export function initApp(transactions: Array<Transaction>, currency: string = 'EUR'): void {
    defaultConfig.currency = currency; // helpers like numberFormat() default to this shared config, so it must reflect the account currency

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
            scalingFactor: Alpine.$persist(defaultConfig.scalingFactor),
            threshold: Alpine.$persist(defaultConfig.threshold),
            currency: currency,
            sortKey: Alpine.$persist(defaultConfig.sortKey),
            _categories: Alpine.$persist<Array<Category>>([]),
            mainNodeId: mainNodeId,
            chartData: [],

            init(): void {
                // merge transaction categories with persisted configuration
                this._categories = [...categories.list].map(([key, value]) => this.categories.get(key) ?? value);
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

    Alpine.data('alert', alertComponent);
    Alpine.data('sankeychart', () => sankeyChartComponent(categories.tree));
    Alpine.data('transactionmeta', () => {
        return {
            accounts: data.accounts.join(', '),
            start_date: data.startDate.toLocaleDateString(),
            end_date: data.endDate.toLocaleDateString(),
            transaction_count: data.transactions.length,
        }
    });
    Alpine.data('scaler', () => scalerComponent(data.calculateNumberOfMonths()));
    Alpine.data('thresholdslider', () => thresholdSliderComponent(categories.getOutgoingWeights()));
    Alpine.data('categoriestable', categoriesTableComponent);
    Alpine.data('moreactions', moreActionsComponent);
    Alpine.data('sorter', sorterComponent);
    Alpine.data('themetoggle', themeToggleComponent);

    window.Alpine = Alpine;
    Alpine.start();
}
