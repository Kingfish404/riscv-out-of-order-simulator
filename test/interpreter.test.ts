import { describe, expect, test } from '@jest/globals';
import { Interpreter } from '../src/utils/rsic-v';

describe('interpreter', () => {
    test('tomasulo', () => {
        const interpreter = new Interpreter(
            `
            ld f8, 21(x3)
            ld f4, 16(x4)
            fmul f2, f4, f6
            fsub f10, f8, f4
            fdiv f12, f2, f8
            fadd f8, f10, f4
            `);
        try {
            while (interpreter.step() == 0) { }
        } catch (error) {
            console.error(error);
            console.log({ interpreter })
        }
    }, 10);
    test('interget', () => {
        const interpreter = new Interpreter(
            `
            add x1, x0, x2
            addi x1, x0, 10
            sub x2, x0, x1
            `);
        try {
            while (interpreter.step() == 0) { }
        } catch (error) {
            console.error(error);
            console.log({ interpreter })
        }
    }, 10);
    test('interget', () => {
        const interpreter = new Interpreter(
            `
            add x1, x0, x2
            addi x1, x0, 10
            sub x2, x0, x1
            ld f8, 21(x3)
            ld f4, 16(x4)
            fmul f2, f4, f6
            fsub f10, f8, f4
            fdiv f12, f2, f8
            fadd f8, f10, f4
            `);
        try {
            while (interpreter.step() == 0) { }
        } catch (error) {
            console.error(error);
            console.log({ interpreter })
        }
    }, 10);
})
