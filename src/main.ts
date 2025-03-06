import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import {Config, save as persistConfig, load as loadConfig} from "./config";
import defaultConfig from "./config";
import Tree from "./tree";
import {SankeyChart} from "./sankey";
import {Category} from "./category";
import './style.css';

let config: Config = defaultConfig;
let chart: SankeyChart;

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
            .sort((a, b) => a[1].name.localeCompare(b[1].name)))
        .forEach((category, categoryId) => {
            const row = document.createElement('tr');
            row.dataset.categoryId = String(categoryId);
            row.innerHTML = `
                  <td>${category.name}</td>
                  <td><input type="number" class="form-control" name="budget" placeholder="0,00" min="0" step="0.01" value="${category.budget}"></td>
                  <td><div class="form-check"><input id="exclude-category-${categoryId}" name="category-is-active" class="form-check-input" type="checkbox" value="${category.name}" ${category.active ? 'checked' : ''}></div></td>
                `;
            tbody.appendChild(row);
        }
    );

    container.appendChild(table);
}

function setScaling(): void {
    const input = document.querySelector("input#is-show-monthly") as HTMLInputElement;
    config.scalingFactor = input.checked ? parseFloat(input.value) : defaultConfig.scalingFactor;
    console.debug('scaling: ' + config.scalingFactor);
}

function setThreshold(): void {
    let threshold = parseFloat((document.querySelector("input#threshold") as HTMLInputElement).value);
    config.threshold = isNaN(threshold) ? defaultConfig.threshold : threshold * config.scalingFactor;
    console.debug('threshold: ' + config.threshold);
}

export function initApp(chartDataTree: Tree, numberOfMonths: number, currency: string, categories: Map<number,Category>): void {
    config = loadConfig() ?? config;

    config.categories = new Map([...categories, ...config.categories]);
    config.currency = currency;

    chart = new SankeyChart(chartDataTree, config);

    update();

    if (Math.round(numberOfMonths) == 1) {
        document.querySelector("input#is-show-monthly").setAttribute('disabled', 'disabled');
    }

    document.querySelector("input#is-show-monthly").addEventListener('change', (event) => {
        event.preventDefault();

        setScaling();
        persistConfig(config);
        chart.update();
    });

    document.querySelector("input#threshold").addEventListener('change', (event) => {
        event.preventDefault();

        setThreshold();
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

    // @ts-ignore
    window.chart = chart.create();
}

function update(): void {
    updateCategoryTable();
    (document.querySelector("input#threshold") as HTMLInputElement).value = String((config.threshold / config.scalingFactor).toFixed(2));
    (document.querySelector("input#is-show-monthly") as HTMLInputElement).checked = config.scalingFactor !== 1;
}

function reset(): void {
    config.categories.forEach(category => (category.active = true, category.budget = null));
    config.threshold = defaultConfig.threshold;
    config.scalingFactor = defaultConfig.scalingFactor;

    update();
}