export class TreeNode {
    key: number;
    value: any;
    parent: TreeNode;
    children: Array<TreeNode>;

    constructor(key: number, value = key, parent = null) {
        this.key = key;
        this.value = value;
        this.parent = parent;
        this.children = [];
    }

    get isLeaf(): boolean {
        return this.children.length === 0;
    }

    get hasChildren(): boolean {
        return !this.isLeaf;
    }
}

export default class Tree {
    root: TreeNode;

    constructor(rootNode: TreeNode) {
        this.root = rootNode;
    }

    * preOrderTraversal(node = this.root): Generator<TreeNode> {
        yield node;

        if (node.hasChildren) {
            for (let child of node.children) {
                yield* this.preOrderTraversal(child);
            }
        }
    }

    * postOrderTraversal(node = this.root): Generator<TreeNode> {
        if (node.hasChildren) {
            for (let child of node.children) {
                yield* this.postOrderTraversal(child);
            }
        }

        yield node;
    }

    insert(parentNodeKey: number, key: number, value = key): boolean {
        for (let node of this.preOrderTraversal()) {
            if (node.key === parentNodeKey) {
                node.children.push(new TreeNode(key, value, node));
                return true;
            }
        }

        return false;
    }

    remove(key: number): boolean {
        for (let node of this.preOrderTraversal()) {
            const filtered = node.children.filter(c => c.key !== key);
            if (filtered.length !== node.children.length) {
                node.children = filtered;

                return true;
            }
        }

        return false;
    }

    find(key: number): TreeNode|null {
        for (let node of this.preOrderTraversal()) {
            if (node.key === key) {
              return node;
            }
        }

        return null;
    }

    resetNodeValues(): void {
        // make sure that each parent node value is the sum of all childs
        [...this.postOrderTraversal()].filter(node => node.hasChildren)
            .map(node => node.value = node.children.reduce((sum, child) => sum + child.value, 0));
    }
}