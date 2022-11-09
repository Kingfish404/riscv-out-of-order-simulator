## Docs

### CPU and Pipeline

[risc-v core-code](/src/utils/rsic-v/index.ts)

Pipline:  
- IF: Instruction Fetch
- EX: Execution
- WB: Write Back

### Supported Instructions

`ADD` rd, rs1, rs2  
`ADDI` rd, rs1, imm  
`SUB` rd, rs1, rs2  

`JAL` rd, imm

`FLD` rd, imm(rs1) : rd <- MEM[rs1+imm]  
`FSD` rs2, imm(rs1) : MEM[rs1+imm] <- rs2  

`FADD` rd, rs1, rs2  
`FSUB` rd, rs1, rs2  
`FMUL` rd, rs1, rs2  
`FDIV` rd, rs1, rs2  

#### Reference

- [https://github.com/riscv-non-isa/riscv-asm-manual](https://github.com/riscv-non-isa/riscv-asm-manual/blob/master/riscv-asm.md)
- [https://www.cs.cornell.edu/courses/cs3410/2019sp/riscv/interpreter/](https://www.cs.cornell.edu/courses/cs3410/2019sp/riscv/interpreter/)
- [https://github.com/dannyqiu/mips-interpreter](https://github.com/dannyqiu/mips-interpreter)
