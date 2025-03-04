import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import {Config, save as persistConfig, load as loadConfig} from "./config";
import Tree from "./Tree";
import {SankeyChart} from "./sankey";
import {Category} from "./category";
import './style.css';

let chart: SankeyChart;
const defaultThreshold: number = 0;
const defaultScaling: number = 1;

let config: Config = {excludedCategoryIds: [], scalingFactor: defaultScaling, threshold: defaultThreshold, currency: 'EUR', categories: new Map()};

export { Tree }

export function ready(fn: any): void {
    if (document.readyState !== 'loading') {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}

function setCategories(): void {
    document.querySelectorAll<HTMLTableRowElement>("form #category-config tbody tr").forEach(row => {
        config.categories.get(parseInt(row.dataset.categoryId)).active = row.querySelector<HTMLInputElement>('input[name="category-is-active"]').checked
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

    new Map([...config.categories.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))).forEach((category, categoryId) => {
        if (categoryId === chart.mainNodeId) {
            return;
        }

        const row = document.createElement('tr');
        row.dataset.categoryId = String(categoryId);
        // Note: we do not use the category ids as values as otherwise the category names could be duplicated in the select (for income and expense)
        row.innerHTML = `
      <td>${category.name}</td>
      <td><div class="form-check"><input id="exclude-category-${categoryId}" name="category-is-active" class="form-check-input" type="checkbox" value="${category.name}" ${category.active ? 'checked' : ''}></div></td>
    `;
        tbody.appendChild(row);
    });

    container.appendChild(table);
}

function setScaling(): void {
    const input = document.querySelector("form #isShowMonthlyValues") as HTMLInputElement;
    config.scalingFactor = input.checked ? parseFloat(input.value) : defaultScaling;
    console.debug('scaling: ' + config.scalingFactor);
}

function setThreshold(): void {
    let threshold = parseFloat((document.querySelector("form #threshold") as HTMLInputElement).value);
    config.threshold = isNaN(threshold) ? defaultThreshold : threshold * config.scalingFactor;
    console.debug('threshold: ' + config.threshold);
}

export function initApp(chartDataTree: Tree, numberOfMonths: number, currency: string, categories: Map<number,Category>): void {
    config = loadConfig() ?? config;

    config.categories = categories;
    config.currency = currency;

    chart = new SankeyChart(chartDataTree, config);

    update();

    if (Math.round(numberOfMonths) == 1) {
        document.querySelector("form input#isShowMonthlyValues").setAttribute('disabled', 'disabled');
    }

    document.querySelector("#apply-settings-btn").addEventListener('click', (event) => {
        event.preventDefault();

        applyConfig();
        persistConfig(config);
        update();
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

    // @ts-ignore
    window.chart = chart.create();
}

function applyConfig(): void {
    setScaling();
    setThreshold();
    setCategories();
    chart.update();
}

function update(): void {
    updateCategoryTable();
    (document.querySelector("form #threshold") as HTMLInputElement).value = String(config.threshold / config.scalingFactor);
    (document.querySelector("form input#isShowMonthlyValues") as HTMLInputElement).checked = config.scalingFactor !== 1;
}

function reset(): void {
    config.categories.forEach(category => category.active = true);
    config.threshold = defaultThreshold;
    config.scalingFactor = defaultScaling;

    update();
}