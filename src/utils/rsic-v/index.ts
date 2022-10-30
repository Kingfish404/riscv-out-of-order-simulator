import { IntegerRegister, FloatingPointRegister } from "./hardware";


export enum InstructionStage {
  IF = 'IF',
  ID = 'ID',
  EX = 'EX',
  MEM = 'MEM',
  WB = 'WB',
}

type Station = {
  busy: boolean, name: string, op: string, v?: number, a?: string,
  qi?: string, qj?: string, qk?: string, vi?: number, vj?: number, vk?: number,
};

export class Interpreter {
  // world state
  cycle: number = 0;
  // cpu isa state
  x_register: IntegerRegister;
  pc: number = 0;
  f_register: FloatingPointRegister;
  fcsr: number = 0;

  // tomasulo algorithm station
  reservation_station: {
    name: string, busy: boolean, op: string,
    vj: number, vk: number, qj: string, qk: string, a: string, v: number,
  }[] = [
      { name: 'load1', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '', a: '', v: 0 },
      { name: 'load2', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '', a: '', v: 0 },
      { name: 'fadd1', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '', a: '', v: 0 },
      { name: 'fadd2', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '', a: '', v: 0 },
      { name: 'fadd3', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '', a: '', v: 0 },
      { name: 'fmul1', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '', a: '', v: 0 },
      { name: 'fmul2', busy: false, op: '', vj: 0, vk: 0, qj: '', qk: '', a: '', v: 0 },
    ];
  floating_point_station: {
    name: string, busy: boolean, op: string, qi: string, vi: any,
  }[] = [];

  // cpu pipeline state
  pipeline: {
    instruction: string, op: string, tokens: any, pc: number,
    stage: InstructionStage, C_need: number, station: Station,
    IF: number, EX_S: number, EX_E: number, WB: number,
  }[] = [];

  // memory
  mem: number[] = Array(1024).fill(0);
  instructions: string[];

  // instructions and log
  log: string[] = [];
  warning: string[] = [];
  pipeline_history: any[] = [];

  constructor(instruction: string) {
    this.x_register = new IntegerRegister();
    this.f_register = new FloatingPointRegister();
    this.instructions = instruction.split('\n').map((line) => {
      return line.trim();
    }).filter((line) => line.length > 0 && !line.startsWith("#"));
    for (let i = 0; i < 32; i++) {
      this.floating_point_station
        .push({ name: `f${i}`, busy: false, op: '', qi: '', vi: 0 });
    }
  }

