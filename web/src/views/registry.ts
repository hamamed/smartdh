// View name → React component, like Express's res.render('name').
import type { ComponentType } from "react";
import type { LayoutData } from "@/server/page-props";
import type { Helpers } from "./helpers";
import { ForgotView, LoginView, PendingView, ResetView, SignupView } from "./pages/AuthViews";
import ErrorView from "./pages/ErrorView";
import GuideView from "./pages/GuideView";
import { ContactView, DownloadView } from "./pages/InfoViews";
import LandingView from "./pages/LandingView";
import LegalView from "./pages/LegalView";
import MessageView from "./pages/MessageView";
import HomeView from "./pages/HomeView";
import InvestView from "./pages/InvestView";
import { AchievementsView, ActivityView, LeaderboardView, RewardsView } from "./pages/PlayerSmallViews";
import { ReferralView, VerifyIdentityView } from "./pages/ReferralKycViews";
import { SendView, SupportNewView, SupportTicketView, SupportView } from "./pages/SupportViews";
import { ProfileView, WithdrawView } from "./pages/WithdrawProfileViews";
import AdminsView from "./admin/AdminsView";
import { AuditView, TicketsView } from "./admin/AuditTicketsViews";
import { AppsView, SettingsCampaignView } from "./admin/CampaignAppsViews";
import DataView from "./admin/DataView";
import { EmailView, TestLabView } from "./admin/EmailTestViews";
import HubView from "./admin/HubView";
import { AccountView, DepositsView, InvoicesView, TicketView } from "./admin/ListViews";
import { SettingsEconomyView, SettingsGeneralView } from "./admin/SettingsBigViews";
import { SettingsAnnouncementView, SettingsHubView, SettingsPaymentsView, SettingsTelegramView } from "./admin/SettingsSmallViews";
import UserView from "./admin/UserView";
import UsersView from "./admin/UsersView";
import WithdrawalsView from "./admin/WithdrawalsView";

export interface ViewProps<D = Record<string, unknown>> { L: LayoutData; h: Helpers; data: D }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each view declares its own data shape
export const VIEWS: Record<string, ComponentType<ViewProps<any>>> = {
  error: ErrorView,
  message: MessageView,
  landing: LandingView,
  guide: GuideView,
  legal: LegalView,
  download: DownloadView,
  contact: ContactView,
  signup: SignupView,
  login: LoginView,
  forgot: ForgotView,
  reset: ResetView,
  pending: PendingView,
  home: HomeView,
  invest: InvestView,
  withdraw: WithdrawView,
  send: SendView,
  rewards: RewardsView,
  achievements: AchievementsView,
  activity: ActivityView,
  support: SupportView,
  "support-new": SupportNewView,
  "support-ticket": SupportTicketView,
  referral: ReferralView,
  profile: ProfileView,
  "verify-identity": VerifyIdentityView,
  leaderboard: LeaderboardView,
  "admin/hub": HubView,
  "admin/users": UsersView,
  "admin/user": UserView,
  "admin/test": TestLabView,
  "admin/account": AccountView,
  "admin/admins": AdminsView,
  "admin/email": EmailView,
  "admin/apps": AppsView,
  "admin/deposits": DepositsView,
  "admin/withdrawals": WithdrawalsView,
  "admin/invoices": InvoicesView,
  "admin/audit": AuditView,
  "admin/tickets": TicketsView,
  "admin/ticket": TicketView,
  "admin/settings": SettingsHubView,
  "admin/settings-general": SettingsGeneralView,
  "admin/settings-economy": SettingsEconomyView,
  "admin/settings-payments": SettingsPaymentsView,
  "admin/settings-announcement": SettingsAnnouncementView,
  "admin/settings-campaign": SettingsCampaignView,
  "admin/settings-telegram": SettingsTelegramView,
  "admin/data": DataView,
};
