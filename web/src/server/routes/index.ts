// The route table, in the same order as the Express app: player routes first, then
// the admin router (mounted at /admin, and at the root on the admin subdomain).
import { Router } from "../router";
import { registerSystemRoutes } from "./system";

export const playerRouter = new Router();
export const adminRouter = new Router();

registerSystemRoutes(playerRouter);
