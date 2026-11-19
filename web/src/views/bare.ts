// Views rendered without the main layout (Express `layout: false`): their own head
// tags and body. Filled in as those views are ported (start, invoices, statement).
import type { ComponentType } from "react";
import type { LayoutData } from "@/server/page-props";
import type { ViewProps } from "./registry";

export const BARE_HEADS: Record<string, ComponentType<{ L: LayoutData; data: Record<string, unknown> }>> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each view declares its own data shape
export const BARE_BODIES: Record<string, ComponentType<ViewProps<any>>> = {};
