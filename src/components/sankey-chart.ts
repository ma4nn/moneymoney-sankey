import Alpine from '@alpinejs/csp';

import Tree, { TreeNode, TreeNodeWithParent } from "../tree";
import { Config } from "../config";
import { NodeValidator } from "../validators";
import {getValueByPath, numberFormat, percentageFormat} from "../helper";
import {Category} from "../transaction";
import component from "./component";
import {SankeyChartData, SankeyChartLink, SankeyChartNode, SankeyChartRenderer} from "../chart/types";
import {NodeModelContext, SankeyNodeModel} from "../chart/node-model";
import {getDefaultColorValue} from "../chart/colors";
import {createSankeyRenderer} from "../chart";

export default (data: Tree) => component({
    categoryTree: data,
    renderer: null as SankeyChartRenderer|null,
    currentLinks: [] as Array<SankeyChartLink>,
    mainNodeId: data.root.key,

    get scaling(): number {
        return this.config.scalingFactor;
    },

    get threshold(): number {
        return this.config.threshold;
    },

    get sorting(): string {
        return this.config.sortKey;
    },

    get categories(): Map<number,Category> {
        return this.config.categories;
    },

    get childCategories(): Map<number,Category> {
        return new Map([...this.categories].filter(([categoryId, _category]) => categoryId !== this.mainNodeId));
    },

    get nodePositions(): Record<string,number> {
        const positions = this.config.nodePositions;

        // local storage is user editable, and an array would pass the typeof check as category ids
        return positions !== null && typeof positions === 'object' && ! Array.isArray(positions) ? positions : {};
    },

    get config(): Config {
        return Alpine.store('config');
    },

    get nodes(): Array<TreeNode> {
        // restore the full parent sums first: the recalculation below overwrites them,
        // so filtering on the previous update's values would drop nodes permanently
        this.categoryTree.resetNodeValues();

        const treeNodes: Array<TreeNode> = [...this.categoryTree.postOrderTraversal()]
            .filter(x => Math.abs(x.value) >= this.threshold && this.categories.get(x.key)?.active);

        // recalculate weight values for each parent node
        treeNodes.filter(x => x.hasChildren).map(x => x.value = x.children.reduce((a, b): number => {
            const category = this.categories.get(b.key);
            return Math.abs(b.value) >= this.threshold && category?.active ? a + b.value : a;
        }, 0));

        this.config.chartData = treeNodes;

        return treeNodes;
    },

    update(): void {
        this.renderer?.render(this.buildChartData());
    },

    buildChartData(): SankeyChartData {
        return {
            nodes: this.buildNodesConfig(),
            links: this.buildLinksConfig(),
            colors: this.buildColorsConfig(),
        };
    },

    sortLinks(links: Array<SankeyChartLink>): any {
      return links.sort((a, b) => {
          const valueA = getValueByPath(a, this.sorting);
          const valueB = getValueByPath(b, this.sorting);

          const isNumA = !isNaN(valueA);
          const isNumB = !isNaN(valueB);

          if (isNumA && isNumB) {
              return Number(valueA) - Number(valueB);
          }

          if (!isNumA && !isNumB) {
              return valueA.localeCompare(valueB);
          }

          return isNumA ? -1 : 1;
      });
    },

    buildNodesConfig(): Array<SankeyChartNode> {
        const nodes: Array<SankeyChartNode> = [];
        nodes.push({
            id: String(this.mainNodeId),
            name: this.categories.get(this.mainNodeId)?.name ?? '',
            isMain: true,
            position: this.nodePosition(this.mainNodeId),
        });

        this.childCategories.forEach((category: Category) => {
            nodes.push({
                id: String(category.id),
                name: category.name,
                isMain: false,
                position: this.nodePosition(category.id),
            });
        });

        console.debug('chart nodes:');
        console.debug(nodes);

        return nodes;
    },

    buildLinksConfig(): Array<SankeyChartLink> {
        const treeNodes = this.nodes;

        // node ids must be strings; weight must be positive (signed value kept in custom.real);
        // category ids instead of names because income and expense names may collide
        const links: Array<SankeyChartLink> = treeNodes.filter((x: TreeNode): x is TreeNodeWithParent => x.value >= 0 && x.parent !== null).map((x: TreeNodeWithParent): SankeyChartLink => {
            return {
                from: String(x.key),
                to: String(x.parent.key),
                weight: x.value,
                categoryId: x.key,
                custom: {real: x.value, category: this.categories.get(x.key)},
            }
        }).concat(treeNodes.filter((x: TreeNode): x is TreeNodeWithParent => x.value < 0 && x.parent !== null).map((x: TreeNodeWithParent): SankeyChartLink => {
            return {
                from: String(x.parent.key),
                to: String(x.key),
                weight: (-1) * x.value,
                outgoing: !x.hasChildren,
                categoryId: x.key,
                custom: {real: x.value, category: this.categories.get(x.key)},
            }
        }));

        console.debug('chart links:');
        console.debug(links);

        this.currentLinks = this.sortLinks(links);

        return this.currentLinks;
    },

    buildColorsConfig(): Map<string, string> {
        const colors = new Map<string, string>();
        this.childCategories.forEach((category: Category) =>
            colors.set(String(category.id), category.color ?? getDefaultColorValue(category.id))
        );

        return colors;
    },

    nodePosition(categoryId: number): number|undefined {
        const position = this.nodePositions[String(categoryId)];

        // an out of range value would push the node off the chart, and local storage is user editable
        return typeof position === 'number' && position >= 0 && position <= 1 ? position : undefined;
    },

    storeNodePosition(nodeId: string, position: number|null): void {
        // replaced instead of mutated so that the persisting store notices the change
        const positions = {...this.nodePositions};
        if (position === null) {
            delete positions[nodeId];
        } else {
            positions[nodeId] = position;
        }

        this.config.nodePositions = positions;
    },

    nodeModel(nodeId: string): SankeyNodeModel {
        const context: NodeModelContext = {
            links: this.currentLinks,
            mainNodeId: this.mainNodeId,
            scaling: this.scaling,
            nameOf: (id: string): string => this.categories.get(parseInt(id))?.name ?? id,
        };

        return new SankeyNodeModel(nodeId, context);
    },

    init(): void {
        console.debug('tree data:');
        console.debug(this.categories);

        const renderer = createSankeyRenderer();
        this.renderer = renderer;

        const chartData = this.buildChartData();
        renderer.mount(this.$el, chartData, {
            onLinkClick: (link: SankeyChartLink): void => {
                let categoryId: number;
                if (link.to !== String(this.mainNodeId) && link.custom.real < 0) {
                    categoryId = parseInt(link.to);
                } else if (link.from !== String(this.mainNodeId) && link.custom.real >= 0) {
                    categoryId = parseInt(link.from);
                } else {
                    return;
                }

                this.removeCategory(categoryId);
            },

            onNodeDrag: (nodeId: string, position: number|null): void => this.storeNodePosition(nodeId, position),

            nodeLabel: (nodeId: string): string => {
                const node = this.nodeModel(nodeId);
                if (node.isMain) {
                    return node.toString();
                }

                return '<small>' + node.name + '</small><br>' + (new NodeValidator(node, this.config).validate() ? '' : NodeValidator.warningSign)
                    + numberFormat(node.getValue());
            },

            nodeTooltip: (nodeId: string): string => {
                const node = this.nodeModel(nodeId);

                let weightsDetailTooltip = '';
                node.getLinksTo().filter(link => link.from !== String(this.mainNodeId) && link.weight > 0)
                    .sort((a, b) => b.weight - a.weight)
                    .forEach((link: SankeyChartLink) => {
                        const weight = link.weight / this.scaling;
                        weightsDetailTooltip += '+ ' + this.nodeModel(link.from).name + ': ' + numberFormat(weight) + ' ' + percentageFormat(weight/node.getTotalIncomingWeight()) + '<br>';
                    });
                if (node.isMain) {
                    weightsDetailTooltip += '= ' + numberFormat(node.getTotalIncomingWeight()) + '<br><br>';
                }

                node.getLinksFrom().filter(link => link.to !== String(this.mainNodeId) && link.weight > 0)
                    .sort((a, b) => b.weight - a.weight)
                    .forEach((link: SankeyChartLink) => {
                        const weight = link.weight / this.scaling;
                        weightsDetailTooltip += '- ' + this.nodeModel(link.to).name + ': ' + numberFormat(weight) + ' ' + percentageFormat(weight/node.getTotalOutgoingWeight()) + '<br>';
                    });
                if (node.isMain) {
                    weightsDetailTooltip += '= ' + numberFormat(node.getTotalOutgoingWeight()) + '<br>';
                }

                const validator = new NodeValidator(node, this.config);
                validator.validate();

                return node.toString() + '<br>'
                    + weightsDetailTooltip + '<br>'
                    + validator.messages;
            },

            linkTooltip: (link: SankeyChartLink): string => {
                const toNode = this.nodeModel(link.to);

                return this.nodeModel(link.from).name + " → " + toNode.name + ": "
                    + numberFormat(link.weight / this.scaling)
                    + ' ' + percentageFormat(toNode.getPercentage())
                    + "<br><br><span class='small'>(Klick entfernt die Kategorie aus dem Chart.)</span>";
            },

            nodeValue: (nodeId: string): number => this.nodeModel(nodeId).getValue(),

            formatValue: (value: number): string => numberFormat(value / this.scaling),
        });

        this.renderer.render(chartData);
        document.addEventListener('ChartInvalidated', () => this.update());

        document.getElementById('header-configuration')?.removeAttribute('disabled');
    },

    removeCategory(categoryId: number): void {
        const node = this.categoryTree.find(categoryId);
        if (node === null) {
            return;
        }

        [...this.categoryTree.postOrderTraversal(node)].forEach((child: TreeNode) => {
            const category = this.categories.get(child.key);
            if (category) {
                category.active = false;
            }
        });

        this.update();
    }
});

