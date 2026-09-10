import {SeriesSankeyNodesOptionsObject} from "highcharts/highcharts.src";
import Highcharts from "highcharts/es-modules/masters/highcharts.src";
import 'highcharts/es-modules/masters/modules/sankey.src';
import 'highcharts/css/highcharts.css';
import './style.css';

import {SankeyChartData, SankeyChartHooks, SankeyChartLink, SankeyChartNode, SankeyChartRenderer} from "../types";

const MAIN_NODE_COLOR_INDEX = 1; // styled via .highcharts-color-1 in style.css

// all Highcharts specifics live here, see https://www.highcharts.com/docs/chart-and-series-types/sankey-diagram
export default class HighchartsSankeyRenderer implements SankeyChartRenderer {
    private chart: Highcharts.Chart|null = null;

    mount(container: HTMLElement, data: SankeyChartData, hooks: SankeyChartHooks): void {
        this.chart = Highcharts.chart(container, {
            title: {
                text: undefined // disables the default chart title
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
                        // node points carry no custom payload, only links are clickable
                        if (!('custom' in event.point) || !('real' in event.point.custom)) {
                            return;
                        }

                        hooks.onLinkClick(HighchartsSankeyRenderer.toChartLink(event.point));
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
                        return hooks.nodeLabel(String((this as any).point.id));
                    }
                },
                tooltip: {
                    // tooltip for link
                    pointFormatter: function (): string {
                        return hooks.linkTooltip(HighchartsSankeyRenderer.toChartLink(this));
                    },
                    // tooltip for node
                    nodeFormatter: function (): string {
                        return hooks.nodeTooltip(String((this as any).point.id));
                    }
                },
                nodes: this.buildNodesOptions(data.nodes)
            }],
            chart: {
                animation: false,
                height: 700,
                styledMode: true,
                numberFormatter: function (...args) {
                    return hooks.formatValue(args[0]);
                },
                events: {
                    render: function () {
                        // add ids for testing
                        this.series[0].points.forEach((link: any, _index) => {
                            link.graphic?.element.setAttribute('data-testid', `chart-link-${link.categoryId}`);
                        });

                        ((this.series[0] as any).nodes as Array<Highcharts.SankeyNodeObject>).forEach((point: any, _index) => {
                            point.graphic?.element.setAttribute('data-testid', `chart-node-${point.id}`);
                            point.graphic?.element.setAttribute('data-value', hooks.nodeValue(String(point.id)));
                            if (point.dataLabel && point.dataLabel.element) {
                                point.dataLabel.element.setAttribute('data-testid', `chart-node-label-${point.id}`);
                            }
                        });
                    }
                }
            },
        });
    }

    render(data: SankeyChartData): void {
        if (this.chart === null) { // nothing to render into before mount()
            return;
        }

        this.applyColors(data.colors);

        const series = this.chart.series[0] as Highcharts.Series;
        series.setData(data.links.map((link) => ({
            ...link,
            colorIndex: link.categoryId, // color follows the category in both link directions
        })) as Array<Highcharts.PointOptionsObject>);
    }

    private buildNodesOptions(nodes: Array<SankeyChartNode>): Array<SeriesSankeyNodesOptionsObject> {
        return nodes.map((node): SeriesSankeyNodesOptionsObject => ({
            id: node.id, // Highcharts needs the id to be string
            name: node.name,
            colorIndex: node.isMain ? MAIN_NODE_COLOR_INDEX : parseInt(node.id),
            ...(node.isMain ? {dataLabels: {className: "main-node-label"}} : {}),
        }));
    }

    // Highcharts copies all data item properties onto its points, so the link can be restored from one
    private static toChartLink(point: any): SankeyChartLink {
        return {
            from: point.from,
            to: point.to,
            weight: point.weight,
            categoryId: point.categoryId,
            outgoing: point.outgoing,
            custom: point.custom,
        };
    }

    private applyColors(colors: Map<string, string>): void {
        const style = document.getElementById('category-color-styles');
        if (style === null) {
            return;
        }

        style.innerHTML = '';
        colors.forEach((color, nodeId) =>
            style.innerHTML += `.highcharts-color-${nodeId} { fill: ${color}; }\n`
        );
    }
}
