import {SeriesSankeyNodesOptionsObject} from "highcharts/highcharts.src";
import Highcharts from "highcharts/es-modules/masters/highcharts.src";
import 'highcharts/es-modules/masters/modules/sankey.src';
import 'highcharts/css/highcharts.css';
import './style.css';

import {SankeyChartData, SankeyChartHooks, SankeyChartLink, SankeyChartNode, SankeyChartRenderer} from "../types";

const MAIN_NODE_COLOR_INDEX = 1; // styled via .highcharts-color-1 in style.css

/** A node drag in progress, in the plot coordinates the nodes are laid out in. */
interface NodeDrag {
    pointerId: number;
    nodeId: string;
    startClientY: number;
    startY: number;
    startOffset: number;
    height: number;
    position: number;
    moved: boolean;
    captured: boolean;
}

// all Highcharts specifics live here, see https://www.highcharts.com/docs/chart-and-series-types/sankey-diagram
export default class HighchartsSankeyRenderer implements SankeyChartRenderer {
    private chart: Highcharts.Chart|null = null;
    private nodes: Array<SankeyChartNode> = [];
    private positions = new Map<string, number>(); // node id => wanted position, see SankeyChartNode.position
    private offsets = new Map<string, number>(); // node id => offsetVertical currently applied to reach it
    private links: Array<Highcharts.PointOptionsObject> = [];
    private drag: NodeDrag|null = null;
    private dragBound = new WeakSet<Element>(); // node elements survive redraws, so they must only be wired once

