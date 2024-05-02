'use client'

import { useState, useEffect } from "react";
import accountsData from "./data.json";

type AccountData = {
    id: number;
    name: string;
    price: number;
};

export default function Page () {
    // 読み込みデータを保持
    const [data, setData] = useState<Array<AccountData>>([]);
    const [sumPrice, setSumPrice] = useState<number>(0);

    useEffect(() => {
        let sum = 0;
        accountsData.map((data) => { sum += data.price; });
        setData(accountsData);
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
