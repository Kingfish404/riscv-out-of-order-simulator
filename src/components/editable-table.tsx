export function EditableTable(props: {
    data: any | Array<any>, contenteditable?: boolean
} = { data: {}, contenteditable: false }) {
    const { data, contenteditable } = props;
    // if data is array
    const head_data: string[] = [];
    const body_data: any[][] = [];
    let dir = 'auto'
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        head_data.push(...Object.keys(data[0]));
        body_data.push(...data.map((item) => Object.values(item)));
    } else {
        head_data.push(...Object.keys(data));
        body_data.push([...Object.values(data)]);
    }
    return (
        <table >
            <thead>
                <tr >
                    {head_data.map((key, index) => (
                        <th style={{
                            minWidth: '1.5rem',
                            borderTop: '2px solid #333',
                            borderBottom: '1px solid #333',
                        }}
                            key={index}>{key}</th>
                    ))}
                </tr>
            </thead>
            <tbody style={{
                borderBottom: '1px solid #333'
            }}>
                {body_data.map((row, i) => {
                    return (<tr key={i}>
                        {row.map((value, j) => (
                            <td
                                contentEditable={contenteditable}
                                suppressContentEditableWarning={true}
                                onInput={(e) => {
                                    const target = e.target as HTMLTableCellElement;
                                    const value = parseInt(target.innerText);
                                    if (Array.isArray(data)) {
                                        data[j] = isNaN(value) ? 0 : value;
                                    } else {
                                        data[head_data[j]] = isNaN(value) ? 0 : value;
                                    }
                                }}
                                style={{
                                    textAlign: 'center', padding: 0,
                                    wordBreak: 'keep-all', whiteSpace: 'nowrap',
                                }}
                                key={j}>
                                {typeof value !== 'object' ?
                                    <p>{String(value)}</p> :
                                    (<EditableTable data={value} />)}
                            </td>
                        ))}
                    </tr>)
                })}
            </tbody>
        </table >

    )
}