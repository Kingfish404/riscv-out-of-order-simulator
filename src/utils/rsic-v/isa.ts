
export enum RV64I {
    // Base Integer Instruction Set
    ADD = 'add',
    ADDI = 'addi',
    SUB = 'sub',

    JAL = 'jal',
}

export enum RV64D {
    // Standard Extension for Floating-Point
    FLD = 'fld',
    FSD = 'fsd',

    FADD = 'fadd',
    FSUB = 'fsub',
    FMUL = 'fmul',
    FDIV = 'fdiv',
}
