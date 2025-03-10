import Alpine from '@alpinejs/csp';
import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import {Config, save as persistConfig, load as loadConfig} from "./config";
import defaultConfig from "./config";
import Tree from "./tree";
import {Transaction, MoneyMoneyCategoryTree, TransactionsManager} from "./transaction";
import {SankeyChart} from "./components/sankey-chart";
import scaler from "./components/scaler";
import thresholdSlider from "./components/threshold-slider";
import './style.css';

let config: Config = { ...defaultConfig };
let chart: SankeyChart;

export { Tree }

declare global {
  interface Window {
    chart: SankeyChart;
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

function setCategories(): void {
    document.querySelectorAll<HTMLTableRowElement>("form #category-config tbody tr").forEach(row => {
        const category = config.categories.get(parseInt(row.dataset.categoryId));
        category.active = row.querySelector<HTMLInputElement>('input[name="category-is-active"]').checked;
        category.budget = parseFloat(row.querySelector<HTMLInputElement>('input[name="budget"]').value);
    });

    // assure that main node is always active
    config.categories.get(chart.mainNodeId).active = true;

    config.categories.forEach(category => {
        if (! category.active) {
            chart.removeCategory(category.id)
        }
    })
}

function updateCategoryTable(): void {
    const template = document.getElementById('category-table-template') as HTMLTemplateElement;
    const container = document.getElementById('category-table-container') as HTMLElement;

    container.querySelectorAll('table').forEach(element => element.remove());

    const table = template.content.cloneNode(true) as HTMLTableElement;
    const tbody = table.querySelector('tbody');

    new Map([...config.categories.entries()]
            .filter(a => a[0] !== chart.mainNodeId)
            .sort((a, b) => a[1].path.localeCompare(b[1].path)))
        .forEach((category, categoryId) => {
            const row = document.createElement('tr');
            row.dataset.categoryId = String(categoryId);
            row.innerHTML = `
                  <td><div class="form-check"><input id="exclude-category-${categoryId}" name="category-is-active" class="form-check-input" type="checkbox" title="Kategorie anzeigen?" value="${category.name}" ${category.active ? 'checked' : ''}></div></td>
                  <td>${category.path}</td>
                  <td><input type="number" class="form-control" name="budget" placeholder="(ohne)" min="0" step="0.01" value="${(category?.budget ? category.budget : '')}"></td>
                `;
            tbody.appendChild(row);
        }
    );

    container.appendChild(table);
}

export function initApp(transactions: Array<Transaction>, currency: string): void {
    config = loadConfig() ?? config;

    const data = new TransactionsManager(transactions);

    const categoryTree = new MoneyMoneyCategoryTree(config.mainNodeId);
    categoryTree.fromTransactions(data.transactions);

    config.categories = new Map([...categoryTree.categories, ...config.categories]); // @todo ignore categories that are not in export!
    config.currency = currency;

    chart = new SankeyChart(categoryTree.categoryTree, config); // @todo use categoryTree
    window.chart = chart.create();

    update();

    Alpine.data('transaction-meta', () => {
        return {
            accounts: data.accounts,
            start_date: data.startDate.toLocaleDateString(),
            end_date: data.endDate.toLocaleDateString(),
            transaction_count: data.transactions.length,
        }
    });
    Alpine.data('scaler-component', () => scaler(data.calculateNumberOfMonths()));
    Alpine.data('threshold-slider-component', () => thresholdSlider(chart.getOutgoingWeights()));
    Alpine.store('config', config);
    window.Alpine = Alpine;
    Alpine.start();

    document.querySelector("input#is-show-monthly").addEventListener('change', (event) => {
        event.preventDefault();

        persistConfig(config);
        chart.update();
    });

    const thresholdInput = document.querySelector<HTMLInputElement>("input#threshold");
    thresholdInput.addEventListener('change', (event) => {
        event.preventDefault();

        persistConfig(config);
        chart.update();
    });

    document.querySelector("#apply-settings-btn").addEventListener('click', (event) => {
        event.preventDefault();

        setCategories();
        persistConfig(config);
        update();
        chart.update();
    });

    document.querySelector("#reset-settings-btn").addEventListener('click', (event) => {
        event.preventDefault();

        reset();
        update();
    });

    document.addEventListener('ChartCategoryRemoved', (event: CustomEvent) => {
        console.debug('hiding categories ' + event.detail.childCategoryIds);

        event.detail.childCategoryIds.forEach((categoryId: number) => config.categories.get(categoryId).active = false);

        updateCategoryTable();
        persistConfig(config);
    });
}

function update(): void {
    updateCategoryTable();
}

function reset(): void {
    config.categories.forEach(category => (category.active = true, category.budget = null));
    config.threshold = defaultConfig.threshold;
    config.scalingFactor = defaultConfig.scalingFactor;

    update();
}
