// The route table, in the same order as the Express app: player routes first, then
// the admin router (mounted at /admin, and at the root on the admin subdomain).
import { Router } from "../router";
import { registerAccountRecoveryRoutes, registerAuthRoutes } from "./auth";
import { registerMoneyActions, registerPlayerActions } from "./player-actions";
import { registerPlayerPages } from "./player-pages";
import {
  registerAdminDataActions, registerAdminMoreUserActions, registerAdminSettingsActions, registerAdminTeamActions,
  registerAdminTelegramAndWithdrawActions, registerAdminTicketActions, registerAdminUserActions,
} from "./admin-actions";
import {
  registerAdminDataPages, registerAdminLaterPages, registerAdminMoneyPages, registerAdminPages, registerAdminSectionPages,
  registerAdminSettingsPages, registerAdminTelegramPage,
} from "./admin-pages";
import { registerPublicRoutes } from "./public";
import { registerSystemRoutes } from "./system";

export const playerRouter = new Router();
export const adminRouter = new Router();

registerSystemRoutes(playerRouter);
registerPublicRoutes(playerRouter);
registerAuthRoutes(playerRouter);
registerPlayerPages(playerRouter);
registerPlayerActions(playerRouter);
registerAccountRecoveryRoutes(playerRouter);
registerMoneyActions(playerRouter);

// Admin router, in the Express order.
registerAdminPages(adminRouter);
registerAdminUserActions(adminRouter);
registerAdminLaterPages(adminRouter);
registerAdminMoreUserActions(adminRouter);
registerAdminSectionPages(adminRouter);
registerAdminTeamActions(adminRouter);
registerAdminMoneyPages(adminRouter);
registerAdminTicketActions(adminRouter);
registerAdminSettingsPages(adminRouter);
registerAdminDataPages(adminRouter);
registerAdminDataActions(adminRouter);
registerAdminSettingsActions(adminRouter);
registerAdminTelegramPage(adminRouter);
registerAdminTelegramAndWithdrawActions(adminRouter);
