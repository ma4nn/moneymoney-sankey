import {PointOptionsObject, SeriesSankeyNodesOptionsObject} from "highcharts/highcharts.src";
import Highcharts from "highcharts/es-modules/masters/highcharts.src";
import 'highcharts/es-modules/masters/modules/sankey.src';
import 'highcharts/css/highcharts.css';

import Tree, { TreeNode } from "./Tree";
import { Config } from "./config";

declare let categorySeparator: string;

let config: Config;

function numberFormat(nb: number) {
    return '<strong>' + new Intl.NumberFormat(undefined, { style: 'currency', currency: config.currency }).format(nb/config.scalingFactor) + '</strong>';
}

function numberFormatColored(nb: number) {
    let color = (nb >= 0) ? '#14c57e' : '#ff6b4a';
    return '<strong style="color:' + color + '">' + numberFormat(nb) + '</strong>';
}

export class SankeyChart {
    public mainNodeId: number = 1;
    private readonly chartDataTree: Tree;
    private chart: Highcharts.Chart = null;

    constructor(initChartDataTree: Tree, initConfig: Config) {
        this.chartDataTree = initChartDataTree;
        config = initConfig;
    }

    update(): void {
        console.debug('updating chart data..');

        this.calculateNodeWeights();

        const treeNodes: Array<TreeNode> = [...this.chartDataTree.preOrderTraversal()].filter(x => Math.abs(x.value) > config.threshold && config.categories.get(x.key).active);

        // build the data array for the Highchart
        // remarks:
        //  - node ids need to be strings according to the Highcharts definitions
        //  - weight has to be positive (thats why the signed value is saved in custom attributes)
        //  - using category ids instead of names because these might be the same for income and expense
        let chartData: Array<PointOptionsObject> = treeNodes.filter(x => x.value >= 0 && x.parent).map(x => {
            return {from: String(x.key), to: String(x.parent.key), weight: x.value, custom: {real: x.value, category: config.categories.get(x.key)}}
        }).concat(treeNodes.filter(x => x.value < 0 && x.parent).map(x => {
            return {
                from: String(x.parent.key),
                to: String(x.key),
                weight: (-1) * x.value,
                outgoing: !x.hasChildren,
                custom: {real: x.value, category: config.categories.get(x.key)}
            }
        }));

        console.debug('chart data:');
        console.debug(chartData);

        (this.chart.series[0] as Highcharts.Series).setData(chartData);

        // add ids for testing
        this.chart.series[0].points.forEach((point: any, i) => point.graphic.element.setAttribute('data-testid', 'chart-node-' + point.custom?.category?.id));
    }

    private calculateNodeWeights(): void {
        // recalculate weight values for each parent node
        [...this.chartDataTree.postOrderTraversal()].filter(x => x.children.length > 0).map(x => x.value = x.children.reduce((a, b): number => {
            const category = config.categories.get(b.key);
            return category.active ? a + b.value : a;
        }, 0));
    }

    buildNodesConfig(): Array<SeriesSankeyNodesOptionsObject> {
        let nodes: Array<SeriesSankeyNodesOptionsObject> = [];
        nodes.push({
            id: String(this.mainNodeId),
            name: config.categories.get(this.mainNodeId).name,
            colorIndex: 1,
            dataLabels: {
                className: "main-node",
                nodeFormatter: function (): string {
                    // @ts-ignore
                    const node: any = this.point; // for Sankey charts this refers to nodes, not links
                    const incomingWeight = ('linksTo' in node ? node.linksTo.map((point: PointOptionsObject) => point.weight) : []).reduce((pv, cv) => pv + cv, 0);
                    const outgoingWeight = ('linksFrom' in node ? node.linksFrom.map(point => point.weight) : []).reduce((pv, cv) => pv + cv, 0);

                    return node.name + ': ' + numberFormatColored(incomingWeight - outgoingWeight);
                }
            }
        });

        new Map([...config.categories].filter(([categoryId, category]) => categoryId !== this.mainNodeId))
            .forEach(function (category, categoryId) {
                nodes.push({
                    id: String(categoryId), // Highcarts needs the id to be string
                    name: category.name.split(categorySeparator).pop(), // remove first separator from path
                });
            });

        console.debug('nodes data:');
        console.debug(nodes);

        return nodes;
    }

