import type {
  CategoryType,
  Database,
  MemberRole,
  TransactionType,
} from "@/types/database";

type Tables = Database["public"]["Tables"];

export type Household = Tables["households"]["Row"];
export type HouseholdMember = Tables["household_members"]["Row"];
export type HouseholdInvitation = Tables["household_invitations"]["Row"];
export type Category = Tables["categories"]["Row"];
export type Transaction = Tables["transactions"]["Row"];

export type { CategoryType, MemberRole, TransactionType };

/** household_members + auth ユーザー情報を合わせたメンバー表示用の型 */
export type Member = HouseholdMember & {
  email?: string | null;
  display_name?: string | null;
};
