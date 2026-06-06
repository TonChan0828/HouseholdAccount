/**
 * Supabase の DB スキーマ型。
 *
 * これは `supabase/migrations/` のスキーマに対応する手書きの型定義。
 * Supabase プロジェクト接続後は次のコマンドで再生成できる:
 *   npx supabase gen types typescript --project-id <id> > types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MemberRole = "owner" | "member";
export type TransactionType = "income" | "expense";
export type CategoryType = "income" | "expense" | "both";

export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: MemberRole;
          joined_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role?: MemberRole;
          joined_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          role?: MemberRole;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          color: string | null;
          icon: string | null;
          type: CategoryType;
          is_default: boolean;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          color?: string | null;
          icon?: string | null;
          type?: CategoryType;
          is_default?: boolean;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          color?: string | null;
          icon?: string | null;
          type?: CategoryType;
          is_default?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey";
            columns: ["household_id"];
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          household_id: string;
          created_by: string;
          amount: number;
          type: TransactionType;
          category_id: string | null;
          date: string;
          memo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by: string;
          amount: number;
          type: TransactionType;
          category_id?: string | null;
          date: string;
          memo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          created_by?: string;
          amount?: number;
          type?: TransactionType;
          category_id?: string | null;
          date?: string;
          memo?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_household_id_fkey";
            columns: ["household_id"];
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_household_member: {
        Args: { _household_id: string };
        Returns: boolean;
      };
      is_household_owner: {
        Args: { _household_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
