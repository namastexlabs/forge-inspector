import { ForgeInspector } from 'forge-inspector'
import type { AppProps } from 'next/app'

import '../styles/globals.css'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <ForgeInspector />
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
