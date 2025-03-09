import {PointOptionsObject, SeriesSankeyNodesOptionsObject} from "highcharts/highcharts.src";
import Highcharts from "highcharts/es-modules/masters/highcharts.src";
import 'highcharts/es-modules/masters/modules/sankey.src';
import 'highcharts/css/highcharts.css';

import Tree, { TreeNode } from "./tree";
import { Config } from "./config";
import { NodeValidator } from "./validators";
import { numberFormat, numberFormatColored } from "./helper";

declare let categorySeparator: string;

let config: Config;

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
                className: "main-node-label",
                nodeFormatter: function (): string {
                    const node = new SankeyNode(this as Highcharts.SankeyNodeObject);
                    return `${this.name}: ${node.getTotalWeight() == 0 ? '' : numberFormatColored(node.getTotalWeight())}`;
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

    create(): this {
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
                        const node = new SankeyNode(this as Highcharts.SankeyNodeObject);

                        return node.name + ': ' + (new NodeValidator(node, config).validate() ? '' : NodeValidator.warningSign)
                            + numberFormat(node.getSum()) + ' '
                            + (node.getPercentage() && node.getPercentage() < 100 ? "<span class='badge text-bg-secondary'>" + Math.round(node.getPercentage()) + "% </span>" : "");
                    }
                },
                tooltip: {
                    // tooltip for link
                    pointFormatter: function (): string {
                        const point = this as any;
                        return point.fromNode.name + " → " + point.toNode.name + ": " + numberFormat(point.weight/config.scalingFactor) + "<br /><br /><span class='small'>(Klick entfernt die Kategorie aus dem Chart.)</span>";
                    },
                    // tooltip for node
                    nodeFormatter: function (): string {
                        const node = new SankeyNode(this as Highcharts.SankeyNodeObject);

                        let weightsDetailTooltip = '';
                        node.getLinksTo().filter(link => link.from !== String(self.mainNodeId) && link.weight > 0)
                            .forEach(function (link: any) {
                                weightsDetailTooltip += '+ ' + numberFormat(link.weight/config.scalingFactor) + ' (' + link.fromNode.name + ')<br />';
                            });

                        node.getLinksFrom().filter(link => link.to !== String(self.mainNodeId) && link.weight > 0)
                            .forEach(function (link: any) {
                                weightsDetailTooltip += '- ' + numberFormat(link.weight/config.scalingFactor) + ' (' + link.toNode.name + ')<br />';
                            });

                        const validator = new NodeValidator(node, config);
                        validator.validate();

                        return node.toString() + '<br />'
                            + weightsDetailTooltip + '<br />'
                            + validator.messages;
                    }
                },
                nodes: this.buildNodesConfig()
            }],
            chart: {
                height: 700,
                styledMode: true,
                numberFormatter: function () {
                    return numberFormat(arguments[0]/config.scalingFactor);
                },
                events: {
                    render: function() {
                        // add ids for testing
                        this.series[0].points.forEach((link: any, index) => {
                            link.graphic.element.setAttribute('data-testid', `chart-link-${link.custom?.category?.id}`);
                        });
                        ((this.series[0] as any).nodes as Array<Highcharts.SankeyNodeObject>).forEach((point: any, index) => {
                            const node = new SankeyNode(point);
                            point.graphic.element.setAttribute('data-testid', `chart-node-${point.id}`);
                            point.graphic.element.setAttribute('data-value', point.id === '1' ? node.getTotalWeight() : node.getSum());
                            if (point.dataLabel && point.dataLabel.element) {
                                point.dataLabel.element.setAttribute('data-testid', `chart-node-label-${point.id}`);
                            }
                        });
                    }
                }
            }
        });

        this.update();

        return this;
    }

    removeCategory(categoryId: number): void {
        const categoryIds = [...this.chartDataTree.postOrderTraversal(this.chartDataTree.find(categoryId))].map(x => x.key);
        document.dispatchEvent(new CustomEvent('ChartCategoryRemoved', {
            detail: {categoryId: categoryId, childCategoryIds: categoryIds}
        }));

        this.update();
    }

    getNodeById(nodeId: number): SankeyNode {
        const node: Highcharts.SankeyNodeObject = ((this.chart.series[0] as any).nodes as Array<Highcharts.SankeyNodeObject>).find(node => node.id === String(nodeId));
        if (! node) {
            throw new Error('cannot find node with id ' + nodeId);
        }

        return new SankeyNode(node);
    }

    getOutgoingWeights(): Array<number> {
        return [...this.chartDataTree.preOrderTraversal()].filter(x => x.value < 0).map(x => Math.abs(x.value) / config.scalingFactor);
    }
}

export class SankeyNode {
    public name: string = '';
    public categoryId: number;
    public label: string = '';
    private readonly node: SeriesSankeyNodesOptionsObject;

    constructor(node: SeriesSankeyNodesOptionsObject) {
        this.node = node;
        this.name = node.name;
        // @ts-ignore
        this.label = node.dataLabels !== null && typeof node.dataLabels !== 'undefined' && node.dataLabels.length > 0 ? node.dataLabels[0].textStr : '';
        this.categoryId = parseInt((node as any).point.id);
    }

    public toString(): string {
        return `${this.name}: ${this.getSum() == 0 ? '' : numberFormatColored(this.getSum())}`;
    }

    public getSum(): number {
         return 'getSum' in this.node ? (this.node as any).getSum() / config.scalingFactor : 0;
    }

    public getPercentage(): number|null {
        const linksTo = this.getLinksTo();
        if (linksTo.length === 0) {
            return null;
        }

        const parentNode = new SankeyNode((linksTo[0] as any).fromNode);

        return (this.getSum() / parentNode.getTotalOutgoingWeight()) * 100;
    }

    public getLinksFrom(): Array<PointOptionsObject> {
        return 'linksFrom' in this.node ? (this.node as any).linksFrom : [];
    }

    public getLinksTo(): Array<PointOptionsObject> {
        return 'linksTo' in this.node ? (this.node as any).linksTo : [];
    }

    public getTotalIncomingWeight(): number {
        return this.getLinksTo().map(point => point.weight).reduce((pv, cv) => pv + cv, 0) / config.scalingFactor;
    }

    public getTotalOutgoingWeight(): number {
        return this.getLinksFrom().map(point => point.weight).reduce((pv, cv) => pv + cv, 0) / config.scalingFactor;
    }

    public getTotalWeight(): number {
        return this.getTotalIncomingWeight() - this.getTotalOutgoingWeight();
    }
}