import { describe, expect, test } from '@jest/globals';
import { Interpreter } from '../src/utils/rsic-v';

function run_code(code: string) {
    const interpreter = new Interpreter(code);
    try {
        while (interpreter.step() == 0) { }
    } catch (error) {
        console.error(error);
        console.log({ interpreter })
    }
    if (interpreter.warning.length > 0) {
        console.warn(interpreter.warning);
    }
}

describe('interpreter', () => {
    test('tomasulo', () => {
        const code = `
        fld f8, 21(x3)
        fld f4, 16(x4)
        fmul f2, f4, f6
        fsub f10, f8, f4
        fdiv f12, f2, f8
        fadd f8, f10, f4
        `
        run_code(code);
    }, 10);
    test('interget', () => {
        const code = `
        add x1, x0, x2
        addi x1, x0, 10
        sub x2, x0, x1
        add x1, x0, x2
        addi x1, x0, 10
        sub x2, x0, x1
        `
        run_code(code);
    }, 10);
    test('interget', () => {
        const code = `
        # comment
        add x1, x0, x2
        addi x1, x0, 10 # comment
        sub x2, x0, x1
        fld f8, 21(x3)
        fld f4, 16(x4)
        fmul f2, f4, f6
        fsub f10, f8, f4
        fdiv f12, f2, f8
        fadd f8, f10, f4
        # comment
        `
        run_code(code);
    }, 10);
})
