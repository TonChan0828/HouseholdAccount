'use client'

import { useState, useEffect } from "react";
import Link from "next/link";
import accountsData from "./data.json";
import ReactModal from "react-modal";
import Detail from './detail';

type IncomeOrExpenditure = "INCOME" | "EXPENDITURE";

type AccountData = {
    id: number;
    name: string;
    category:string;
    price: number;
    balanceOfPayment: IncomeOrExpenditure;
};

type CategoryData = {
    category: string;
    price: number;
};

export default function Page () {
    // 読み込みデータを保持
    const [incomeData, setIncomeData] = useState<Array<CategoryData>>([]);
    const [expenditureData, setExpenditureData] = useState<Array<CategoryData>>([]);
    const [incomeSumPrice, setIncomeSumPrice] = useState<number>(0);
    const [expenditureSumPrice, setExpenditureSumPrice] = useState<number>(0);
    const [modalIsOpen, setIsOpen] = useState(false);
    const [detailWord, setDetailWord] = useState<string>("");

    useEffect(() => {
        let incomeSum = 0;
        let expenditureSum = 0;
        const incomeMap = new Map<string, number>();
        const expenditureMap = new Map<string, number>();
        accountsData.map((data) => {
            if (data.balanceOfPayment === "INCOME") {
                if (typeof incomeMap.get(data.category) !== "undefined") {
                    incomeMap.set(data.category, incomeMap.get(data.category) + data.price);
                } else {
                    incomeMap.set(data.category, data.price);
                }
                incomeSum += data.price;
            }else if (data.balanceOfPayment === "EXPENDITURE") {
                if (typeof expenditureMap.get(data.category) !== "undefined") {
                    expenditureMap.set(data.category, expenditureMap.get(data.category) + data.price);
                } else {
                    expenditureMap.set(data.category, data.price);
                }
                expenditureSum += data.price;
            }
        });

        const incomeCategoryData: CategoryData[] = [];
        for (const [key, val] of incomeMap) {
            incomeCategoryData.push({ category:key, price:val });
        }

        const expenditureCategoryData: CategoryData[] = [];
        for (const [key, val] of expenditureMap) {
            expenditureCategoryData.push({ category:key, price:val });
        }

        setIncomeData(incomeCategoryData);
        setExpenditureData(expenditureCategoryData);
        setIncomeSumPrice(incomeSum);
        setExpenditureSumPrice(expenditureSum);
    }, []);
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
                                <th>収入項目</th><th>金額</th><th>内訳</th><th>編集</th>
                            </tr>
                        </thead>
                        <tbody>
                            { incomeData.map((data: any) => (
                                <tr key={ data.category }>
                                    <td>{ data.category } : </td>
                                    <td>{ data.price }円</td>
                                    <td><button onClick={ () => { setIsOpen(true); setDetailWord(data.category); } }>詳細</button></td>
                                    <td><button>更新</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <ReactModal isOpen={ modalIsOpen } style={modalStyle} onRequestClose={()=>setIsOpen(false)}>
                        <Detail detailWord={(detailWord)}/>
                    </ReactModal>
                    <p>合計</p><p>{ incomeSumPrice }円</p>
                </div>

                <div>
                    <table>
                        <thead>
                            <tr>
                                <th>収入項目</th><th>金額</th><th>内訳</th><th>編集</th>
                            </tr>
                        </thead>
                        <tbody>
                            { expenditureData.map((data: any) => (
                                <tr key={ data.category }>
                                    <td>{ data.category } : </td>
                                    <td>{ data.price }円</td>
                                    <td><button onClick={ () => setIsOpen(true) }>詳細</button></td>
                                    <td><button>更新</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p>合計</p><p>{ expenditureSumPrice }円</p>
                </div>

                <div>
                    <button>新規登録</button>
                </div>
        </div>
      </>
  );
}
