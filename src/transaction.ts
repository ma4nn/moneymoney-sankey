import Tree, {TreeNode} from "./tree";

export type Category = {
    id: number;
    name: string;
    path: string;
    active: boolean;
    budget?: number;
}

export type Transaction = {
    id: number;
    date: number;
    amount: number;
    currency: string,
    category: string;
    account: string;
}

export class TransactionsManager {
    transactions: Array<Transaction>;
    startDate: Date;
    endDate: Date;

    constructor(transactions: Array<Transaction>) {
        this.transactions = transactions;
        this.startDate = this.transactions.map(obj => new Date(obj.date * 1000)).reduce((min, current) => (current < min ? current : min), new Date());
        this.endDate = this.transactions.map(obj => new Date(obj.date * 1000)).reduce((max, current) => (current > max ? current : max), new Date(0));
    }

    get accounts(): Array<string> {
        return [...new Set(this.transactions.map(obj => obj.account).filter(account => account))]
    }

    calculateNumberOfMonths(): number {
        const startYear = this.startDate.getFullYear();
        const startMonth = this.startDate.getMonth();
        const endYear = this.endDate.getFullYear();
        const endMonth = this.endDate.getMonth();

        return (endYear - startYear) * 12 + (endMonth - startMonth) + (this.endDate.getDate() - this.startDate.getDate()) / 30;
    }
}

export class CategoryTree {
    public list: Map<number,Category> = new Map();
    public tree: Tree;
    protected categoryPathSeparator: string;

    constructor(mainNodeId: number, categoryPathSeparator: string) {
        this.tree = new Tree(new TreeNode(mainNodeId, 0));
        this.list.set(mainNodeId, {id: mainNodeId, name: 'Saldo', path: '', active: true});
        this.categoryPathSeparator = categoryPathSeparator;
    }

    fromTransactions(transactions: Array<Transaction>): void {
        transactions.forEach(transaction => {
            let parentCategoryId = this.tree.root.key;
            const path = [];
            transaction.category.split(this.categoryPathSeparator).forEach(categoryName => {
                path.push(categoryName);
                let categorySubPath = path.join(this.categoryPathSeparator);

                let categoryId = generateCategoryIdFromPath(categorySubPath);
                let existingNode: TreeNode = this.tree.find(categoryId);
                if (existingNode === null) {
                    this.tree.insert(parentCategoryId, categoryId, transaction.amount);
                    this.list.set(categoryId, {id: categoryId, name: categoryName, path: path.join(' » '), active: true});
                } else if (categorySubPath === transaction.category) { // full category path already exists
                    existingNode.value += transaction.amount;
                }

                parentCategoryId = categoryId;
            });
        });

        console.debug('categories');
        console.debug(this.list);
    }
}

export class MoneyMoneyCategoryTree extends CategoryTree {
    constructor(mainNodeId: number) {
        super(mainNodeId, "\\\\");
    }
}

function generateCategoryIdFromPath(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i); // hash * 31 + charCodeAt
        hash |= 0;  // Convert to a 32-bit integer
    }

    return Math.abs(hash);
}