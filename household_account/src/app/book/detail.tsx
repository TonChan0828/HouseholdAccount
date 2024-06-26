import React from 'react';
import { IncomeOrExpenditure,AccountData } from '../../../types/accountData';

export default function Detail ({detailArray}:{detailArray:AccountData[]}) {
    
    return (
        <>
            <div>
                <h2>カテゴリ詳細画面</h2>
                <div>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th><th>項目名</th><th>金額</th><th>編集</th>
                            </tr>
                        </thead>
                        <tbody>
                            { detailArray.map((data: any) => (
                                <tr key={ data.category }>
                                    <td>{ data.id } : </td>
                                    <td>{ data.name } : </td>
                                    <td>{ data.price }円</td>
                                    <td><button>編集</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}