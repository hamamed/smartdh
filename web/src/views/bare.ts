// Views rendered without the main layout (Express `layout: false`): their own head
// tags, body class and body.
import type { ComponentType } from "react";
import type { LayoutData } from "@/server/page-props";
import type { ViewProps } from "./registry";
import { StartBody, StartHead } from "./pages/StartView";

type HeadComponent = ComponentType<{ L: LayoutData; data: Record<string, unknown> }>;

export const BARE_HEADS: Record<string, HeadComponent> = {
  start: StartHead,
};
export const BARE_BODY_CLASS: Record<string, string> = {
  start: "lp-page d-flex flex-column min-vh-100",
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each view declares its own data shape
export const BARE_BODIES: Record<string, ComponentType<ViewProps<any>>> = {
  start: StartBody,
};
