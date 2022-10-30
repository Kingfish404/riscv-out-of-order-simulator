import type { NextPage } from 'next'
import Head from 'next/head'
import { SetStateAction, useState } from 'react'
import { Input, Button, Space } from 'antd';
import 'core-js/actual/structured-clone';
import { EditableTable } from '../components';
import {
  RiscvInstruction as Interpreter,
  RiscvInstructionStage as InstructionStage
} from '../utils';
import 'antd/dist/antd.css';
import styles from '../styles/Home.module.scss'
import Link from 'next/link';

const { TextArea } = Input;
export const title = "RISC-V (Sub-Set) Out-of-Order Interpreter"

const Home: NextPage = () => {
  const [code, setCode] = useState(
    `fadd f2,f2,f2\nadd x1, x0, x2\naddi x1, x0, 10\nsub x2, x0, x1\n` +
    `fld f8, 21(x3)\nfld f4, 16(x4)\nfsd f4, 0(x0)\n` +
    `fmul f2, f4, f6\nfsub f10, f8, f4\nfdiv f12, f2, f8\nfadd f8, f10, f4\n`)
  const [interpreter, setInterpreter] = useState<Interpreter>(new Interpreter(code));
  const [reload, setReload] = useState<boolean>(false)
  const [history, setHistory] = useState<Interpreter[]>([]);
  const [contenteditable, setContenteditable] = useState(true);
  const reflash = () => {
    setReload(!reload);
  }
  return (
    <div className={styles.container}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={title} />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <header>
        <Space>
          <Link href="/"><a className={styles.title}>{title}</a></Link>
          <Link href="/docs"><Button type='link' >Docs</Button></Link>
        </Space>
      </header>
      <main className={styles.main}>
        <div className={styles.grid}>
          <div className={styles.grid_item}>
            <h2>Code place</h2>
            <TextArea
              style={{ width: '100%', height: '100%', fontFamily: 'monospace' }}
              value={code}
              onChange={(e: { target: { value: string; }; }) => {
                const value = e.target.value;
                setCode(value);
                setInterpreter(new Interpreter(value));
                while (history.length > 0) {
                  history.pop();
                };
              }}
              placeholder="ASM code"
              autoSize={{ minRows: 10, maxRows: 10 }}
            />
            <hr />
            <Space >
              <Button onClick={
                () => {
                  const last_state = structuredClone(interpreter);
                  while (interpreter.step() == 0) {
                    if (interpreter.cycle === last_state.cycle + 1) {
                      history.push(last_state);
                    }
                  }
                  setReload(!reload);
                }
              } >Run</Button>
              <Button onClick={
                () => {
                  const last_state = structuredClone(interpreter);
                  interpreter.step();
                  if (interpreter.cycle === last_state.cycle + 1) {
                    history.push(structuredClone(last_state))
                    setReload(!reload);
                  }
                }
              } >Step</Button>
              <Button onClick={
                () => {
                  if (history.length > 0) {
                    const last_state = history[history.length - 1];
                    Object.assign(interpreter, last_state);
                    history.pop();
                    setReload(!reload);
                  }
                }
              } >Back</Button>
              <Button onClick={
                () => {
                  while (history.length > 0) {
                    history.pop();
                  }
                  setInterpreter(new Interpreter(code));
                  setReload(!reload);
                }
              } >Reset</Button>
            </Space>
          </div>
          <div className={styles.grid_item}>
            <h2>Registers and MEM</h2>
            <div>
              <h3>Integer Register</h3>
              <EditableTable data={interpreter.x_register} refresh={setReload} contenteditable={contenteditable} />
            </div>
            <div>
              <h3 style={{ display: 'inline-block' }}>PC: {interpreter.pc}</h3>
            </div>
            <div>
              <h3>Floating Point Register (Extension)</h3>
              <EditableTable data={interpreter.f_register} refresh={setReload} contenteditable={contenteditable} />
            </div>
            <div>
              <h3 style={{ display: 'inline-block' }}>FCSR: {interpreter.fcsr}</h3>
            </div>
            <div>
              <h3>MEM</h3>
              <EditableTable data={interpreter.mem} refresh={reflash} contenteditable={contenteditable} />
            </div>
          </div>
          <div className={styles.grid_item}>
            <h2>Pipline History</h2>
            <div>
              <EditableTable data={interpreter.pipeline_history} refresh={reflash} />
            </div>
          </div>
          <div className={styles.grid_item}>
            <h2>CPU Tomasulo Station</h2>
            <div style={
              { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', }
            }>
              <div style={{ margin: '0 1rem 1rem 0' }}>
                <p>Reservation Station</p>
                <EditableTable data={interpreter.reservation_station} refresh={reflash} />
              </div>
              <div style={{ margin: '0 1rem 1rem 0' }}>
                <p>Floating Point Station</p>
                <EditableTable data={interpreter.floating_point_station} refresh={reflash} />
              </div>
            </div>
          </div>
          <div className={styles.grid_item}>
            <h2>Runtime Info</h2>
            {interpreter.warning.length > 0 &&
              (<>
                <h3>Warning</h3>
                {interpreter.warning.map(
                  (value, index, log) => (<div key={index}>{JSON.stringify(value)}</div>)
                )}
              </>)}
            <h3>Log</h3>
            {interpreter.log.map(
              (value, index, log) => (<div key={index}>{JSON.stringify(value)}</div>))}
          </div>
          <div className={styles.grid_item}>
            <h2>Debug Info</h2>
            <div>
              {Object.keys(interpreter).map((value, index) => {
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
        </div>
      </main >

      <footer className={styles.footer}>@{new Date().getFullYear()} Jin Yu, BUPT</footer>
    </div >
  )
}

export default Home
