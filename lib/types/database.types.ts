export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      lesson: {
        Row: {
          compiled_code: Json | null;
          compiled_file_path: string | null;
          created_at: string | null;
          error_at: string | null;
          error_metadata: Json | null;
          failed_at: string | null;
          failed_metadata: Json | null;
          generated_code: Json;
          generated_file_path: string | null;
          id: string;
          lesson_compiled_at: string | null;
          lesson_compiled_metadata: Json | null;
          lesson_generated_at: string | null;
          lesson_generated_metadata: Json | null;
          lesson_validating_at: string | null;
          lesson_validating_metadata: Json | null;
          outline_request_id: string;
          title: string | null;
          updated_at: string | null;
          validation_attempts: number | null;
        };
        Insert: {
          compiled_code?: Json | null;
          compiled_file_path?: string | null;
          created_at?: string | null;
          error_at?: string | null;
          error_metadata?: Json | null;
          failed_at?: string | null;
          failed_metadata?: Json | null;
          generated_code: Json;
          generated_file_path?: string | null;
          id?: string;
          lesson_compiled_at?: string | null;
          lesson_compiled_metadata?: Json | null;
          lesson_generated_at?: string | null;
          lesson_generated_metadata?: Json | null;
          lesson_validating_at?: string | null;
          lesson_validating_metadata?: Json | null;
          outline_request_id: string;
          title?: string | null;
          updated_at?: string | null;
          validation_attempts?: number | null;
        };
        Update: {
          compiled_code?: Json | null;
          compiled_file_path?: string | null;
          created_at?: string | null;
          error_at?: string | null;
          error_metadata?: Json | null;
          failed_at?: string | null;
          failed_metadata?: Json | null;
          generated_code?: Json;
          generated_file_path?: string | null;
          id?: string;
          lesson_compiled_at?: string | null;
          lesson_compiled_metadata?: Json | null;
          lesson_generated_at?: string | null;
          lesson_generated_metadata?: Json | null;
          lesson_validating_at?: string | null;
          lesson_validating_metadata?: Json | null;
          outline_request_id?: string;
          title?: string | null;
          updated_at?: string | null;
          validation_attempts?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_outline_request_id_fkey';
            columns: ['outline_request_id'];
            isOneToOne: false;
            referencedRelation: 'outline_request';
            referencedColumns: ['id'];
          },
        ];
      };
      outline_request: {
        Row: {
          content_blocks: Json | null;
          created_at: string | null;
          error_at: string | null;
          error_metadata: Json | null;
          failed_at: string | null;
          failed_metadata: Json | null;
          id: string;
          num_lessons: number | null;
          outline: string;
          outline_blocks_generated_at: string | null;
          outline_blocks_generated_metadata: Json | null;
          outline_blocks_generating_at: string | null;
          outline_blocks_generating_metadata: Json | null;
          outline_validated_at: string | null;
          outline_validated_metadata: Json | null;
          outline_validating_at: string | null;
          outline_validating_metadata: Json | null;
          submitted_at: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Insert: {
          content_blocks?: Json | null;
          created_at?: string | null;
          error_at?: string | null;
          error_metadata?: Json | null;
          failed_at?: string | null;
          failed_metadata?: Json | null;
          id?: string;
          num_lessons?: number | null;
          outline: string;
          outline_blocks_generated_at?: string | null;
          outline_blocks_generated_metadata?: Json | null;
          outline_blocks_generating_at?: string | null;
          outline_blocks_generating_metadata?: Json | null;
          outline_validated_at?: string | null;
          outline_validated_metadata?: Json | null;
          outline_validating_at?: string | null;
          outline_validating_metadata?: Json | null;
          submitted_at?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Update: {
          content_blocks?: Json | null;
          created_at?: string | null;
          error_at?: string | null;
          error_metadata?: Json | null;
          failed_at?: string | null;
          failed_metadata?: Json | null;
          id?: string;
          num_lessons?: number | null;
          outline?: string;
          outline_blocks_generated_at?: string | null;
          outline_blocks_generated_metadata?: Json | null;
          outline_blocks_generating_at?: string | null;
          outline_blocks_generating_metadata?: Json | null;
          outline_validated_at?: string | null;
          outline_validated_metadata?: Json | null;
          outline_validating_at?: string | null;
          outline_validating_metadata?: Json | null;
          submitted_at?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
