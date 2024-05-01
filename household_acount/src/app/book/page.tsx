'use client'

import { useState, useEffect } from "react";
import acountsData from "./data.json";

type AcountData = {
    id: number;
    name: string;
    price: number;
};

export default function Page () {
    // 読み込みデータを保持
    const [data, setData] = useState<Array<AcountData>>([]);

    useEffect(() => {
        setData(acountsData);
    }, []);

    return (
      <>
        <div>
            <h2>家計簿画面</h2>
                <table>
                    <tr>
                        <th>項目</th><th>金額</th><th>編集</th>
                    </tr>
                    { data.map((data: any) => (
                        <tr key={ data.id }>
                            <td>{ data.name }</td>
                            <td>{ data.price }</td>
                            <td><button>更新</button></td>
                        </tr>
                    ))}
                </table>
                <p>合計</p><p>999999</p>
        </div>
      </>
  );
}
