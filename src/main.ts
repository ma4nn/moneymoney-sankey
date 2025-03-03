import Highcharts from 'highcharts/es-modules/masters/highcharts.src.js';
import 'highcharts/es-modules/masters/modules/sankey.src';
import 'highcharts/css/highcharts.css';

import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import Tree from "./Tree";
import './style.css';
import {PointOptionsObject, SeriesSankeyNodesOptionsObject} from "highcharts/highcharts.src";

let categories: Map<number,string>;
let numberOfMonths: number;
let currency: string;
let chart: Highcharts.Chart = null;
let scaling_factor: number = 1;
let chartData: Array<PointOptionsObject> = null;
let excludedCategoryIds: number[] = [];
const mainNodeId: number = 1;

export { Tree }

export function ready(fn: any): void {
    if (document.readyState !== 'loading') {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}

function getCategoryIdByPath(val: string): number {
    return [...categories].find(([key, value]) => val === value)[0];
}

function setExcludedCategoriesFromSelect(): void {
    // Translate excluded category paths to category ids (necessary because we might have the same path for income and expense)
    const excludedCategoryPaths = [...(document.querySelector("form #categories") as HTMLSelectElement).options].filter(option => option.selected).map(option => option.value);
    [...categories].filter(([categoryId, categoryPath]) => excludedCategoryPaths.includes(categoryPath))
        .map(([categoryId, categoryPath]) => excludedCategoryIds.push(categoryId));
}

function updateChartData(chartDataTree: Tree): void {
    console.debug('updating chart data..');

    scaling_factor = (document.querySelector("form #isShowMonthlyValues") as HTMLInputElement).checked ? numberOfMonths : 1;
    console.debug('scaling: ' + scaling_factor);

    let threshold = parseFloat((document.querySelector("form #threshold") as HTMLInputElement).value);
    threshold = isNaN(threshold) ? 0 : threshold;
    console.debug('threshold: ' + threshold);

    // verify that excludedCategoryIds does not contain main node
    const index = excludedCategoryIds.indexOf(mainNodeId);
    if (index > -1) {
        excludedCategoryIds.splice(index, 1);
    }

    console.debug('excluded category ids:');
    console.debug(excludedCategoryIds);

    // recalculate weight values for each parent node
    [...chartDataTree.postOrderTraversal()].filter(x => x.children.length > 0).map(x => x.value = x.children.reduce((a: Tree, b: Tree) => {
        return excludedCategoryIds.includes(parseInt(b["key"])) ? a : a + b["value"];
    }, 0));

    // build the data array for the Highchart
    // notes:
    //  - node ids need to be strings according to the Highcharts definitions
    //  - weight has to be positive (thats why the signed value is saved in custom attributes)
    //  - using category ids instead of names because these might be the same for income and expense
    chartData = [...chartDataTree.preOrderTraversal()].filter(x => x.value >= 0 && x.parent && ! excludedCategoryIds.includes(x.key)).map(x => { return {from: String(x.key), to: String(x.parent.key), weight: x.value, custom: {real: x.value}}})
        .concat([...chartDataTree.preOrderTraversal()].filter(x => x.value < 0 && x.parent && ! excludedCategoryIds.includes(x.key)).map(x => { return {from: String(x.parent.key), to: String(x.key), weight: (-1)*x.value, outgoing: !x.hasChildren, custom: {real: x.value}}}));
    chartData = chartData.filter((x: PointOptionsObject) => Math.abs(x.weight) > threshold);

    console.debug('chart data:');
    console.debug(chartData);

    (chart.series[0] as Highcharts.Series).setData(chartData);

    // add ids for testing
    chart.series[0].points.map(point => point.graphic.element).forEach((elem, i) => elem.setAttribute('data-testid', 'chart-node-' + i));
}

function numberFormat(nb: number) {
    return '<strong>' + new Intl.NumberFormat(undefined, { style: 'currency', currency: currency }).format(nb/scaling_factor) + '</strong>';
}

function numberFormatColored(nb: number) {
    let color = (nb >= 0) ? '#14c57e' : '#ff6b4a';
    return '<strong style="color:' + color + '">' + numberFormat(nb) + '</strong>';
}

function buildChartNodesConfig(): Array<SeriesSankeyNodesOptionsObject> {
    let nodes: Array<SeriesSankeyNodesOptionsObject> = [];
    nodes.push({
        id: String(mainNodeId),
        name: categories.get(mainNodeId),
        colorIndex: 1,
        dataLabels: {
            className: "main-node",
            nodeFormatter: function(): string {
                // @ts-ignore
                const point: any = this.point;
                const incomingWeight = ('linksTo' in point ? point.linksTo.map((point: PointOptionsObject) => point.weight) : []).reduce((pv, cv) => pv + cv, 0);
                const outgoingWeight = ('linksFrom' in point ? point.linksFrom.map(point => point.weight) : []).reduce((pv, cv) => pv + cv, 0);

                return point.name + ': ' + numberFormatColored(incomingWeight - outgoingWeight);
            }
        }
    });

    new Map([...categories].filter(([categoryId, categoryPath]) => categoryId !== mainNodeId))
        .forEach(function(categoryPath, categoryId) {
            nodes.push({
               id: String(categoryId), // Highcarts needs the id to be string
               name: categoryPath.split("]] .. CATEGORIES_PATH_SEPARATOR .. [[").pop() // remove first separator from path
            });
    });

    console.debug('nodes data:');
    console.debug(nodes);

    return nodes;
}

export function createChart(chartDataTree: Tree, initCategories: Map<number,string>, initNumberOfMonths: number, initCurrency: string): Highcharts.Chart {
    categories = initCategories;
    numberOfMonths = initNumberOfMonths;
    currency = initCurrency;

    console.debug('tree data:');
    console.debug(chartDataTree);

    // Fill exclude categories select with category paths
    new Map(
        [...categories].sort((a, b) => a[1] < b[1] ? -1 : 1)
            .filter(([categoryId, categoryPath]) => categoryId !== mainNodeId)
    ).forEach(function(categoryPath: string, categoryId: number) {
        // Note: we do not use the category ids as values in the select as otherwise the category names could be duplicated in the select (for income and expense)
        (document.querySelector('form #categories') as HTMLSelectElement).add(new Option(categoryPath, categoryPath))
    });

    if (Math.round(numberOfMonths) == 1) {
        document.querySelector("form input#isShowMonthlyValues").setAttribute('disabled', 'disabled');
    }

    document.querySelector("#applySettingsButton").addEventListener('click', (event) => {
        event.preventDefault();
        setExcludedCategoriesFromSelect();
        updateChartData(chartDataTree);
    });

    /** @see https://www.highcharts.com/docs/chart-and-series-types/sankey-diagram */
    chart = Highcharts.chart('chart-container', {
        title: {
            text: null
        },
        accessibility: {
            point: {
                valueDescriptionFormat: '{index}. {point.from} to {point.to}, {point.weight}.'
            }
        },
        series: [{
            animation: false,
            cursor: 'pointer',
            events: {
                click: function (event: any) {
                    if (! ('custom' in event.point) || ! ('real' in event.point.custom)) {
                        return;
                    }

                    let categoryId: number;
                    if (event.point.to !== mainNodeId && event.point.custom.real < 0) {
                         categoryId= parseInt(event.point.to);
                    } else if (event.point.from !== mainNodeId && event.point.custom.real >= 0) {
                         categoryId= parseInt(event.point.from);
                    } else {
                        return;
                    }

                    [...chartDataTree.postOrderTraversal(chartDataTree.find(categoryId))].map(x => {
                        console.debug('excluding category ' + x.key);
                        excludedCategoryIds.push(x.key);
                    });

                    // update select element
                    Array.from((document.querySelector('form #categories') as HTMLSelectElement).options).forEach(function (option) {
                        option.selected = excludedCategoryIds.includes(getCategoryIdByPath(option.value));
                    });

                    updateChartData(chartDataTree);
                }
            },
            keys: ['from', 'to', 'weight'],
            data: [],
            type: 'sankey',
            name: 'Cashflow',
            dataLabels: {
                align: 'right',
                padding: 30,
                nodeFormatter: function(): string {
                    const point = this as Highcharts.Point;
                    const sum = 'getSum' in this ? (this as any).getSum() : 0;
                    const percentage = 'linksTo' in point && point.linksTo[0] ? (sum / point.linksTo[0].fromNode.sum) * 100 : null;

                    return point.name + ": " + numberFormat(sum) + " " + (percentage ? "<span class='badge text-bg-secondary'>" + Math.round(percentage) + "% </span>" : "");
                }
            },
            tooltip: {
                // tooltip for link
                pointFormatter: function(): string {
                    const point = this as any;
                    return point.fromNode.name + " → " + point.toNode.name + ": " + numberFormat(point.weight) + "<br /><br /><span class='small'>(Klick entfernt die Kategorie aus dem Chart.)</span>";
                },
                // tooltip for node
                nodeFormatter: function(): string {
                    const point = this as Highcharts.Point;

                    let totalWeight = 0;
                    let weightsDetailTooltip = '';
                    const linksTo = 'linksTo' in point ? (point as any).linksTo : [];
                    linksTo.forEach(function(link: any) {
                        if (link.from === mainNodeId || link.weight === 0) return;
                        weightsDetailTooltip += '+ ' + numberFormat(link.weight) + ' (' + link.fromNode.name + ')<br />';
                        totalWeight += link.weight;
                    });

                    const linksFrom = 'linksFrom' in point ? (point as any).linksFrom : [];
                    linksFrom.forEach(function(link: any) {
                        if (link.to === mainNodeId || link.weight === 0) return;
                        weightsDetailTooltip += '- ' + numberFormat(link.weight) + ' (' + link.toNode.name + ')<br />';
                        totalWeight -= link.weight;
                    });

                    totalWeight = Number(totalWeight.toFixed(2));

                    return point.name + ': ' + (totalWeight != 0 ? numberFormatColored(totalWeight) : '') + '<br />' + weightsDetailTooltip;
                }
            },
            nodes: buildChartNodesConfig()
        }],
        chart: {
            height: 700,
            styledMode: true,
            numberFormatter: function () {
                return numberFormat(arguments[0]);
            }
        }
    });

    updateChartData(chartDataTree);

    return chart;
}