// Generated from the local database by npm run db:types.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          household_id: string
          id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          household_id: string
          id?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          household_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_household_category_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          household_id: string
          icon: string | null
          id: string
          is_default: boolean
          is_hidden: boolean
          name: string
          reminder_enabled: boolean
          sort_order: number
          type: Database["public"]["Enums"]["category_type"]
        }
        Insert: {
          color?: string | null
          household_id: string
          icon?: string | null
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          name: string
          reminder_enabled?: boolean
          sort_order?: number
          type?: Database["public"]["Enums"]["category_type"]
        }
        Update: {
          color?: string | null
          household_id?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          name?: string
          reminder_enabled?: boolean
          sort_order?: number
          type?: Database["public"]["Enums"]["category_type"]
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invitations: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          household_id: string
          id: string
          max_uses: number
          token: string
          uses_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          household_id: string
          id?: string
          max_uses: number
          token: string
          uses_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          household_id?: string
          id?: string
          max_uses?: number
          token?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          display_name: string | null
          household_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          display_name?: string | null
          household_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          display_name?: string | null
          household_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          fiscal_year_start_month: number
          id: string
          name: string
          period_start_day: number
        }
        Insert: {
          created_at?: string
          created_by: string
          fiscal_year_start_month?: number
          id?: string
          name: string
          period_start_day?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          fiscal_year_start_month?: number
          id?: string
          name?: string
          period_start_day?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          is_active: boolean
          is_shared: boolean
          memo: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          is_active?: boolean
          is_shared?: boolean
          memo?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          is_active?: boolean
          is_shared?: boolean
          memo?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_household_category_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "recurring_transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          start_date: string
          target_amount: number
          target_date: string | null
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          start_date: string
          target_amount: number
          target_date?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          start_date?: string
          target_amount?: number
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          household_id: string
          id: string
          period_start: string
          settled_at: string
          settled_by: string
          snapshot: Json
        }
        Insert: {
          household_id: string
          id?: string
          period_start: string
          settled_at?: string
          settled_by: string
          snapshot: Json
        }
        Update: {
          household_id?: string
          id?: string
          period_start?: string
          settled_at?: string
          settled_by?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settlements_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          date: string
          household_id: string
          id: string
          import_key: string | null
          is_shared: boolean
          memo: string | null
          on_behalf_of: string | null
          recurring_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          date: string
          household_id: string
          id?: string
          import_key?: string | null
          is_shared?: boolean
          memo?: string | null
          on_behalf_of?: string | null
          recurring_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          household_id?: string
          id?: string
          import_key?: string | null
          is_shared?: boolean
          memo?: string | null
          on_behalf_of?: string | null
          recurring_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_household_category_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_on_behalf_fkey"
            columns: ["household_id", "on_behalf_of"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["household_id", "user_id"]
          },
          {
            foreignKeyName: "transactions_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: string }
      agent_api_v1: {
        Args: { _arguments: Json; _operation: string; _token: string }
        Returns: Json
      }
      category_usage: {
        Args: { _household_id: string }
        Returns: {
          budgets: number
          category_id: string
          recurring: number
          transactions: number
        }[]
      }
      confirm_transaction_import: {
        Args: { _household_id: string; _month: string; _rows: Json }
        Returns: number
      }
      confirm_transaction_import_v2: {
        Args: {
          _household_id: string
          _member_id: string | null
          _month: string
          _rows: Json
        }
        Returns: number
      }
      consume_rate_limit: {
        Args: {
          _bucket: string
          _key_hash: string
          _limit: number
          _window_seconds: number
        }
        Returns: boolean
      }
      consume_rate_limit_with_reset: {
        Args: {
          _bucket: string
          _key_hash: string
          _limit: number
          _window_seconds: number
        }
        Returns: Json
      }
      create_agent_token: { Args: { _label: string }; Returns: string }
      create_settlement: {
        Args: { _household_id: string; _ref: string }
        Returns: string
      }
      delete_own_account: { Args: never; Returns: undefined }
      generate_all_due_recurring: {
        Args: { _as_of_date: string }
        Returns: number
      }
      generate_due_recurring: {
        Args: { _household_id: string }
        Returns: number
      }
      get_agent_routing: { Args: never; Returns: Json }
      invitation_preview: {
        Args: { _token: string }
        Returns: {
          household_name: string
          status: string
        }[]
      }
      list_agent_tokens: {
        Args: never
        Returns: {
          created_at: string
          id: string
          label: string
        }[]
      }
      merge_category: {
        Args: {
          _destination_id: string
          _household_id: string
          _source_id: string
        }
        Returns: undefined
      }
      reorder_categories: {
        Args: {
          _category_ids: string[]
          _household_id: string
          _type: Database["public"]["Enums"]["category_type"]
        }
        Returns: undefined
      }
      revoke_agent_token: { Args: { _id: string }; Returns: undefined }
      save_agent_routing: {
        Args: {
          _category_map: Json
          _home_id: string
          _personal_id: string
          _transfer_id: string
        }
        Returns: undefined
      }
      set_member_display_name: {
        Args: { _display_name: string; _household_id: string }
        Returns: undefined
      }
      set_preset_category_visibility: {
        Args: { _category_id: string; _hidden: boolean; _household_id: string }
        Returns: undefined
      }
      transaction_daily_summary: {
        Args: {
          _category_id?: string
          _end: string
          _household_id: string
          _max_amount?: number
          _member_id?: string
          _memo_pattern?: string
          _min_amount?: number
          _start: string
          _type?: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: {
          count: number
          date: string
          expense: number
          income: number
        }[]
      }
      transfer_ownership: {
        Args: { _household_id: string; _new_owner: string }
        Returns: undefined
      }
    }
    Enums: {
      category_type: "income" | "expense" | "both"
      member_role: "owner" | "member"
      transaction_type: "income" | "expense"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      category_type: ["income", "expense", "both"],
      member_role: ["owner", "member"],
      transaction_type: ["income", "expense"],
    },
  },
} as const

// 既存の呼び出し元が使用する列挙型の別名。
export type MemberRole = Database["public"]["Enums"]["member_role"]
export type TransactionType = Database["public"]["Enums"]["transaction_type"]
export type CategoryType = Database["public"]["Enums"]["category_type"]
