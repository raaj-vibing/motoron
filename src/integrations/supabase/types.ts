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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string
          phone: string
          workshop_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name: string
          phone: string
          workshop_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      job_card_parts: {
        Row: {
          created_at: string | null
          id: string
          job_card_id: string | null
          line_total: number | null
          part_name: string
          quantity: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_card_id?: string | null
          line_total?: number | null
          part_name: string
          quantity: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          job_card_id?: string | null
          line_total?: number | null
          part_name?: string
          quantity?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_card_parts_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cards: {
        Row: {
          completed_notification_sent: boolean | null
          created_at: string | null
          created_by: string | null
          custom_package_amount: number | null
          customer_complaint: string | null
          customer_id: string | null
          dropoff_notification_sent: boolean | null
          dropped_off_at: string | null
          id: string
          job_number: string
          mileage_at_dropoff: number | null
          package_id: string | null
          payment_status: string | null
          picked_up_at: string | null
          pickup_requested_date: string | null
          repair_completed_at: string | null
          status: string | null
          updated_at: string | null
          vehicle_id: string | null
          workshop_id: string | null
        }
        Insert: {
          completed_notification_sent?: boolean | null
          created_at?: string | null
          created_by?: string | null
          custom_package_amount?: number | null
          customer_complaint?: string | null
          customer_id?: string | null
          dropoff_notification_sent?: boolean | null
          dropped_off_at?: string | null
          id?: string
          job_number: string
          mileage_at_dropoff?: number | null
          package_id?: string | null
          payment_status?: string | null
          picked_up_at?: string | null
          pickup_requested_date?: string | null
          repair_completed_at?: string | null
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          workshop_id?: string | null
        }
        Update: {
          completed_notification_sent?: boolean | null
          created_at?: string | null
          created_by?: string | null
          custom_package_amount?: number | null
          customer_complaint?: string | null
          customer_id?: string | null
          dropoff_notification_sent?: boolean | null
          dropped_off_at?: string | null
          id?: string
          job_number?: string
          mileage_at_dropoff?: number | null
          package_id?: string | null
          payment_status?: string | null
          picked_up_at?: string | null
          pickup_requested_date?: string | null
          repair_completed_at?: string | null
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workshop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanics: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          workshop_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          workshop_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mechanics_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_library: {
        Row: {
          created_at: string | null
          default_unit: string | null
          id: string
          name: string
          sort_order: number | null
          workshop_id: string | null
        }
        Insert: {
          created_at?: string | null
          default_unit?: string | null
          id?: string
          name: string
          sort_order?: number | null
          workshop_id?: string | null
        }
        Update: {
          created_at?: string | null
          default_unit?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_library_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          created_at: string | null
          id: string
          is_custom: boolean | null
          name: string
          price: number
          sort_order: number | null
          subtitle: string | null
          workshop_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          name: string
          price?: number
          sort_order?: number | null
          subtitle?: string | null
          workshop_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          name?: string
          price?: number
          sort_order?: number | null
          subtitle?: string | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          access_level: string
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          pin: string
          role: string
          status: string | null
          workshop_id: string | null
        }
        Insert: {
          access_level: string
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          pin: string
          role: string
          status?: string | null
          workshop_id?: string | null
        }
        Update: {
          access_level?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          pin?: string
          role?: string
          status?: string | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          colour: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          last_mileage: number | null
          licence_plate: string | null
          make: string
          model: string
          type: string
          workshop_id: string | null
          year: number | null
        }
        Insert: {
          colour?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          last_mileage?: number | null
          licence_plate?: string | null
          make: string
          model: string
          type: string
          workshop_id?: string | null
          year?: number | null
        }
        Update: {
          colour?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          last_mileage?: number | null
          licence_plate?: string | null
          make?: string
          model?: string
          type?: string
          workshop_id?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          address: string | null
          auto_archive_months: number
          completed_template: string | null
          created_at: string | null
          dropoff_template: string | null
          gst_number: string | null
          hours: Json | null
          id: string
          job_duration_threshold: number | null
          logo: string | null
          maps_link: string | null
          name: string
          notify_completed: boolean | null
          notify_dropoff: boolean | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          auto_archive_months?: number
          completed_template?: string | null
          created_at?: string | null
          dropoff_template?: string | null
          gst_number?: string | null
          hours?: Json | null
          id?: string
          job_duration_threshold?: number | null
          logo?: string | null
          maps_link?: string | null
          name: string
          notify_completed?: boolean | null
          notify_dropoff?: boolean | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          auto_archive_months?: number
          completed_template?: string | null
          created_at?: string | null
          dropoff_template?: string | null
          gst_number?: string | null
          hours?: Json | null
          id?: string
          job_duration_threshold?: number | null
          logo?: string | null
          maps_link?: string | null
          name?: string
          notify_completed?: boolean | null
          notify_dropoff?: boolean | null
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      workshop_members: {
        Row: {
          access_level: string | null
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
          phone: string | null
          role: string | null
          status: string | null
          workshop_id: string | null
        }
        Insert: {
          access_level?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          workshop_id?: string | null
        }
        Update: {
          access_level?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
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