  normalizeImm(imm: number) {
    if (imm > 0xffff) {
      this.warning.push("WARN: Immediate more than 16 bits [line " + this.pc / 4 + "]: " + imm);
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

  fld(rd: keyof FloatingPointRegister, imm: number, rs1: keyof IntegerRegister) {
    imm = this.normalizeImm(imm);
    imm = this.immPad(imm);
    let address = this.x_register[rs1] + imm;
    let value = this.mem[address];
    if (value == undefined) {
      this.f_register[rd] = 10;
      return;
    }
    this.f_register[rd] = value;
  }

  fsd(rs2: keyof FloatingPointRegister, imm: number, rs1: keyof IntegerRegister) {
    imm = this.normalizeImm(imm);
    imm = this.immPad(imm);
    let address = this.x_register[rs1] + imm;
    this.mem[address] = this.f_register[rs2];
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
    for (let unit of this.pipeline.filter((unit) => unit.stage == InstructionStage.IF)) {
      unit.C_need--;
      if (unit.C_need == 0) {
        unit.stage = InstructionStage.EX;
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
        if (trimmed.match(/^-?\d+$/)) {
          return parseInt(trimmed);
        }
        return trimmed;
      });
      let can_fetch = false;
      let station: Station = { name: '', busy: false, op: '', v: 0, qi: '', qj: '', qk: '' }
      switch (op) {
        case 'fsd':
        case 'fld':
          for (let cur_station of this.reservation_station
            .filter((station) => station.busy == false && station.name.startsWith('load'))) {
            cur_station.a = tokens[1] as string;
            can_fetch = true;
            station = cur_station;
            break
          }
          break
        case 'fmul':
        case 'fdiv':
          for (let cur_station of this.reservation_station
            .filter((station) => station.busy == false && station.name.startsWith('fmul'))) {
            can_fetch = true;
            station = cur_station;
            break;
          }
          break
        case 'fsub':
        case 'fadd':
          for (let cur_station of this.reservation_station
            .filter((station) => station.busy == false && station.name.startsWith('fadd'))) {
            can_fetch = true;
            station = cur_station;
            break;
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
                station.vj = this.floating_point_station[fid].vi;
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
                station.vk = this.floating_point_station[fid].vi;
                station.qk = '';
              }
            }
          }
        }
        station.busy = true;
        station.op = op;

        const unit = {
          op: op, tokens: tokens, pc: this.pc,
          stage: InstructionStage.IF, C_need: 1,
          IF: this.cycle, EX_S: -1, EX_E: -1, WB: -1,
          station: station, instruction: instruction,
        }
        this.pipeline.push(unit);
        this.pipeline_history.push(unit);
        this.pc += 4;
      }
    }

    // execute
    for (let unit of this.pipeline.filter((unit) => unit.stage == InstructionStage.EX)) {
      const { op } = unit;
      if (unit.EX_S == -1) {
        if ((unit.station.qj == unit.station.name || unit.station.qj === '')
          && (unit.station.qk == unit.station.name || unit.station.qk === '')) {
          unit.EX_S = this.cycle;
          switch (op) {
            case 'fld':
            case 'fsd':
              unit.C_need = 2;
              break
            case 'fadd':
            case 'fsub':
              unit.C_need = 2;
              break
            case 'fmul':
              unit.C_need = 10;
              break
            case 'fdiv':
              unit.C_need = 40;
              break
            default:
              unit.C_need = 1;
              break
          }
        } else {
          continue;
        }
      }
      unit.C_need--;
      if (unit.C_need == -1) {
        unit.stage = InstructionStage.WB;
        unit.EX_E = this.cycle;
      }
    }

    // Writeback
    for (let unit of this.pipeline.filter(value => value.stage == InstructionStage.WB)) {
      if (unit.WB == -1 && unit.C_need == -1) {
        unit.C_need = 1;
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
        case 'fld':
          const address = tokens[1] as string;
          const imm = parseInt(address.split('(')[0]);
          const rs1 = address.split('(')[1].split(')')[0];
          this.fld(tokens[0] as keyof FloatingPointRegister,
            imm,
            rs1 as keyof IntegerRegister);
          unit.station.v = this.f_register[tokens[0] as keyof FloatingPointRegister];
          unit.station.a = ''
          break;
        case 'fsd':
          const address2 = tokens[1] as string;
          const imm2 = parseInt(address2.split('(')[0]);
          const rs12 = address2.split('(')[1].split(')')[0];
          this.fsd(tokens[0] as keyof FloatingPointRegister,
            imm2,
            rs12 as keyof IntegerRegister);
          break;
        case 'fmul':
          this.fmul(tokens[0] as keyof FloatingPointRegister,
            tokens[1] as keyof FloatingPointRegister,
            tokens[2] as keyof FloatingPointRegister);
          unit.station.v = this.f_register[tokens[0] as keyof FloatingPointRegister];
          break;
        case 'fdiv':
          this.fdiv(tokens[0] as keyof FloatingPointRegister,
            tokens[1] as keyof FloatingPointRegister,
            tokens[2] as keyof FloatingPointRegister);
          unit.station.v = this.f_register[tokens[0] as keyof FloatingPointRegister];
          break;
        case 'fsub':
          this.fsub(tokens[0] as keyof FloatingPointRegister,
            tokens[1] as keyof FloatingPointRegister,
            tokens[2] as keyof FloatingPointRegister);
          unit.station.v = this.f_register[tokens[0] as keyof FloatingPointRegister];
          break;
        case 'fadd':
          this.fadd(tokens[0] as keyof FloatingPointRegister,
            tokens[1] as keyof FloatingPointRegister,
            tokens[2] as keyof FloatingPointRegister);
          unit.station.v = this.f_register[tokens[0] as keyof FloatingPointRegister];
          break;
        default:
          this.warning.push("WARN: Unknown instruction [line " + unit.pc / 4 + "]: " + unit.instruction);
          break;
      }

      unit.C_need--;
      unit.WB = this.cycle;
      for (let cur_station of this.floating_point_station) {
        if (cur_station.qi == unit.station.name) {
          cur_station.qi = '';
          cur_station.vi = unit.station.v;
        }
      }
      for (let cur_station of this.reservation_station) {
        if (cur_station.qj == unit.station.name) {
          cur_station.qj = '';
          cur_station.vj = unit.station.v != undefined && !isNaN(unit.station.v) ? unit.station.v : 0;
        }
        if (cur_station.qk == unit.station.name) {
          cur_station.qk = '';
          cur_station.vk = unit.station.v != undefined && !isNaN(unit.station.v) ? unit.station.v : 0;
        }
      }
      unit.station.busy = false;
    }
    this.pipeline = this.pipeline.filter(
      (unit) => {
        return !(unit.stage == InstructionStage.WB && unit.C_need == 0);
      });
    return 0;
  }
}

export default Interpreter;