    create(): Highcharts.Chart {
        console.debug('tree data:');
        console.debug(this.chartDataTree);

        const self = this;

        /** @see https://www.highcharts.com/docs/chart-and-series-types/sankey-diagram */
        this.chart = Highcharts.chart('chart-container', {
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
                        if (!('custom' in event.point) || !('real' in event.point.custom)) {
                            return;
                        }

                        let categoryId: number;
                        if (event.point.to !== self.mainNodeId && event.point.custom.real < 0) {
                            categoryId = parseInt(event.point.to);
                        } else if (event.point.from !== self.mainNodeId && event.point.custom.real >= 0) {
                            categoryId = parseInt(event.point.from);
                        } else {
                            return;
                        }

                        self.removeCategory(categoryId);
                    }
                },
                keys: ['from', 'to', 'weight'],
                data: [],
                type: 'sankey',
                name: 'Cashflow',
                dataLabels: {
                    align: 'right',
                    padding: 30,
                    nodeFormatter: function (): string {
                        const node = this as Highcharts.Point;
                        const sum = 'getSum' in this ? (this as any).getSum() : 0;
                        const percentage = 'linksTo' in node && node.linksTo[0] ? (sum / node.linksTo[0].fromNode.sum) * 100 : null;
                        const category = config.categories.get(parseInt((node as any).point.id));

                        return node.name + ': ' + ((typeof category?.budget != 'undefined' && category?.budget * config.scalingFactor < sum) ? '⚠️ ' : '')
                            + numberFormat(sum) + ' '
                            + (percentage ? "<span class='badge text-bg-secondary'>" + Math.round(percentage) + "% </span>" : "");
                    }
                },
                tooltip: {
                    // tooltip for link
                    pointFormatter: function (): string {
                        const point = this as any;
                        return point.fromNode.name + " → " + point.toNode.name + ": " + numberFormat(point.weight) + "<br /><br /><span class='small'>(Klick entfernt die Kategorie aus dem Chart.)</span>";
                    },
                    // tooltip for node
                    nodeFormatter: function (): string {
                        const point = this as Highcharts.Point;

                        let totalWeight = 0;
                        let weightsDetailTooltip = '';
                        const linksTo = 'linksTo' in point ? (point as any).linksTo : [];
                        linksTo.forEach(function (link: any) {
                            if (link.from === self.mainNodeId || link.weight === 0) return;
                            weightsDetailTooltip += '+ ' + numberFormat(link.weight) + ' (' + link.fromNode.name + ')<br />';
                            totalWeight += link.weight;
                        });

                        const linksFrom = 'linksFrom' in point ? (point as any).linksFrom : [];
                        linksFrom.forEach(function (link: any) {
                            if (link.to === self.mainNodeId || link.weight === 0) return;
                            weightsDetailTooltip += '- ' + numberFormat(link.weight) + ' (' + link.toNode.name + ')<br />';
                            totalWeight -= link.weight;
                        });

                        totalWeight = Number(totalWeight.toFixed(2));

                        return point.name + ': ' + (totalWeight != 0 ? numberFormatColored(totalWeight) : '') + '<br />' + weightsDetailTooltip;
                    }
                },
                nodes: this.buildNodesConfig()
            }],
            chart: {
                height: 700,
                styledMode: true,
                numberFormatter: function () {
                    return numberFormat(arguments[0]);
                }
            }
        });

        this.update();

        return this.chart;
    }

    removeCategory(categoryId: number) {
        const categoryIds = [...this.chartDataTree.postOrderTraversal(this.chartDataTree.find(categoryId))].map(x => x.key);
        document.dispatchEvent(new CustomEvent('ChartCategoryRemoved', {
            detail: {categoryId: categoryId, childCategoryIds: categoryIds}
        }));

        this.update();
    }
}