import type { AppProps } from "next/app";

export default function KanzupApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
