'use client'

import { useState, useEffect } from "react";
import Link from "next/link";
import accountsDataSample from "./data.json";
import ReactModal from "react-modal";
import Detail from './detail';
import Form from'./form';

type IncomeOrExpenditure = "INCOME" | "EXPENDITURE";

type AccountData = {
    id: number;
    name: string;
    category:string;
    price: number;
    balanceOfPayment: string;
};

type CategoryData = {
    category: string;
    categoryId: number;
    price: number;
};

export default function Page () {
    // 読み込みデータを型に適用
    const accountsData: AccountData[] = accountsDataSample;

    // モーダル表示用
    const [modalIsOpen, setIsOpen] = useState(false);
    const [detailArray, setDetailArray] = useState<Array<AccountData>>([]);

    // モーダル表示用カテゴリID取得用
    const [categoryId, setCategoryId] = useState<number>(0);
    
    // カテゴリ用    
    const [CategorizedAccountDataArray, setCategorizedAccountDataArray]=useState<Array<Array<AccountData>>>([]);
    // カテゴリ集計用
    const [incomeData, setIncomeData] = useState<Array<CategoryData>>([]);
    const [expenditureData, setExpenditureData] = useState<Array<CategoryData>>([]);
    // 合計集計用
    const [incomeSumPrice, setIncomeSumPrice] = useState<number>(0);
    const [expenditureSumPrice, setExpenditureSumPrice] = useState<number>(0);


    useEffect(() => { 
        // accountsDataをカテゴリで分類する
        let categoryToNum = 0;
        const categoryMap = new Map<string, number>();
        const categorizedData:AccountData[][] = [];
        accountsData.map((data: AccountData): void => {
            if (!categoryMap.has(data.category)) {
                categoryMap.set(data.category, categoryToNum);
                categoryToNum++;
                categorizedData.push([]);
            }
            const num: number = categoryMap.get(data.category) ?? -1;
            if (num !== -1) {
                categorizedData[num].push(data);
            }
        });
        setCategorizedAccountDataArray(categorizedData);

        // カテゴリごとの合計を求める
        // 収支ごとの合計を求める
        const incomeCategoryData: CategoryData[] = [];
        const expenditureCategoryData: CategoryData[] = [];
        let incomeSum: number = 0;
        let expenditureSum: number = 0;

        for (let num :number= 0; num < categoryToNum; num++){
            const balanceOfPayment: string = categorizedData[num][0].balanceOfPayment;
            const category: string = categorizedData[num][0].category;
            const categoryId: number = num;
            let price: number = 0;
            categorizedData[num].map((data:AccountData):void => { price +=data.price});
            if (balanceOfPayment === "INCOME") {
                incomeSum += price;
                incomeCategoryData.push({ "category": category, "categoryId": categoryId, "price": price });
            }
            if (balanceOfPayment === "EXPENDITURE") {
                expenditureSum += price;
                expenditureCategoryData.push({ "category": category, "categoryId": categoryId, "price": price });
            }
        }

        setIncomeData(incomeCategoryData);
        setExpenditureData(expenditureCategoryData);
        setIncomeSumPrice(incomeSum);
        setExpenditureSumPrice(expenditureSum);
    },[accountsData]);
    
const modalStyle = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.85)"
  },
  content: {
    position: "absolute",
    top: "5rem",
    left: "5rem",
    right: "5rem",
    bottom: "5rem",
    backgroundColor: "black",
    borderRadius: "1rem",
    padding: "1.5rem"
  }
};
    return (
      <>
        <div>
                <h2>家計簿画面</h2>
                <div>
                    <table>
                        <thead>
                            <tr>
                                <th>収入項目</th><th>金額</th><th>内訳</th>
                            </tr>
                        </thead>
                        <tbody>
                            { incomeData.map((data: any) => (
                                <tr key={ data.category }>
                                    <td>{ data.category } : </td>
                                    <td>{ data.price }円</td>
                                    <td><button onClick={ () => { setIsOpen(true); setCategoryId(data.categoryId) } }>詳細</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p>合計</p><p>{ incomeSumPrice }円</p>
                </div>

                <div>
                    <table>
                        <thead>
                            <tr>
                                <th>収入項目</th><th>金額</th><th>内訳</th>
                            </tr>
                        </thead>
                        <tbody>
                            { expenditureData.map((data: any) => (
                                <tr key={ data.category }>
                                    <td>{ data.category } : </td>
                                    <td>{ data.price }円</td>
                                    <td><button onClick={ () => { setIsOpen(true); setCategoryId(data.categoryId) ;} }>詳細</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p>合計</p><p>{ expenditureSumPrice }円</p>
                </div>

                <Form />

                 <ReactModal isOpen={ modalIsOpen } /*style={modalStyle}*/ onRequestClose={()=>setIsOpen(false)}>
                    <Detail detailArray={CategorizedAccountDataArray[categoryId]}/>
                </ReactModal>
        </div>
      </>
  );
}
