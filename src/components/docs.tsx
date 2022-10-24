
export function Docs() {
    const docs = [
        {
            name: "https://github.com/riscv-non-isa/riscv-asm-manual",
            href: "https://github.com/riscv-non-isa/riscv-asm-manual/blob/master/riscv-asm.md"
        },
        {
            name: "https://www.cs.cornell.edu/courses/cs3410/2019sp/riscv/interpreter/",
            href: "https://www.cs.cornell.edu/courses/cs3410/2019sp/riscv/interpreter/",
        },
        {
            name: "https://github.com/dannyqiu/mips-interpreter",
            href: "https://github.com/dannyqiu/mips-interpreter",
        },
    ]
    return (<div>
        <h2>Docs</h2>
        <h3>Supported Instructions</h3>
        <div>
            <p><code>ADD</code> rd, rs1, rs2</p>
            <p><code>ADDI</code> rd, rs1, imm</p>
            <p><code>SUB</code> rd, rs1, rs2</p>
            <p><code>LD</code> rd, imm(rs1)</p>
            <p><code>FADD</code> rd, rs1, rs2</p>
            <p><code>FSUB</code> rd, rs1, rs2</p>
            <p><code>FMUL</code> rd, rs1, rs2</p>
            <p><code>FDIV</code> rd, rs1, rs2</p>
        </div>
        <h3>Reference</h3>
        {docs.map((value, key) => {
            return (
                <p key={key}>
                    <a target={"_blank"} href={value.href} rel="noreferrer" >
                        {value.name}
                    </a>
                </p>)
        })}</div>)
}
