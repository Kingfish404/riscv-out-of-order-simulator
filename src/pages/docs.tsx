import { Button, Space } from 'antd'
import Head from 'next/head'
import Link from 'next/link'
import { title } from '.'
import { Docs } from '../components'
import styles from '../styles/Home.module.scss'

export default function Page() {

  return (
    <div className={styles.container}>
      <Head>
        <title>{`Docs | ${title}`}</title>
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
        <Docs />
      </main>
    </div>
  )
}