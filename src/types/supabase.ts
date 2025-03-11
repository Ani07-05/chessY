export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          password: string
          chess_username: string
          created_at: string
          updated_at: string
        }
        Select: {
          id: string
          email: string
          chess_username: string
          created_at: string
          updated_at: string
        }
        Insert: {
          email: string
          password: string
          chess_username: string
        }
        Update: {
          id?: string
          email?: string
          password?: string
          chess_username?: string
          updated_at?: string
        }
      }
      polls: {
        Row: {
          id: number
          question: string
          options: Record<string, string>
          votes: Record<string, number>
          active: boolean
          created_at: string
        }
        Insert: {
          question: string
          options: Record<string, string>
          votes?: Record<string, number>
          active?: boolean
        }
        Update: {
          id?: number
          question?: string
          options?: Record<string, string>
          votes?: Record<string, number>
          active?: boolean
        }
      }
      visits: {
        Row: {
          id: string
          auth_id: string | null
          created_at: string
        }
        Insert: {
          auth_id?: string
        }
        Update: {
          id?: string
          auth_id?: string | null
        }
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