    mount(container: HTMLElement, data: SankeyChartData, hooks: SankeyChartHooks): void {
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- the callbacks below bind `this` to the chart
        const renderer = this;

        this.nodes = data.nodes; // must be set before the options below are built from it

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
                            if (point.graphic?.element) {
                                renderer.bindNodeDrag(point.graphic.element, String(point.id), hooks);
                                // a manually placed node stays on top, or one dragged onto it could not be grabbed again
                                if (renderer.isPositioned(String(point.id))) {
                                    point.graphic.toFront();
                                }
                            }
                        });
                    }
                }
            },
        });

        this.bindDragSurface(container, hooks);
    }

    render(data: SankeyChartData): void {
        if (this.chart === null) { // nothing to render into before mount()
            return;
        }

        this.applyColors(data.colors);

        this.nodes = data.nodes;
        this.positions = new Map(data.nodes.filter(node => node.position !== undefined)
            .map(node => [node.id, node.position as number]));

        const series = this.chart.series[0] as Highcharts.Series;
        this.applyNodeOptions();
        this.links = data.links.map((link) => ({
            ...link,
            colorIndex: link.categoryId, // color follows the category in both link directions
        })) as Array<Highcharts.PointOptionsObject>;
        series.setData(this.links);

        this.alignPositionedNodes();
    }

    private buildNodesOptions(nodes: Array<SankeyChartNode>): Array<SeriesSankeyNodesOptionsObject> {
        return nodes.map((node): SeriesSankeyNodesOptionsObject => ({
            id: node.id, // Highcharts needs the id to be string
            name: node.name,
            colorIndex: node.isMain ? MAIN_NODE_COLOR_INDEX : parseInt(node.id),
            // offsetVertical is relative to the layout, so it holds the pixel offset realizing the position
            offsetVertical: this.offsets.get(node.id) ?? 0,
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

    /** Node options are only read while a node is created (NodesComposition.createNode), so live nodes are changed in place. */
    private applyNodeOptions(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Highcharts internals
        const series = this.chart?.series[0] as any;
        if (! series) {
            return;
        }

        series.options.nodes = this.buildNodesOptions(this.nodes);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Highcharts internals
        (series.nodes ?? []).forEach((node: any) => {
            node.options.offsetVertical = this.offsets.get(String(node.id)) ?? 0;
        });
    }

    /** Repaints with the existing points, which is what an interaction like a drag can afford. */
    private refreshNodes(): void {
        this.applyNodeOptions();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Highcharts internals
        const series = this.chart?.series[0] as any;
        if (series) {
            series.isDirty = true; // the node positions are calculated in the series translation
            this.chart?.redraw(false);
        }
    }

    /**
     * Only re-issuing the data reattaches the links to their node; a plain redraw leaves it unable to
     * find them and stacks them all at its top edge. Too destructive for a running drag, though.
     */
    private reloadData(): void {
        this.applyNodeOptions();
        (this.chart?.series[0] as Highcharts.Series|undefined)?.setData(this.links, true);
    }

    /**
     * Re-derives the offsets from the wanted positions, needed whenever the layout changed. One pass
     * is enough: an offset shifts its own node 1:1 and leaves the rest of the column alone.
     */
    private alignPositionedNodes(): void {
        if (this.chart === null) {
            return;
        }

        const plotHeight = this.chart.plotHeight;
        let changed = false;

        this.offsets.forEach((_offset, nodeId) => {
            if (! this.positions.has(nodeId)) { // reset, or the node is gone
                this.offsets.delete(nodeId);
                changed = true;
            }
        });

        this.positions.forEach((position, nodeId) => {
            const node = this.findNode(nodeId);
            if (node === null) {
                return;
            }

            const applied = this.offsets.get(nodeId) ?? 0;
            const offset = this.clampToPlot(position * plotHeight, node.shapeArgs?.height ?? 0) - (node.nodeY - applied);
            if (Math.abs(offset - applied) > 0.5) { // sub pixel drift is not worth a redraw
                this.offsets.set(nodeId, offset);
                changed = true;
            }
        });

        if (changed) {
            this.reloadData();
        }
    }

    /** Nodes are dragged along the y axis only: the x position encodes the category level. */
    private bindNodeDrag(element: Element, nodeId: string, hooks: SankeyChartHooks): void {
        if (this.dragBound.has(element)) {
            return;
        }

        this.dragBound.add(element);

        element.addEventListener('pointerdown', (event: Event) => {
            const pointer = event as PointerEvent;
            const node = this.findNode(nodeId);
            // a second pointer must not take over a running drag, its node would silently stay behind
            if (pointer.button !== 0 || node === null || this.chart === null || this.drag !== null) {
                return;
            }

            // captured on the first move only: an active capture would swallow the double click reset below
            this.drag = {
                pointerId: pointer.pointerId,
                nodeId: nodeId,
                startClientY: pointer.clientY,
                startY: node.nodeY,
                startOffset: this.offsets.get(nodeId) ?? 0,
                height: node.shapeArgs?.height ?? 0,
                position: node.nodeY / this.chart.plotHeight,
                moved: false,
                captured: false,
            };
        });

        // otherwise only a full configuration reset gets a node back to the automatic layout
        element.addEventListener('dblclick', () => {
            if (! this.isPositioned(nodeId)) {
                return;
            }

            this.positions.delete(nodeId);
            this.offsets.delete(nodeId);
            hooks.onNodeDrag(nodeId, null);
            this.refreshNodes();
        });
    }

    private bindDragSurface(container: HTMLElement, hooks: SankeyChartHooks): void {
        container.addEventListener('pointermove', (event: PointerEvent) => {
            const drag = this.drag;
            if (drag === null || drag.pointerId !== event.pointerId || this.chart === null) {
                return;
            }

            if (event.buttons === 0) { // released outside of the chart, where the pointerup is not seen
                this.endDrag(event, hooks);
                return;
            }

            if (! drag.captured) {
                // on the container, not the node element: a redraw during the drag replaces the latter
                this.chart.container.setPointerCapture(event.pointerId);
                drag.captured = true;
            }

            const y = this.clampToPlot(drag.startY + event.clientY - drag.startClientY, drag.height);

            drag.position = y / this.chart.plotHeight;
            drag.moved = true;
            this.positions.set(drag.nodeId, drag.position);
            // the node sits at startY with startOffset applied, so its unshifted base is the difference
            this.offsets.set(drag.nodeId, drag.startOffset + y - drag.startY);

            this.refreshNodes();
        });

        const end = (event: PointerEvent): void => this.endDrag(event, hooks);
        container.addEventListener('pointerup', end);
        container.addEventListener('pointercancel', end);
    }

    private endDrag(event: PointerEvent, hooks: SankeyChartHooks): void {
        const drag = this.drag;
        if (drag === null || drag.pointerId !== event.pointerId) {
            return;
        }

        this.drag = null;
        if (drag.captured) {
            this.chart?.container.releasePointerCapture(event.pointerId);
        }

        if (drag.moved) {
            hooks.onNodeDrag(drag.nodeId, drag.position);
        }
    }

    private isPositioned(nodeId: string): boolean {
        return this.positions.has(nodeId);
    }

    private clampToPlot(y: number, nodeHeight: number): number {
        return Math.min(Math.max(y, 0), Math.max(0, (this.chart?.plotHeight ?? 0) - nodeHeight));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Highcharts internals
    private findNode(nodeId: string): any {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Highcharts internals
        const series = this.chart?.series[0] as any;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Highcharts internals
        return series?.nodes?.find((node: any) => String(node.id) === nodeId) ?? null;
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
