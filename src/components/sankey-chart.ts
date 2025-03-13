import Alpine from '@alpinejs/csp';
import {PointOptionsObject, SeriesSankeyNodesOptionsObject} from "highcharts/highcharts.src";
import Highcharts from "highcharts/es-modules/masters/highcharts.src";
import 'highcharts/es-modules/masters/modules/sankey.src';
import 'highcharts/css/highcharts.css';

import Tree, { TreeNode } from "../tree";
import { Config } from "../config";
import { NodeValidator } from "../validators";
import { numberFormat, numberFormatColored } from "../helper";
import {Category} from "../transaction";

export default (data: Tree) => ({
    categoryTree: data,
    chart: Highcharts.Chart = null,
    mainNodeId: data.root.key,

    get scaling(): number {
        return this.config.scalingFactor;
    },

    get threshold(): number {
        return this.config.threshold;
    },

    get categories(): Map<number,Category> {
        return this.config.categories;
    },

    get config(): Config {
        return Alpine.store('config');
    },

    get nodes(): Array<TreeNode> {
        const treeNodes: Array<TreeNode> = [...this.categoryTree.postOrderTraversal()]
            .filter(x => Math.abs(x.value) >= this.threshold && this.categories.get(x.key)?.active);

        // recalculate weight values for each parent node
        // @todo merge with this.categoryTree.resetNodeValues()?
        treeNodes.filter(x => x.hasChildren).map(x => x.value = x.children.reduce((a, b): number => {
            const category = this.categories.get(b.key);
            return Math.abs(b.value) >= this.threshold && category.active ? a + b.value : a;
        }, 0));

        this.config.chartData = treeNodes;

        return treeNodes;
    },

    update(): void {
        console.debug('updating chart data..');

        const treeNodes = this.nodes;

        // build the data array for the Highchart
        // remarks:
        //  - node ids need to be strings according to the Highcharts definitions
        //  - weight has to be positive (thats why the signed value is saved in custom attributes)
        //  - using category ids instead of names because these might be the same for income and expense
        let chartData: Array<PointOptionsObject> = treeNodes.filter(x => x.value >= 0 && x.parent).map(x => {
            return {
                from: String(x.key),
                to: String(x.parent.key),
                weight: x.value,
                custom: {real: x.value, category: this.categories.get(x.key)}
            }
        }).concat(treeNodes.filter(x => x.value < 0 && x.parent).map(x => {
            return {
                from: String(x.parent.key),
                to: String(x.key),
                weight: (-1) * x.value,
                outgoing: !x.hasChildren,
                custom: {real: x.value, category: this.categories.get(x.key)}
            }
        }));

        console.debug('chart data:');
        console.debug(chartData);

        (this.chart.series[0] as Highcharts.Series).setData(chartData);

        if (chartData.length === 0) {
            document.getElementById('header-configuration').setAttribute('disabled', String(true));
        } else {
            document.getElementById('header-configuration').removeAttribute('disabled');
        }
    },

    buildNodesConfig(): Array<SeriesSankeyNodesOptionsObject> {
        const self = this;

        let nodes: Array<SeriesSankeyNodesOptionsObject> = [];
        nodes.push({
            id: String(this.mainNodeId),
            name: this.categories.get(this.mainNodeId)?.name,
            colorIndex: 1,
            dataLabels: {
                className: "main-node-label",
                nodeFormatter: function (): string {
                    const node = new SankeyNode(this as Highcharts.SankeyNodeObject, self.mainNodeId, self.scaling);
                    return node.toString();
                }
            },
        });

        new Map([...self.categories].filter(([categoryId, category]) => categoryId !== this.mainNodeId))
            .forEach((category: Category) => {
                nodes.push({
                    id: String(category.id), // Highcharts needs the id to be string
                    name: category.name,
                });
            });

        console.debug('nodes data:');
        console.debug(nodes);

        return nodes;
    },

    init(): void {
        console.debug('tree data:');
        console.debug(this.categories);

        const self = this;

        /** @see https://www.highcharts.com/docs/chart-and-series-types/sankey-diagram */
        this.chart = Highcharts.chart(this.el, {
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
                        const node = new SankeyNode(this as Highcharts.SankeyNodeObject, self.mainNodeId, self.scaling);

                        return '<small>' + node.name + '</small><br>' + (new NodeValidator(node, self.config).validate() ? '' : NodeValidator.warningSign)
                            + numberFormat(node.getValue());
                    }
                },
                tooltip: {
                    // tooltip for link
                    pointFormatter: function (): string {
                        const link = this as any;
                        const toNode = new SankeyNode(link.toNode, self.mainNodeId, self.scaling);

                        return link.fromNode.name + " → " + link.toNode.name + ": "
                            + numberFormat(link.weight / self.scaling)
                            + (toNode.getPercentage() && toNode.getPercentage() < 100 ? " <span class='badge text-bg-secondary'>" + Math.round(toNode.getPercentage()) + "% </span>" : "")
                            + "<br><br><span class='small'>(Klick entfernt die Kategorie aus dem Chart.)</span>";
                    },
                    // tooltip for node
                    nodeFormatter: function (): string {
                        const node = new SankeyNode(this as Highcharts.SankeyNodeObject, self.mainNodeId, self.scaling);

                        let weightsDetailTooltip = '';
                        node.getLinksTo().filter(link => link.from !== String(self.mainNodeId) && link.weight > 0)
                            .sort((a, b) => b.weight - a.weight)
                            .forEach(function (link: any) {
                                weightsDetailTooltip += '+ ' + numberFormat(link.weight / self.scaling) + ' (' + link.fromNode.name + ')<br>';
                            });
                        if (node.isMain) {
                            weightsDetailTooltip += '= ' + numberFormat(node.getTotalIncomingWeight()) + '<br><br>';
                        }

                        node.getLinksFrom().filter(link => link.to !== String(self.mainNodeId) && link.weight > 0)
                            .sort((a, b) => b.weight - a.weight)
                            .forEach(function (link: any) {
                                weightsDetailTooltip += '- ' + numberFormat(link.weight / self.scaling) + ' (' + link.toNode.name + ')<br>';
                            });
                        if (node.isMain) {
                            weightsDetailTooltip += '= ' + numberFormat(node.getTotalOutgoingWeight()) + '<br>';
                        }

                        const validator = new NodeValidator(node, self.config);
                        validator.validate();

                        return node.toString() + '<br>'
                            + weightsDetailTooltip + '<br>'
                            + validator.messages;
                    }
                },
                nodes: this.buildNodesConfig()
            }],
            chart: {
                height: 700,
                styledMode: true,
                numberFormatter: function () {
                    return numberFormat(arguments[0] / self.scaling);
                },
                events: {
                    render: function () {
                        // add ids for testing
                        this.series[0].points.forEach((link: any, index) => {
                            link.graphic?.element.setAttribute('data-testid', `chart-link-${link.custom?.category?.id}`);
                        });

                        ((this.series[0] as any).nodes as Array<Highcharts.SankeyNodeObject>).forEach((point: any, index) => {
                            const node = new SankeyNode(point, self.mainNodeId, self.scaling);
                            point.graphic?.element.setAttribute('data-testid', `chart-node-${point.id}`);
                            point.graphic?.element.setAttribute('data-value', node.getValue());
                            if (point.dataLabel && point.dataLabel.element) {
                                point.dataLabel.element.setAttribute('data-testid', `chart-node-label-${point.id}`);
                            }
                        });
                    }
                }
            },
        });

        this.update();

        document.addEventListener('ChartInvalidated', () => this.update());
    },

    removeCategory(categoryId: number): void {
       [...this.categoryTree.postOrderTraversal(this.categoryTree.find(categoryId))].map(x => x.key)
           .forEach((categoryId: number) => this.categories.get(categoryId).active = false);

        this.update();
    },
});

