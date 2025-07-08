import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_ANON_KEY') || '',
    );
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  // 🔑 Método para obtener cliente con token de usuario específico
  getClientWithAuth(accessToken: string): SupabaseClient {
    const authenticatedClient = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_ANON_KEY') || '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );
    
    return authenticatedClient;
  }

  // 🔑 Método para establecer sesión en el cliente existente
  async setSession(accessToken: string, refreshToken: string) {
    const { data, error } = await this.supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    
    if (error) {
      console.error('❌ Error setting session:', error);
      return false;
    }
    
    console.log('✅ Session set successfully');
    return true;
  }
}
