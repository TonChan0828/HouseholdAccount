'use client'

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import accountsData from "../data.json";

type IncomeOrExpenditure = "INCOME" | "EXPENDITURE";

type AccountData = {
    id: number;
    name: string;
    category: string;
    price: number;
    balanceOfPayment: IncomeOrExpenditure;
};


export default function Detail () {
    const [detailData, setDetailData] = useState<Array<AccountData>>([]);
    const searchParams = useSearchParams();
    
    useEffect(() => { 
        const displayData: AccountData[] = [];
        console.log(searchParams.get('category'));
        accountsData.map((data) => { 
            if (data.category === searchParams.get('category')) {
                const tmpData: AccountData = {
                    id: data.id,
                    name: data.name,
                    category:data.category,
                    price: data.price,
                    balanceOfPayment: (data.balanceOfPayment === "INCOME" ? "INCOME" : "EXPENDITURE"),
                };
            displayData.push(tmpData);
            }            
        });

        setDetailData(displayData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            <div>
                <h2>詳細表示</h2>
                <div>
                    <table>
                        <thead>
                            <tr>
                                <th>項目</th><th>金額</th>
                            </tr>
                        </thead>
                        <tbody>
                            { detailData.map((data: any) => (
                                <tr key={ data.name }>
                                    <td>{ data.name } : </td>
                                    <td>{ data.price }円</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )
}