export class SankeyNode { // @todo use accessors
    public name: string = '';
    public categoryId: number;
    public label: string = '';
    public mainNodeId: number;
    private readonly node: Highcharts.SankeyNodeObject;
    private readonly scaling: number;

    constructor(node: Highcharts.SankeyNodeObject, mainNodeId: number, scaling: number) {
        this.node = node;
        this.name = node.name;
        // @ts-ignore
        this.label = node.dataLabels !== null && typeof node.dataLabels !== 'undefined' && node.dataLabels.length > 0 ? node.dataLabels[0].textStr : '';
        this.categoryId = parseInt((node as any).point.id);

        this.mainNodeId = mainNodeId;
        this.scaling = scaling;
    }

    get isMain(): boolean {
        return Number(this.node.id) === this.mainNodeId;
    }

    public toString(): string {
        const format = this.isMain ? numberFormatColored : numberFormat;
        return `${this.name}<br>${this.getValue() == 0 ? '' : format(this.getValue())}`;
    }

    public getValue(): number {
        return this.isMain ? this.getTotalWeight() : this.getSum();
    }

    private getSum(): number {
         return 'getSum' in this.node ? (this.node as any).getSum() / this.scaling : 0;
    }

    public getPercentage(): number|null {
        const linksTo = this.getLinksTo();
        if (linksTo.length === 0) {
            return null;
        }

        const parentNode = new SankeyNode((linksTo[0] as any).fromNode, this.mainNodeId, this.scaling);

        return (this.getValue() / parentNode.getTotalOutgoingWeight()) * 100;
    }

    public getLinksFrom(): Array<PointOptionsObject> {
        return 'linksFrom' in this.node ? (this.node as any).linksFrom : [];
    }

    public getLinksTo(): Array<PointOptionsObject> {
        return 'linksTo' in this.node ? (this.node as any).linksTo : [];
    }

    public getTotalIncomingWeight(): number {
        return this.getLinksTo().map(point => point.weight).reduce((pv, cv) => pv + cv, 0) / this.scaling;
    }

    public getTotalOutgoingWeight(): number {
        return this.getLinksFrom().map(point => point.weight).reduce((pv, cv) => pv + cv, 0) / this.scaling;
    }

    private getTotalWeight(): number {
        return this.getTotalIncomingWeight() - this.getTotalOutgoingWeight();
    }
}