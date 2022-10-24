import { IntegerRegister, FloatingPointRegister } from "./hardware";


export enum InstructionStage {
    FETCH = 0,
    EXECUTE = 2,
    WRITEBACK = 4,
}

type Station = {
    busy: boolean, name: string, value?: number, address?: string,
    qi?: string, qj?: string, qk?: string, vi?: number, vj?: number, vk?: number,
};

export class Interpreter {
    // world state
    cycle: number = 0;
    // cpu isa state
    x_register: IntegerRegister;
    f_register: FloatingPointRegister;
    fcsr: number = 0;
    pc: number = 0;

    // tomasulo algorithm station
    reservation_station: {
        name: string, busy: boolean, op: string,
        vj: number, vk: number, qj: string, qk: string
    }[] = [
            { name: 'fadd1', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '' },
            { name: 'fadd2', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '' },
            { name: 'fadd3', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '' },
            { name: 'fmul1', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '' },
            { name: 'fmul2', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '' },
        ];
    load_station: { name: string, busy: boolean, address: string, value: number }[] = [];
    floating_point_station: {
        value: any; busy: boolean, qi: string,
    }[] = [];

    // cpu pipeline state
    pipeline: {
        instruction: string, op: string, tokens: any, pc: number,
        stage: InstructionStage, cycle_need: number,
        fetch: number, execute_start: number, execute_end: number, writeback: number,
        station: Station,
    }[] = [];

    // memory
    mem = [];

    // instructions and log
    instructions: string[];
    log: string[] = [];
    pipeline_log: any[] = [];

    constructor(instruction: string) {
        this.x_register = new IntegerRegister();
        this.f_register = new FloatingPointRegister();
        this.instructions = instruction.split('\n').map((line) => {
            return line.trim();
        }).filter((line) => line.length > 0);
        for (let i = 0; i < 3; i++) {
            this.load_station.push({ name: `load${i}`, busy: false, address: '', value: 0 });
        }
        for (let i = 0; i < 32; i++) {
            this.floating_point_station.push({ busy: false, qi: '', value: 0 });
        }
    }

    normalizeImm(imm: number) {
        if (imm > 0xffff) {
            this.log.push("WARN: Immediate more than 16 bits [line " + this.pc / 4 + "]: " + imm);
        }
        return imm & 0xffff;
    }

    immPad(imm: number) {
        return (imm & 0x8000) == 0x8000 ? imm | 0xffff0000 : imm;
    }

    add(rd: keyof IntegerRegister,
        rs1: keyof IntegerRegister,
        rs2: keyof IntegerRegister) {
        if (rd == 'x0') {
            return;
        }
        this.x_register[rd] = this.x_register[rs1] + this.x_register[rs2];
    }

    addi(rd: keyof IntegerRegister,
        rs1: keyof IntegerRegister,
        imm: number) {
        if (rd == 'x0') {
            return;
        }
        imm = this.normalizeImm(imm);
        imm = this.immPad(imm);
        this.x_register[rd] = this.x_register[rs1] + imm;
    }

    sub(rd: keyof IntegerRegister,
        rs1: keyof IntegerRegister,
        rs2: keyof IntegerRegister) {
        if (rd == 'x0') {
            return;
        }
        this.x_register[rd] = this.x_register[rs1] - this.x_register[rs2];
    }

    subi(rd: keyof IntegerRegister,
        rs1: keyof IntegerRegister,
        imm: number) {
        if (rd == 'x0') {
            return;
        }
        imm = this.normalizeImm(imm);
        imm = this.immPad(imm);
        this.x_register[rd] = this.x_register[rs1] - imm;
    }

    ld(rd: keyof FloatingPointRegister,
        imm: number,
        rs1: keyof IntegerRegister) {
        imm = this.normalizeImm(imm);
        imm = this.immPad(imm);
        let address = this.x_register[rs1] + imm;
        let value = this.mem[address];
        if (value == undefined) {
            this.f_register[rd] = 0;
            return;
        }
        this.f_register[rd] = value;
    }

    fmul(rd: keyof FloatingPointRegister,
        rs1: keyof FloatingPointRegister,
        rs2: keyof FloatingPointRegister) {
        this.f_register[rd] = this.f_register[rs1] * this.f_register[rs2];
    }

    fsub(rd: keyof FloatingPointRegister,
        rs1: keyof FloatingPointRegister,
        rs2: keyof FloatingPointRegister) {
        this.f_register[rd] = this.f_register[rs1] - this.f_register[rs2];
    }

    fdiv(rd: keyof FloatingPointRegister,
        rs1: keyof FloatingPointRegister,
        rs2: keyof FloatingPointRegister) {
        this.f_register[rd] = this.f_register[rs1] / this.f_register[rs2];
    }

