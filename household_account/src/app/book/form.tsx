import {useState, useEffect } from 'react';
import { useForm,Controller } from 'react-hook-form';
import Select from 'react-select';
import {GroupBase} from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { CategoryData } from '../../../types/accountData';

export default function From ({ incomeData, expenditureData }: { incomeData: CategoryData[], expenditureData: CategoryData[]; }) {
    

    interface SelectOption {
        value: string;
        label: string;
    };

    interface IFormInputs {
        category: SelectOption;
        balanceOfPayment: SelectOption;
        name: string;
        price: number;
    }

    const { register, handleSubmit, formState: { errors },control,watch } = useForm<IFormInputs>({
        defaultValues: {
            category: {value:"",label:""},
            balanceOfPayment: {value:"",label:""},
            name: "",
            price:0
        }
    });

    const IncomeOrExpenditure = [
        { value: 'INCOME', label: '収入' },
        { value: 'EXPENDITURE', label: '支出' },
    ];

    const [options, setOptions] = useState<SelectOption[]>([]);
    useEffect(() => { 
        const makeOptions: { value: string; label:string}[] = [];
        incomeData.map((data) => { makeOptions.push({ value: data.category, label: data.category }); });
        expenditureData.map((data) => { makeOptions.push({ value: data.category, label: data.category }); });

        setOptions(makeOptions);
    },[incomeData,expenditureData]);

    return (
        <>
            <h2>入力フォーム</h2>
            <form onSubmit={ handleSubmit((data) => {
                console.log(data);
            })}>
                <label htmlFor="category">Category : </label>

                <Controller 
                    name='category'
                    control={ control }
                    render={ ({field}) => (
                        <CreatableSelect { ...register('category', { required: "カテゴリを選択してください" }) }
                            options={ options }
                            value={ options.find((x:SelectOption) => x.value === field.value.value) }
                            onChange={ (newValue) => {
                                field.onChange(newValue?.value);
                            } }
                            onCreateOption={ (inputValue) => {
                                const newOption: SelectOption = { value: inputValue, label: inputValue };
                                setOptions((prevOption) => [...prevOption, newOption]);
                            }}
                        />
                    ) }
                />
                <p>{ errors.category?.message }</p>
                <label htmlFor="balanceOfPayment">収支 : </label>
                <Controller 
                    name='balanceOfPayment'
                    control={ control }
                    render={ ({field}) => (
                        <Select { ...register('balanceOfPayment', { required: "収入か支出を選択してください" }) }
                            options={ IncomeOrExpenditure }
                            value={ options.find((x:SelectOption) => x.value == field.value.value) }
                            onChange={ (newValue) => {
                                field.onChange(newValue?.value);
                        }}/>
                    )}/>
                <p>{ errors.balanceOfPayment?.message }</p>
                <label htmlFor="name">Name : </label>
                <input { ...register('name') } placeholder='name' />
                <p>{ errors.name?.message }</p>
                <label htmlFor="price">Price : </label>
                <input { ...register('price',{required:true,min:{value:0,message:"0円以上を設定してください"}}) } placeholder='price' />
                <p>{ errors.price?.message }</p>
                
                <input type='submit' value='登録'  />
            </form>
        </>
    )
    
}