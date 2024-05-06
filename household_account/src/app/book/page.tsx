'use client'

import { useState, useEffect } from "react";
import accountsData from "./data.json";

type AccountData = {
    id: number;
    name: string;
    price: number;
};

type CategoryData = {
    name: string;
    price: number;
};

export default function Page () {
    // 読み込みデータを保持
    const [data, setData] = useState<Array<CategoryData>>([]);
    const [sumPrice, setSumPrice] = useState<number>(0);

    useEffect(() => {
        let sum = 0;
        const mp = new Map<string, number>();
        accountsData.map((data) => {
            if (typeof mp.get(data.name) !== "undefined") {
                mp.set(data.name, mp.get(data.name) + data.price);
            } else {
                mp.set(data.name, data.price);
            }
            sum += data.price;
        });

        const categoryData: CategoryData[] = [];
        for (const [key, val] of mp) {
            categoryData.push({ name:key, price:val });
        }

        setData(categoryData);
        setSumPrice(sum);
    }, []);

    return (
      <>
        <div>
            <h2>家計簿画面</h2>
                <table>
                    <thead>
                        <tr>
                            <th>項目</th><th>金額</th><th>編集</th>
                        </tr>
                    </thead>
                    <tbody>
                        { data.map((data: any) => (
                            <tr key={ data.name }>
                                <td>{ data.name } : </td>
                                <td>{ data.price }円</td>
                                <td><button>更新</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p>合計</p><p>{sumPrice}円</p>
        </div>
      </>
  );
}
