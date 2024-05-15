import React from 'react';

type Props = {
    
}

export default function Detail ({detailWord}:{detailWord:string}) {
    
    return (
        <>
            <div>
                <h2>{detailWord}</h2>
            </div>
        </>
    )
}