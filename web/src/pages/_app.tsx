import type { AppProps } from "next/app";
import Head from "next/head";

export default function KanzupApp({ Component, pageProps }: AppProps) {
  return (
    <>
      {/* Declared here so Next uses it instead of adding its own default viewport tag. */}
      <Head><meta name="viewport" content="width=device-width, initial-scale=1" key="viewport" /></Head>
      <Component {...pageProps} />
    </>
  );
}
