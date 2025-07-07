import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

export interface ShareTokenData {
  documentId: string;
  sharedBy: string;
  sharedWith?: string;
  expiresAt: Date;
  maxUses?: number;
  usedCount: number;
  allowedIPs?: string[];
  permissions: string[];
}

@Injectable()
export class ShareTokenService {
  constructor(private supabaseService: SupabaseService) {}
  
  async generateShareToken(data: Omit<ShareTokenData, 'usedCount'>): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const supabase = this.supabaseService.getClient();
    
    // Guardar en la tabla share_tokens
    const { error } = await supabase
      .from('share_tokens')
      .insert({
        token,
        document_id: data.documentId,
        shared_by: data.sharedBy,
        shared_with: data.sharedWith,
        expires_at: data.expiresAt.toISOString(),
        max_uses: data.maxUses,
        allowed_ips: data.allowedIPs,
        permissions: data.permissions
      });
    
    if (error) {
      throw new Error('Error creating share token: ' + error.message);
    }
    
    return token;
  }

  async validateShareToken(token: string): Promise<ShareTokenData | null> {
    const supabase = this.supabaseService.getClient();
    
    const { data, error } = await supabase
      .from('share_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_revoked', false)
      .single();
    
    if (error || !data) return null;
    
    // Verificar si expiró
    if (new Date() > new Date(data.expires_at)) {
      return null;
    }
    
    // Verificar límite de usos
    if (data.max_uses && data.used_count >= data.max_uses) {
      return null;
    }
    
    return {
      documentId: data.document_id,
      sharedBy: data.shared_by,
      sharedWith: data.shared_with,
      expiresAt: new Date(data.expires_at),
      maxUses: data.max_uses,
      usedCount: data.used_count,
      allowedIPs: data.allowed_ips,
      permissions: data.permissions
    };
  }

  async incrementTokenUsage(token: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    
    // Primero obtenemos el contador actual
    const { data: currentData } = await supabase
      .from('share_tokens')
      .select('used_count')
      .eq('token', token)
      .single();
    
    if (!currentData) return false;
    
    // Incrementamos el contador
    const { error } = await supabase
      .from('share_tokens')
      .update({ used_count: currentData.used_count + 1 })
      .eq('token', token);
    
    return !error;
  }

  async revokeShareToken(token: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    
    const { error } = await supabase
      .from('share_tokens')
      .update({ is_revoked: true })
      .eq('token', token);
    
    return !error;
  }
}
