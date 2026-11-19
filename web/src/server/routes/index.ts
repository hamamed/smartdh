// The route table, in the same order as the Express app: player routes first, then
// the admin router (mounted at /admin, and at the root on the admin subdomain).
import { Router } from "../router";
import { registerAccountRecoveryRoutes, registerAuthRoutes } from "./auth";
import { registerPublicRoutes } from "./public";
import { registerSystemRoutes } from "./system";

export const playerRouter = new Router();
export const adminRouter = new Router();

registerSystemRoutes(playerRouter);
registerPublicRoutes(playerRouter);
registerAuthRoutes(playerRouter);
// (phase 3: dashboard, invest, withdraw, send, … go here, as in server.js)
registerAccountRecoveryRoutes(playerRouter);