    fadd(rd: keyof FloatingPointRegister,
        rs1: keyof FloatingPointRegister,
        rs2: keyof FloatingPointRegister) {
        this.f_register[rd] = this.f_register[rs1] + this.f_register[rs2];
    }

    step() {
        if ((this.pc / 4) >= this.instructions.length && this.pipeline.length == 0) {
            return -1;
        }
        // fetch
        this.cycle++;
        for (let unit of this.pipeline.filter((unit) => unit.stage == InstructionStage.FETCH)) {
            unit.cycle_need--;
            if (unit.cycle_need == 0) {
                unit.stage = InstructionStage.EXECUTE;
            }
        }
        if ((this.pc / 4) < this.instructions.length) {
            let instruction = this.instructions[this.pc / 4];
            let op = instruction.substring(0, instruction.indexOf(' ')).toLowerCase();
            let string_tokens = instruction.substring(instruction.indexOf(' ') + 1).split(',');
            let tokens = string_tokens.map((token) => {
                let trimmed = token.trim();
                if (trimmed.indexOf('#') != -1) {
                    trimmed = trimmed.substring(0, trimmed.indexOf('#')).trim();
                }
                let val = parseInt(trimmed);
                if (isNaN(val) || op == 'ld') {
                    return trimmed;
                }
                return val;
            });
            let can_fetch = false;
            let station: Station = { name: '', busy: false, value: 0, qi: '', qj: '', qk: '' }
            switch (op) {
                case 'ld':
                    for (let cur_station of this.load_station) {
                        if (!cur_station.busy) {
                            cur_station.address = tokens[1] as string;
                            can_fetch = true;
                            station = cur_station;
                            break
                        }
                    }
                    break
                case 'fmul':
                case 'fdiv':
                    for (let cur_station of this.reservation_station) {
                        if (cur_station.name.startsWith('fmul') && !cur_station.busy) {
                            can_fetch = true;
                            station = cur_station;
                            break;
                        }
                    }
                    break
                case 'fsub':
                case 'fadd':
                    for (let cur_station of this.reservation_station) {
                        if (cur_station.name.startsWith('fadd') && !cur_station.busy) {
                            can_fetch = true;
                            station = cur_station;
                            break;
                        }
                    }
                    break
                default:
                    can_fetch = true;
                    break
            }
            if (can_fetch) {
                this.log.push('Fetch: ' + instruction + ', PC: ' + this.pc);
                for (let i = 0; i < tokens.length; i++) {
                    if (typeof tokens[i] != 'string') {
                        continue;
                    }
                    const token = tokens[i] as string;
                    if (token.charAt(0) == 'f') {
                        const fid = parseInt(token.substring(1))
                        if (i == 0) {
                            // Register['D'].Qi = r
                            this.floating_point_station[fid].qi = station.name;
                        } else if (i == 1) {
                            // if (Register['S1'].Qi != '')
                            if (this.floating_point_station[fid].qi != '') {
                                // Register['D'].Qj = Register['S1'].Qi
                                station.qj = this.floating_point_station[fid].qi;
                            } else {
                                // Register['D'].Vj = S1
                                // Register['D'].Qj = ''
                                station.vj = this.floating_point_station[fid].value;
                                station.qj = '';
                            }
                        } else if (i == 2) {
                            // if (Register['S2'].Qi != '')
                            if (this.floating_point_station[fid].qi != '') {
                                // Register['D'].Qk = Register['S1'].Qi
                                station.qk = this.floating_point_station[fid].qi;
                            } else {
                                // Register['D'].Vk = S1
                                // Register['D'].Qk = ''
                                station.vk = this.floating_point_station[fid].value;
                                station.qk = '';
                            }
                        }
                    }
                }
                station.busy = true;

                const unit = {
                    instruction: instruction,
                    op: op,
                    tokens: tokens,
                    pc: this.pc,
                    stage: InstructionStage.FETCH,
                    cycle_need: 1,
                    fetch: this.cycle,
                    execute_start: -1,
                    execute_end: -1,
                    writeback: -1,
                    station: station,
                }
                this.pipeline.push(unit);
                this.pipeline_log.push(unit);
                this.pc += 4;
            }
        }

        // execute
        for (let unit of this.pipeline.filter((unit) => unit.stage == InstructionStage.EXECUTE)) {
            const { op, tokens } = unit;
            let can_execute = true;
            if (unit.execute_start == -1) {
                can_execute = false;
                switch (op) {
                    case 'ld':
                        can_execute = true;
                        unit.cycle_need = 2;
                        break
                    case 'fadd':
                    case 'fsub':
                        unit.cycle_need = 2;
                        if (unit.station.qj === '' && unit.station.qk === '') {
                            can_execute = true;
                        }
                        break
                    case 'fmul':
                        unit.cycle_need = 10;
                        if (unit.station.qj === '' && unit.station.qk === '') {
                            can_execute = true;
                        }
                        break
                    case 'fdiv':
                        unit.cycle_need = 40;
                        if (unit.station.qj === '' && unit.station.qk === '') {
                            can_execute = true;
                        }
                        break
                    default:
                        can_execute = true;
                        unit.cycle_need = 1;
                        break
                }
                if (can_execute) {
                    unit.execute_start = this.cycle;
                }
            }
            if (can_execute) {
                unit.cycle_need--;
                if (unit.cycle_need == 0) {
                    unit.stage = InstructionStage.WRITEBACK;
                    unit.execute_end = this.cycle;
                }
            }
        }

        // writeback
        for (let unit of this.pipeline.filter(value => value.stage == InstructionStage.WRITEBACK)) {
            if (unit.writeback == -1 && unit.cycle_need == 0) {
                unit.cycle_need = 1;
                continue;
            }
            const { op, tokens } = unit;
            switch (op) {
                case 'add':
                    this.add(tokens[0] as keyof IntegerRegister,
                        tokens[1] as keyof IntegerRegister,
                        tokens[2] as keyof IntegerRegister);
                    break;
                case 'addi':
                    if (typeof tokens[2] != 'number') {
                        throw new Error("ADDI: Immediate is not a number");
                    }
                    this.addi(tokens[0] as keyof IntegerRegister,
                        tokens[1] as keyof IntegerRegister,
                        tokens[2]);
                    break;
                case 'sub':
                    this.sub(tokens[0] as keyof IntegerRegister,
                        tokens[1] as keyof IntegerRegister,
                        tokens[2] as keyof IntegerRegister);
                    break;
                case 'subi':
                    if (typeof tokens[2] != 'number') {
                        throw new Error("SUBI: Immediate is not a number");
                    }
                    this.subi(tokens[0] as keyof IntegerRegister,
                        tokens[1] as keyof IntegerRegister,
                        tokens[2]);
                    break;
                case 'ld':
                    const address = tokens[1] as string;
                    const imm = parseInt(address.split('(')[0]);
                    const rs1 = address.split('(')[1].split(')')[0];
                    this.ld(tokens[0] as keyof FloatingPointRegister,
                        imm,
                        rs1 as keyof IntegerRegister);
                    unit.station.value = this.f_register[tokens[0] as keyof FloatingPointRegister];
                    unit.station.address = ''
                    break;
                case 'fmul':
                    this.fmul(tokens[0] as keyof FloatingPointRegister,
                        tokens[1] as keyof FloatingPointRegister,
                        tokens[2] as keyof FloatingPointRegister);
                    unit.station.value = this.f_register[tokens[0] as keyof FloatingPointRegister];
                    break;
                case 'fdiv':
                    this.fdiv(tokens[0] as keyof FloatingPointRegister,
                        tokens[1] as keyof FloatingPointRegister,
                        tokens[2] as keyof FloatingPointRegister);
                    unit.station.value = this.f_register[tokens[0] as keyof FloatingPointRegister];
                    break;
                case 'fsub':
                    this.fsub(tokens[0] as keyof FloatingPointRegister,
                        tokens[1] as keyof FloatingPointRegister,
                        tokens[2] as keyof FloatingPointRegister);
                    unit.station.value = this.f_register[tokens[0] as keyof FloatingPointRegister];
                    break;
                case 'fadd':
                    this.fadd(tokens[0] as keyof FloatingPointRegister,
                        tokens[1] as keyof FloatingPointRegister,
                        tokens[2] as keyof FloatingPointRegister);
                    unit.station.value = this.f_register[tokens[0] as keyof FloatingPointRegister];
                    break;
                default:
                    this.log.push("WARN: Unknown instruction [line " + unit.pc / 4 + "]: " + unit.instruction);
                    break;
            }

            unit.cycle_need--;
            unit.writeback = this.cycle;
            for (let cur_station of this.floating_point_station) {
                if (cur_station.qi == unit.station.name) {
                    cur_station.qi = '';
                    cur_station.value = unit.station.value;
                }
            }
            for (let cur_station of this.reservation_station) {
                if (cur_station.qj == unit.station.name) {
                    cur_station.qj = '';
                    cur_station.vj = unit.station.value != undefined ? unit.station.value : 0;
                }
                if (cur_station.qk == unit.station.name) {
                    cur_station.qk = '';
                    cur_station.vk = unit.station.value != undefined ? unit.station.value : 0;
                }
            }
            unit.station.busy = false;
        }
        this.pipeline = this.pipeline.filter(
            (unit) => {
                return !(unit.stage == InstructionStage.WRITEBACK && unit.cycle_need == 0);
            });
        return 0;
    }
}

export default Interpreter;