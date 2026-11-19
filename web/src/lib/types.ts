// Shape of data/db.json. Mirrors what the Express app writes (see db.ts migrate()).
// Fields are optional where older records may lack them.

export interface Tx { type: string; amount: number; note: string; at: number; ref?: number }
export interface HistoryPoint { t?: number; total?: number; invested?: number; earnings?: number; referral?: number }
export interface Notice { id: number; text: string; at: number; read: boolean }
export interface Payout { method: "paypal" | "bank"; name: string; paypal: string; rib: string; details?: string }
export interface Kyc {
  status: "none" | "requested" | "submitted" | "approved" | "rejected";
  fullName: string; dob: string; address: string; cinFront: string; cinBack: string; reviewNote: string;
  requestedAt: number; submittedAt: number; reviewedAt: number;
}

export interface User {
  id: number; name: string; email: string; passwordHash: string;
  isAdmin: boolean; role: string | null;
  status: "pending" | "active" | "rejected";
  lang: string | null; isTest: boolean;
  invested: Record<string, number>; earnings: number; xp: number;
  lastAccrual?: number; createdAt: number;
  transactions: Tx[]; achievements: string[]; history: HistoryPoint[];
  streak: { count: number; lastClaim: string | null };
  payout: Payout;
  referralEarnings: number; refAccrued: number; refLastTx: number;
  campaignClaims: number; campaignRewarded: boolean;
  avatar: string; onboarded: boolean; gsDismissed: boolean;
  reset: { token: string; expires: number } | null;
  referralCode: string; referredBy: number | null;
  emailToken: string; emailOptOut: boolean;
  emailVerified: boolean; verifyToken: string | null;
  lastLogin: number | null; lastSeen: number | null; logins: { at: number; ip: string }[];
  notices: Notice[]; kyc: Kyc;
  pendingEmail?: string | null;
}

export interface Deposit {
  id: number; userId: number; userName?: string; plan: string; planLabel: string; amount: number;
  status: "pending" | "approved" | "rejected" | "cancelled"; note?: string; receipt?: string; byAdmin?: boolean;
  createdAt: number; approvedAt?: number | null; expiresAt?: number | null; cancelledAt?: number | null;
}

export interface Withdrawal {
  id: number; userId: number; userName: string; amount: number; from: string; fromLabel?: string;
  method?: string; payoutName?: string; payoutAccount?: string;
  status: "pending" | "paid" | "rejected"; rejectReason?: string; rejectNote?: string; createdAt: number;
  scheduled?: { action: "approve" | "reject"; at: number; reason: string; reasonNote: string; byName: string } | null;
}

export interface Transfer { id: number; fromId: number; fromName: string; toId: number; toName: string; amount: number; createdAt: number }

export interface TicketMessage { from: "user" | "admin"; authorName?: string; text: string; at: number; file?: string; fileName?: string; fileType?: string }
export interface Ticket {
  id: number; userId: number; topic: string; subject: string; status: "open" | "answered" | "closed";
  messages: TicketMessage[]; createdAt: number; updatedAt: number; unreadUser?: boolean; unreadAdmin?: boolean;
}

export interface Schedule { id: number; userId: number; plan: string; amount: number; frequency: "daily" | "weekly" | "monthly"; nextRun: number; active: boolean; lastRun?: number }
export interface AuditEntry { id: number; at: number; adminId: number | null; adminName: string; action: string; details: string }

export interface Plan {
  id: string; name: string; icon: string; imageUrl: string; ratePer15Days: number; color: string;
  desc: string; link: string; fixedAmount: number; minLevel: number; published: boolean;
}

export interface GrowthDim { base: number; min: number; spread: number }

export interface Campaign {
  enabled: boolean; title: string; inviteGoal: number; minDeposit: number; requireActive: boolean;
  coinsPerInvite: number; xpPerInvite: number; rewardCoins: number; rewardXp: number; maxClaims: number; countFrom: number;
}

export interface Settings {
  siteName: string; logoUrl: string; brandMode: "text" | "logo"; emailLogoUrl: string; currency: string;
  announcement: { text: string; enabled: boolean };
  telegram: { enabled: boolean; botToken: string; chatId: string };
  plans: Plan[];
  minAddFunds: number; minWithdraw: number; minTransfer: number; withdrawEveryDays: number;
  leaderboardEnabled: boolean; dailyBonusEnabled: boolean;
  homeStats: { enabled: boolean; start: number; users: GrowthDim; payouts: GrowthDim; coins: GrowthDim };
  depositLockDays: number; referralTiers: number[]; campaign: Campaign; dailyBonusBase: number;
  depositInfo: { bankName: string; accountName: string; rib: string; note: string };
  payout?: Payout;
  referralPercent?: number;
}

export interface Db {
  users: User[]; withdrawals: Withdrawal[]; deposits: Deposit[]; transfers: Transfer[];
  audit: AuditEntry[]; schedules: Schedule[]; tickets: Ticket[]; settings: Settings;
  nextUserId: number; nextWithdrawId: number; nextDepositId: number; nextTransferId: number;
  nextAppId: number; nextAuditId: number; nextTicketId: number; nextScheduleId: number;
}
