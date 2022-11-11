// Highcharts library is loaded via CDN, just importing typedefs here
type _Highcharts = typeof import('../node_modules/highcharts/highcharts');
import Tree from "./Tree";

declare let Highcharts: _Highcharts;
declare let categories: Map<number,string>;
declare let chartDataTree: Tree;
declare let numberOfMonths: number;
declare let currency: string;
let chart = null;
let divider = 1;
let chartData = null;
let excludedCategoryIds: number[] = [];
const mainNodeId = 1;

function ready(fn: any): void {
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

function updateChartData(): void {
    divider = (document.querySelector("form #isShowMonthlyValues") as HTMLInputElement).checked ? numberOfMonths : 1;

    // verify that excludedCategoryIds does not contain main node
    const index = excludedCategoryIds.indexOf(mainNodeId);
    if (index > -1) {
        excludedCategoryIds.splice(index, 1);
    }

    console.debug('excluded category ids:');
    console.debug(excludedCategoryIds);

    // recalculate weight values for each parent node
    [...chartDataTree.postOrderTraversal()].filter(x => x.children.length > 0).map(x => x.value = x.children.reduce(function (a: Tree, b: Tree) {
        return excludedCategoryIds.includes(parseInt(b["key"])) ? a : a + b["value"];
    }, 0));

    // build the data array for the Highchart
    // notes:
    //  - node ids need to be strings according to the Highcharts definitions
    //  - weight has to be positive (thats why the signed value is saved in custom attributes)
    //  - using category ids instead of names because these might be the same for income and expense
    chartData = [...chartDataTree.preOrderTraversal()].filter(x => x.value >= 0 && x.parent && ! excludedCategoryIds.includes(x.key)).map(x => { return {from: String(x.key), to: String(x.parent.key), weight: x.value, custom: {real: x.value}}})
        .concat([...chartDataTree.preOrderTraversal()].filter(x => x.value < 0 && x.parent && ! excludedCategoryIds.includes(x.key)).map(x => { return {from: String(x.parent.key), to: String(x.key), weight: (-1)*x.value, outgoing: !x.hasChildren, custom: {real: x.value}}}));
    console.debug('chart data:');
    console.debug(chartData);
    (chart.series[0] as Highcharts.Series).setData(chartData);
}

function numberFormat(nb: number) {
    return '<strong>' + new Intl.NumberFormat(undefined, { style: 'currency', currency: currency }).format(nb/divider) + '</strong>';
}

function numberFormatColored(nb: number) {
    let color = (nb >= 0) ? '#14c57e' : '#ff6b4a';
    return '<strong style="color:' + color + '">' + numberFormat(nb) + '</strong>';
}

function buildChartNodesConfig() {
    let nodes = [];
    nodes.push({
        id: String(mainNodeId),
        name: categories.get(mainNodeId),
        colorIndex: 1,
        dataLabels: {
            className: "main-node",
            nodeFormatter: function() {
                const incomingWeight = ('linksTo' in this.point ? (this.point as any).linksTo.map(point => point.weight) : []).reduce((pv, cv) => pv + cv, 0);
                const outgoingWeight = ('linksFrom' in this.point ? (this.point as any).linksFrom.map(point => point.weight) : []).reduce((pv, cv) => pv + cv, 0);

                return this.point.name + ': ' + numberFormatColored(incomingWeight - outgoingWeight);
            }
        }
    });

    new Map([...categories].filter(([categoryId, categoryPath]) => categoryId !== mainNodeId))
        .forEach(function(categoryPath, categoryId) {
            nodes.push({
               id: String(categoryId), // Highcarts need the id to be string
               name: categoryPath.split("]] .. CATEGORIES_PATH_SEPARATOR .. [[").pop() // remove first separator from path
            });
    });

    console.debug('nodes data:');
    console.debug(nodes);

    return nodes;
}

ready(function() {
    console.debug('tree data:');
    console.debug(chartDataTree);

    // Fill exclude categories select with category paths
    new Map(
        [...categories].sort((a, b) => a[1] < b[1] ? -1 : 1)
            .filter(([categoryId, categoryPath]) => categoryId !== mainNodeId)
    ).forEach(function(categoryPath, categoryId) {
        // Note: we do not use the category ids as values in the select as otherwise the category names could be duplicated in the select (for income and expense)
        (document.querySelector('form #categories') as HTMLSelectElement).add(new Option(categoryPath, categoryPath))
    });

    document.querySelector("form label[for='isShowMonthlyValues']").insertAdjacentText("beforeend" , "(insg. " + Math.round(numberOfMonths) + " Monat(e))");
    if (Math.round(numberOfMonths) == 1) {
        document.querySelector("form input#isShowMonthlyValues").setAttribute('disabled', 'disabled');
    }
    document.querySelector("#applySettingsButton").addEventListener('click', () => { setExcludedCategoriesFromSelect(); updateChartData() });

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

                    updateChartData();
                }
            },
            keys: ['from', 'to', 'weight'],
            data: [],
            type: 'sankey',
            name: 'Cashflow',
            dataLabels: {
                align: 'right',
                padding: 30,
                nodeFormatter: function() {
                    const point = this as any;
                    const percentage = 'linksTo' in point && point.linksTo[0] ? (point.sum / point.linksTo[0].fromNode.sum) * 100 : null;
                    return this.point.name + ": " + numberFormat(('getSum' in this.point ? (this.point as any).getSum() : 0)) + " " + (percentage ? "<span class='badge text-bg-secondary'>" + Math.round(percentage) + "% </span>" : "");
                }
            },
            tooltip: {
                // tooltip for link
                pointFormatter: function() {
                    const point = this as any;
                    return point.fromNode.name + " → " + point.toNode.name + ": " + numberFormat(point.weight);
                },
                // tooltip for node
                nodeFormatter:  function() {
                    const point = this as any;

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
            nodes: buildChartNodesConfig(),
        }],
        chart: {
            height: 700,
            styledMode: true,
            numberFormatter: function () {
                return numberFormat(arguments[0]);
            }
        }
    });

    updateChartData();
});