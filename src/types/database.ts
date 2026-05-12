/**
 * Supabase database types — generated from migrations Phase 1
 * Régénérer avec : npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 * (nécessite : npx supabase login)
 *
 * DO NOT edit manually.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── Enums (CHECK constraints → union types) ─────────────────────────────────

export type OrgType = 'federation' | 'club' | 'association'

export type UserRole =
  | 'super_admin'
  | 'federation_admin'
  | 'club_admin'
  | 'referee'
  | 'player'

export type TournamentCategory =
  | 'M1000' | 'M500' | 'M250' | 'M100' | 'M50' | 'M25'
  | 'W1000' | 'W500' | 'W250' | 'W100' | 'W50' | 'W25'
  | 'JUNIOR_U15' | 'JUNIOR_U13' | 'JUNIOR_U11'

export type TournamentStatus = 'draft' | 'registration' | 'active' | 'completed' | 'cancelled'

export type MatchFormat = 'FORMAT_A' | 'FORMAT_B' | 'FORMAT_C' | 'FORMAT_D' | 'FORMAT_E'

export type EntryStatus = 'pending' | 'confirmed' | 'waitlist' | 'withdrawn' | 'disqualified'

export type MatchPhase =
  | 'qualification'
  | 'consolation'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'final'
  | 'third_place'

export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'walkover' | 'bye' | 'cancelled'

export type RankingRound = 'W' | 'SF' | 'QF' | 'R16' | 'R32' | 'R64' | 'QG'

export type PlayerGender = 'M' | 'F'

export type ServingSide = 'entry1' | 'entry2'

export type QualGroupPhase = 'qualification' | 'consolation'

// ─── Row types ────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          type: OrgType
          country: string
          logo_url: string | null
          website: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          type: OrgType
          country?: string
          logo_url?: string | null
          website?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          type?: OrgType
          country?: string
          logo_url?: string | null
          website?: string | null
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }

      org_members: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: UserRole
          invited_by: string | null
          joined_at: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role: UserRole
          invited_by?: string | null
          joined_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: UserRole
          invited_by?: string | null
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'org_members_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }

      player_profiles: {
        Row: {
          id: string
          org_id: string
          display_name: string
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          phone: string | null
          date_of_birth: string | null
          nationality: string
          gender: PlayerGender
          fip_id: string | null
          ranking_points: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          display_name: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          date_of_birth?: string | null
          nationality?: string
          gender: PlayerGender
          fip_id?: string | null
          ranking_points?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          org_id?: string
          display_name?: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          date_of_birth?: string | null
          nationality?: string
          gender?: PlayerGender
          fip_id?: string | null
          ranking_points?: number
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'player_profiles_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }

      tournaments: {
        Row: {
          id: string
          org_id: string
          name: string
          slug: string
          category: TournamentCategory
          status: TournamentStatus
          format: MatchFormat
          start_date: string
          end_date: string
          registration_end: string | null
          venue: string | null
          city: string | null
          country: string
          max_pairs: number
          prize_money: number | null
          currency: string
          description: string | null
          rules: string | null
          settings: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          slug: string
          category: TournamentCategory
          status?: TournamentStatus
          format?: MatchFormat
          start_date: string
          end_date: string
          registration_end?: string | null
          venue?: string | null
          city?: string | null
          country?: string
          max_pairs?: number
          prize_money?: number | null
          currency?: string
          description?: string | null
          rules?: string | null
          settings?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          org_id?: string
          name?: string
          slug?: string
          category?: TournamentCategory
          status?: TournamentStatus
          format?: MatchFormat
          start_date?: string
          end_date?: string
          registration_end?: string | null
          venue?: string | null
          city?: string | null
          country?: string
          max_pairs?: number
          prize_money?: number | null
          currency?: string
          description?: string | null
          rules?: string | null
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournaments_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }

      tournament_entries: {
        Row: {
          id: string
          tournament_id: string
          player1_id: string | null
          player2_id: string | null
          player1_name: string | null
          player2_name: string | null
          status: EntryStatus
          seed: number | null
          registered_at: string
          confirmed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          player1_id?: string | null
          player2_id?: string | null
          player1_name?: string | null
          player2_name?: string | null
          status?: EntryStatus
          seed?: number | null
          registered_at?: string
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          tournament_id?: string
          player1_id?: string | null
          player2_id?: string | null
          player1_name?: string | null
          player2_name?: string | null
          status?: EntryStatus
          seed?: number | null
          confirmed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_entries_tournament_id_fkey'
            columns: ['tournament_id']
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_entries_player1_id_fkey'
            columns: ['player1_id']
            referencedRelation: 'player_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_entries_player2_id_fkey'
            columns: ['player2_id']
            referencedRelation: 'player_profiles'
            referencedColumns: ['id']
          },
        ]
      }

      qual_groups: {
        Row: {
          id: string
          tournament_id: string
          name: string
          group_index: number
          phase: QualGroupPhase
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          group_index: number
          phase?: QualGroupPhase
          created_at?: string
        }
        Update: {
          tournament_id?: string
          name?: string
          group_index?: number
          phase?: QualGroupPhase
        }
        Relationships: [
          {
            foreignKeyName: 'qual_groups_tournament_id_fkey'
            columns: ['tournament_id']
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }

      qual_group_entries: {
        Row: {
          id: string
          group_id: string
          entry_id: string
          position: number | null
          points: number
          games_won: number
          games_lost: number
          matches_played: number
          matches_won: number
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          entry_id: string
          position?: number | null
          points?: number
          games_won?: number
          games_lost?: number
          matches_played?: number
          matches_won?: number
          created_at?: string
        }
        Update: {
          position?: number | null
          points?: number
          games_won?: number
          games_lost?: number
          matches_played?: number
          matches_won?: number
        }
        Relationships: [
          {
            foreignKeyName: 'qual_group_entries_group_id_fkey'
            columns: ['group_id']
            referencedRelation: 'qual_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'qual_group_entries_entry_id_fkey'
            columns: ['entry_id']
            referencedRelation: 'tournament_entries'
            referencedColumns: ['id']
          },
        ]
      }

      matches: {
        Row: {
          id: string
          tournament_id: string
          group_id: string | null
          phase: MatchPhase
          round: number | null
          match_number: number | null
          format: MatchFormat
          status: MatchStatus
          entry1_id: string | null
          entry2_id: string | null
          winner_id: string | null
          score: Json | null
          court: string | null
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          referee_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          group_id?: string | null
          phase: MatchPhase
          round?: number | null
          match_number?: number | null
          format?: MatchFormat
          status?: MatchStatus
          entry1_id?: string | null
          entry2_id?: string | null
          winner_id?: string | null
          score?: Json | null
          court?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          referee_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          group_id?: string | null
          phase?: MatchPhase
          round?: number | null
          match_number?: number | null
          format?: MatchFormat
          status?: MatchStatus
          entry1_id?: string | null
          entry2_id?: string | null
          winner_id?: string | null
          score?: Json | null
          court?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          referee_id?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'matches_tournament_id_fkey'
            columns: ['tournament_id']
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_group_id_fkey'
            columns: ['group_id']
            referencedRelation: 'qual_groups'
            referencedColumns: ['id']
          },
        ]
      }

      live_scores: {
        Row: {
          id: string
          match_id: string
          tournament_id: string
          set_number: number
          score_entry1: number
          score_entry2: number
          tiebreak_entry1: number | null
          tiebreak_entry2: number | null
          game_entry1: number
          game_entry2: number
          sets_history: Json
          is_tiebreak: boolean
          serving: ServingSide | null
          court_name: string | null
          player1_name: string | null
          player2_name: string | null
          player3_name: string | null
          player4_name: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          match_id: string
          tournament_id: string
          set_number?: number
          score_entry1?: number
          score_entry2?: number
          tiebreak_entry1?: number | null
          tiebreak_entry2?: number | null
          game_entry1?: number
          game_entry2?: number
          sets_history?: Json
          is_tiebreak?: boolean
          serving?: ServingSide | null
          court_name?: string | null
          player1_name?: string | null
          player2_name?: string | null
          player3_name?: string | null
          player4_name?: string | null
          updated_at?: string
        }
        Update: {
          set_number?: number
          score_entry1?: number
          score_entry2?: number
          tiebreak_entry1?: number | null
          tiebreak_entry2?: number | null
          game_entry1?: number
          game_entry2?: number
          sets_history?: Json
          is_tiebreak?: boolean
          serving?: ServingSide | null
          court_name?: string | null
          player1_name?: string | null
          player2_name?: string | null
          player3_name?: string | null
          player4_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'live_scores_match_id_fkey'
            columns: ['match_id']
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'live_scores_tournament_id_fkey'
            columns: ['tournament_id']
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }

      ranking_points: {
        Row: {
          id: string
          player_id: string
          tournament_id: string
          match_id: string | null
          category: TournamentCategory
          round: RankingRound
          points: number
          tournament_date: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          tournament_id: string
          match_id?: string | null
          category: TournamentCategory
          round: RankingRound
          points: number
          tournament_date: string
          expires_at?: string
          created_at?: string
        }
        Update: {
          player_id?: string
          tournament_id?: string
          match_id?: string | null
          category?: TournamentCategory
          round?: RankingRound
          points?: number
          tournament_date?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ranking_points_player_id_fkey'
            columns: ['player_id']
            referencedRelation: 'player_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ranking_points_tournament_id_fkey'
            columns: ['tournament_id']
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }

      rankings_snapshots: {
        Row: {
          id: string
          org_id: string
          player_id: string
          category: TournamentCategory
          rank_position: number
          total_points: number
          best_results: Json
          tournaments_count: number
          computed_at: string
        }
        Insert: {
          id?: string
          org_id: string
          player_id: string
          category: TournamentCategory
          rank_position: number
          total_points?: number
          best_results?: Json
          tournaments_count?: number
          computed_at?: string
        }
        Update: {
          rank_position?: number
          total_points?: number
          best_results?: Json
          tournaments_count?: number
          computed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rankings_snapshots_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rankings_snapshots_player_id_fkey'
            columns: ['player_id']
            referencedRelation: 'player_profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }

    Views: Record<string, never>

    Functions: {
      is_org_admin: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { p_org_id: string }
        Returns: boolean
      }
    }

    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ─── Helpers de convenance ────────────────────────────────────────────────────

/** Extraire le type Row d'une table */
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** Extraire le type Insert d'une table */
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

/** Extraire le type Update d'une table */
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// ─── Aliases pratiques ────────────────────────────────────────────────────────

export type Organization     = TableRow<'organizations'>
export type OrgMember        = TableRow<'org_members'>
export type PlayerProfile    = TableRow<'player_profiles'>
export type Tournament       = TableRow<'tournaments'>
export type TournamentEntry  = TableRow<'tournament_entries'>
export type QualGroup        = TableRow<'qual_groups'>
export type QualGroupEntry   = TableRow<'qual_group_entries'>
export type Match            = TableRow<'matches'>
export type LiveScore        = TableRow<'live_scores'>
export type RankingPoint     = TableRow<'ranking_points'>
export type RankingsSnapshot = TableRow<'rankings_snapshots'>
