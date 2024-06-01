export type IncomeOrExpenditure = "INCOME" | "EXPENDITURE";

export interface AccountData  {
    id: number;
    name: string;
    category:string;
    price: number;
    balanceOfPayment: string;
};

export interface CategoryData  {
    category: string;
    categoryId: number;
    price: number;
};
