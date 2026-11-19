// Every URL lands here and goes through the ported Express pipeline: the route table
// decides whether to render a view, redirect, or reply with JSON/CSV/a file.
import type { GetServerSideProps } from "next";
import { handle } from "@/server/pipeline";
import type { PageProps } from "@/server/page-props";
import { Layout } from "@/views/Layout";
import { BARE_BODIES } from "@/views/bare";
import { helpers } from "@/views/helpers";
import { VIEWS } from "@/views/registry";

// Plain server-rendered HTML like the Express version: no React runtime in the
// browser, so public/js/app.js and the CDN scripts own the page as before.
export const config = { runtime: "nodejs", unstable_runtimeJS: false };

export const getServerSideProps: GetServerSideProps<PageProps> = async ({ req, res }) => {
  const outcome = await handle(req, res);
  if (outcome.kind === "sent") return { props: {} as PageProps };
  res.statusCode = outcome.status;
  return { props: outcome.props };
};

export default function Page({ L, view, bare, data }: PageProps) {
  if (!L) return null; // the response was already sent (redirect, JSON, file)
  const h = helpers(L);
  if (bare) {
    const Body = BARE_BODIES[view];
    return Body ? <Body L={L} h={h} data={data} /> : null;
  }
  const View = VIEWS[view];
  return <Layout L={L}>{View ? <View L={L} h={h} data={data} /> : null}</Layout>;
}
