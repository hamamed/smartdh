// The <html>/<head>/<body> shell. Head tags come from the page's layout props, so
// every page gets exactly the head views/layout.ejs produced. Runtime JS is off on
// every page (see [[...path]].tsx), so Next adds no scripts and no page data.
import Document, { Head, Html, Main, NextScript } from "next/document";
import type { PageProps } from "@/server/page-props";
import { DefaultHead } from "@/views/Layout";
import { BARE_HEADS } from "@/views/bare";

export default class KanzupDocument extends Document {
  render() {
    const props = (this.props.__NEXT_DATA__.props as { pageProps?: PageProps }).pageProps;
    const L = props?.L;
    const BareHead = props?.bare ? BARE_HEADS[props.view] : undefined;
    return (
      <Html lang={L?.lang || "ar"} dir={L?.dir || "rtl"}>
        <Head>
          {/* Next wraps pages in <div id="__next">; keep it out of the body's flex layout. */}
          <style dangerouslySetInnerHTML={{ __html: "#__next{display:contents}" }} />
          {L && (BareHead ? <BareHead L={L} data={props!.data} /> : <DefaultHead L={L} />)}
        </Head>
        <body className={props?.bare ? undefined : "d-flex flex-column min-vh-100"}>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
