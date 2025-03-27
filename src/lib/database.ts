export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          username: string | null
          chess_username: string | null
          created_at: string
          updated_at: string | null
          avatar_url: string | null
          role: string | null
          subscription_tier: string | null
          rating: number | null
          last_active: string | null
        }
        Insert: {
          id: string
          email?: string | null
          username?: string | null
          chess_username?: string | null
          created_at?: string
          updated_at?: string | null
          avatar_url?: string | null
          role?: string | null
          subscription_tier?: string | null
          rating?: number | null
          last_active?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          username?: string | null
          chess_username?: string | null
          created_at?: string
          updated_at?: string | null
          avatar_url?: string | null
          role?: string | null
          subscription_tier?: string | null
          rating?: number | null
          last_active?: string | null
        }
        Relationships: []
      }
      game_analyses: {
        Row: {
          id: string
          user_id: string
          game_id: string
          game_url: string
          player_color: string
          created_at: string
          updated_at: string | null
          analysis_data: Json | null
          accuracy_score: number | null
          opponent_accuracy: number | null
          pgn: string | null
          status: string
          engine_depth: number
        }
        Insert: {
          id?: string
          user_id: string
          game_id: string
          game_url: string
          player_color: string
          created_at?: string
          updated_at?: string | null
          analysis_data?: Json | null
          accuracy_score?: number | null
          opponent_accuracy?: number | null
          pgn?: string | null
          status?: string
          engine_depth?: number
        }
        Update: {
          id?: string
          user_id?: string
          game_id?: string
          game_url?: string
          player_color?: string
          created_at?: string
          updated_at?: string | null
          analysis_data?: Json | null
          accuracy_score?: number | null
          opponent_accuracy?: number | null
          pgn?: string | null
          status?: string
          engine_depth?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_analyses_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      move_analyses: {
        Row: {
          id: string
          game_analysis_id: string
          move_index: number
          fen: string
          move_san: string
          move_uci: string
          eval_before: number | null
          eval_after: number | null
          best_move: string | null
          quality: string | null
          created_at: string
          time_spent: number | null
          engine_depth: number
          principal_variation: Json | null
        }
        Insert: {
          id?: string
          game_analysis_id: string
          move_index: number
          fen: string
          move_san: string
          move_uci: string
          eval_before?: number | null
          eval_after?: number | null
          best_move?: string | null
          quality?: string | null
          created_at?: string
          time_spent?: number | null
          engine_depth?: number
          principal_variation?: Json | null
        }
        Update: {
          id?: string
          game_analysis_id?: string
          move_index?: number
          fen?: string
          move_san?: string
          move_uci?: string
          eval_before?: number | null
          eval_after?: number | null
          best_move?: string | null
          quality?: string | null
          created_at?: string
          time_spent?: number | null
          engine_depth?: number
          principal_variation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "move_analyses_game_analysis_id_fkey"
            columns: ["game_analysis_id"]
            referencedRelation: "game_analyses"
            referencedColumns: ["id"]
          }
        ]
      }
      polls: {
        Row: {
          id: string
          question: string
          options: Json
          votes: Json
          active: boolean
          created_at: string
          updated_at: string | null
          created_by: string | null
          type: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          question: string
          options: Json
          votes?: Json
          active?: boolean
          created_at?: string
          updated_at?: string | null
          created_by?: string | null
          type?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          question?: string
          options?: Json
          votes?: Json
          active?: boolean
          created_at?: string
          updated_at?: string | null
          created_by?: string | null
          type?: string | null
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          read: boolean
          created_at: string
          action_url: string | null
          type: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content: string
          read?: boolean
          created_at?: string
          action_url?: string | null
          type?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string
          read?: boolean
          created_at?: string
          action_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_progress: {
        Row: {
          id: string
          user_id: string
          games_played: number
          games_won: number
          games_drawn: number
          games_lost: number
          level_progress: number
          last_class_date: string | null
          next_class_date: string | null
          created_at: string
          updated_at: string | null
          current_rating: number | null
          rating_progress: number | null
        }
        Insert: {
          id?: string
          user_id: string
          games_played?: number
          games_won?: number
          games_drawn?: number
          games_lost?: number
          level_progress?: number
          last_class_date?: string | null
          next_class_date?: string | null
          created_at?: string
          updated_at?: string | null
          current_rating?: number | null
          rating_progress?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          games_played?: number
          games_won?: number
          games_drawn?: number
          games_lost?: number
          level_progress?: number
          last_class_date?: string | null
          next_class_date?: string | null
          created_at?: string
          updated_at?: string | null
          current_rating?: number | null
          rating_progress?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']