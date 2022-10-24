import type { NextPage } from 'next'
import Head from 'next/head'
import { SetStateAction, useState } from 'react'
import { Input, Button, Space } from 'antd';
import { Docs } from './../components'
import {
  RiscvInstruction as Interpreter,
  RiscvInstructionStage as InstructionStage
} from '../utils';
import 'antd/dist/antd.css';
import styles from '../styles/Home.module.scss'

const { TextArea } = Input;

const Home: NextPage = () => {
  const [interpreter, setInterpreter] = useState<Interpreter>(new Interpreter(''));
  const [history, setHistory] = useState<Interpreter[]>([]);
  const [code, setCode] = useState(
    `add x1, x0, x2\naddi x1, x0, 10\nsub x2, x0, x1\n` +
    `ld f8, 21(x3)\nld f4, 16(x4)\n` +
    `fmul f2, f4, f6\nfsub f10, f8, f4\nfdiv f12, f2, f8\nfadd f8, f10, f4\n`)
  const [reload, setReload] = useState<SetStateAction<boolean>>(false)
  const title = "RISC-V (Sub-Set) Out-of-Order Interpreter"
  return (
    <div className={styles.container}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={title} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div className={styles.title}>{title}</div>
        <div className={styles.grid}>
          <div className={styles.grid_item}>
            <h2>Code place</h2>
            <TextArea
              style={{ width: '100%', height: '100%' }}
              value={code}
              onChange={(e: { target: { value: string; }; }) => {
                setCode(e.target.value);
                setInterpreter(new Interpreter(e.target.value));
                setHistory([]);
              }}
              placeholder="ASM code"
              autoSize={{ minRows: 10, maxRows: 10 }}
            />
            <hr />
            <Space >
              <Button onClick={
                () => {
                  if (interpreter.cycle === 0) {
                    const new_interpreter = new Interpreter(code);
                    const new_history: SetStateAction<Interpreter[]> = [];
                    do {
                      if (new_history.length == 0 ||
                        new_interpreter.cycle === new_history[new_history.length - 1].cycle + 1) {
                        new_history.push(structuredClone(new_interpreter));
                      }
                    } while (new_interpreter.step() == 0);
                    setHistory(new_history);
                    setInterpreter(new_interpreter);
                  } else {
                    const new_history: SetStateAction<Interpreter[]> = [...history];
                    const last_state = structuredClone(interpreter);
                    while (interpreter.step() == 0) {
                      if (interpreter.cycle === last_state.cycle + 1) {
                        new_history.push(last_state);
                      }
                    }
                    setHistory(new_history);
                    setReload(!reload);
                  }
                }
              } >Run</Button>
              <Button onClick={
                () => {
                  if (interpreter.cycle === 0) {
                    const new_interpreter = new Interpreter(code);
                    setHistory([structuredClone(new_interpreter)]);
                    new_interpreter.step();
                    setInterpreter(new_interpreter);
                  } else {
                    const last_state = structuredClone(interpreter);
                    interpreter.step();
                    if (interpreter.cycle === last_state.cycle + 1) {
                      setHistory([...history, structuredClone(last_state)]);
                      setReload(!reload);
                    }
                  }
                }
              } >Step</Button>
              <Button onClick={
                () => {
                  if (history.length > 0) {
                    const last_state = history[history.length - 1];
                    Object.assign(interpreter, last_state);
                    setHistory(history.slice(0, history.length - 1));
                    setReload(!reload);
                  }
                }
              } >Back</Button>
              <Button onClick={
                () => {
                  setInterpreter(new Interpreter(''));
                  setHistory([]);
                }
              } >Reset</Button>
            </Space>
          </div>
          <div className={styles.grid_item}>
            <h2>Registers</h2>
            <div>
              <h3>PC</h3>
              <p>{interpreter.pc}</p>
            </div>
            <div>
              <h3>Integer Register</h3>
              {JSON.stringify(Object.keys(interpreter.x_register))}
              {JSON.stringify(Object.values(interpreter.x_register))}
            </div>
            <br />
            <div>
              <h3>Floating Point Register (Extension)</h3>
              {JSON.stringify(Object.keys(interpreter.f_register))}
              {JSON.stringify(Object.values(interpreter.f_register))}
            </div>
          </div>
          <div className={styles.grid_item}>
            <h2>Pipline</h2>
            <code>{JSON.stringify(Object.values(InstructionStage))}</code>
            <div>
              {interpreter.pipeline_log.map((value, key) => {
                return <p key={key}>{JSON.stringify(value)}</p>
              })}
            </div>
          </div>
          <div className={styles.grid_item}>
            <h2>CPU (Registers, Station, etc) and Interpreter</h2>
            <div>{Object.keys(interpreter).map((value, index) => {
              const content = JSON.stringify(interpreter[value as keyof Interpreter]);
              if (content.length < 64) {
                return <p key={index}>{value}:{content}</p>
              }
              return (
                <div key={index}>
                  <span>{value}:</span>
                  <p>{content}</p>
                </div>)
            })}</div>
          </div>
          <div className={styles.grid_item}>
            <h2>Log</h2>
            <div>{interpreter.log.map(
              (value, index, log) => (<div key={index}>{JSON.stringify(value)}</div>))}</div>
          </div>
          <div className={styles.grid_item}><Docs /></div>
        </div>
      </main >

      <footer className={styles.footer}>Author: Jin Yu; BUPT</footer>
    </div >
  )
}

export default Home
