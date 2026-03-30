export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_lists: {
        Row: {
          active: boolean
          created_at: string
          allows_all_categories: boolean
          expense_categories: string[]
          id: string
          project: string | null
          project_code: string | null
          type: string
          value: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          allows_all_categories?: boolean
          expense_categories?: string[]
          id?: string
          project?: string | null
          project_code?: string | null
          type: string
          value: string
        }
        Update: {
          active?: boolean
          created_at?: string
          allows_all_categories?: boolean
          expense_categories?: string[]
          id?: string
          project?: string | null
          project_code?: string | null
          type?: string
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          performed_by: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          performed_by: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          performed_by?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          admin_approval_date: string | null
          admin_approval_status: string | null
          admin_description: string | null
          admin_approved_total: number | null
          admin_deduction_total: number | null
          admin_email: string | null
          claim_id: string
          created_at: string
          drive_file_ids: string[] | null
          grand_total: number | null
          id: string
          manager_approval_date: string | null
          manager_approval_status: string | null
          manager_description: string | null
          manager_email: string | null
          rejection_reason: string | null
          site_name: string
          status: string
          submitted_by: string
          total_with_bill: number
          total_without_bill: number
          user_email: string
        }
        Insert: {
          admin_approval_date?: string | null
          admin_approval_status?: string | null
          admin_description?: string | null
          admin_approved_total?: number | null
          admin_deduction_total?: number | null
          admin_email?: string | null
          claim_id: string
          created_at?: string
          drive_file_ids?: string[] | null
          grand_total?: number | null
          id?: string
          manager_approval_date?: string | null
          manager_approval_status?: string | null
          manager_description?: string | null
          manager_email?: string | null
          rejection_reason?: string | null
          site_name: string
          status?: string
          submitted_by: string
          total_with_bill?: number
          total_without_bill?: number
          user_email: string
        }
        Update: {
          admin_approval_date?: string | null
          admin_approval_status?: string | null
          admin_description?: string | null
          admin_approved_total?: number | null
          admin_deduction_total?: number | null
          admin_email?: string | null
          claim_id?: string
          created_at?: string
          drive_file_ids?: string[] | null
          grand_total?: number | null
          id?: string
          manager_approval_date?: string | null
          manager_approval_status?: string | null
          manager_description?: string | null
          manager_email?: string | null
          rejection_reason?: string | null
          site_name?: string
          status?: string
          submitted_by?: string
          total_with_bill?: number
          total_without_bill?: number
          user_email?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          app_notifications_enabled: boolean
          approval_note: string | null
          auto_approve_below: number | null
          company_name: string
          company_subtitle: string | null
          currency_symbol: string
          email_notifications_enabled: boolean
          id: string
          logo_url: string | null
          phone: string | null
          require_manager_approval: boolean
          support_email: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          app_notifications_enabled?: boolean
          approval_note?: string | null
          auto_approve_below?: number | null
          company_name?: string
          company_subtitle?: string | null
          currency_symbol?: string
          email_notifications_enabled?: boolean
          id?: string
          logo_url?: string | null
          phone?: string | null
          require_manager_approval?: boolean
          support_email?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          app_notifications_enabled?: boolean
          approval_note?: string | null
          auto_approve_below?: number | null
          company_name?: string
          company_subtitle?: string | null
          currency_symbol?: string
          email_notifications_enabled?: boolean
          id?: string
          logo_url?: string | null
          phone?: string | null
          require_manager_approval?: boolean
          support_email?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      expense_items: {
        Row: {
          amount_with_bill: number
          amount_without_bill: number
          approved_amount: number
          approval_remarks: string | null
          attachment_ids: string[] | null
          category: string
          claim_id: string
          created_at: string
          deduction_amount: number
          description: string | null
          expense_date: string | null
          id: string
          project_code: string | null
        }
        Insert: {
          amount_with_bill?: number
          amount_without_bill?: number
          approved_amount?: number
          approval_remarks?: string | null
          attachment_ids?: string[] | null
          category: string
          claim_id: string
          created_at?: string
          deduction_amount?: number
          description?: string | null
          expense_date?: string | null
          id?: string
          project_code?: string | null
        }
        Update: {
          amount_with_bill?: number
          amount_without_bill?: number
          approved_amount?: number
          approval_remarks?: string | null
          attachment_ids?: string[] | null
          category?: string
          claim_id?: string
          created_at?: string
          deduction_amount?: number
          description?: string | null
          expense_date?: string | null
          id?: string
          project_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["claim_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          title: string
          type: string
          user_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          title: string
          type?: string
          user_email: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_email?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          role: string
          token: string
          user_email: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          role: string
          token: string
          user_email: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          role?: string
          token?: string
          user_email?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          admin_email: string | null
          balance_after: number
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_email: string
        }
        Insert: {
          admin_email?: string | null
          balance_after?: number
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          user_email: string
        }
        Update: {
          admin_email?: string | null
          balance_after?: number
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_email?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          active: boolean
          advance_amount: number
          created_at: string
          date_of_joining: string | null
          email: string
          employee_id: string | null
          id: string
          manager_email: string | null
          mobile_number: string | null
          name: string
          password_hash: string
          profile_picture_url: string | null
          role: string
        }
        Insert: {
          active?: boolean
          advance_amount?: number
          created_at?: string
          date_of_joining?: string | null
          email: string
          employee_id?: string | null
          id?: string
          manager_email?: string | null
          mobile_number?: string | null
          name: string
          password_hash: string
          profile_picture_url?: string | null
          role?: string
        }
        Update: {
          active?: boolean
          advance_amount?: number
          created_at?: string
          date_of_joining?: string | null
          email?: string
          employee_id?: string | null
          id?: string
          manager_email?: string | null
          mobile_number?: string | null
          name?: string
          password_hash?: string
          profile_picture_url?: string | null
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
