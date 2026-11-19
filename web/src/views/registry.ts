// View name → React component, like Express's res.render('name').
import type { ComponentType } from "react";
import type { LayoutData } from "@/server/page-props";
import type { Helpers } from "./helpers";
import ErrorView from "./pages/ErrorView";
import MessageView from "./pages/MessageView";

export interface ViewProps<D = Record<string, unknown>> { L: LayoutData; h: Helpers; data: D }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each view declares its own data shape
export const VIEWS: Record<string, ComponentType<ViewProps<any>>> = {
  error: ErrorView,
  message: MessageView,
};
