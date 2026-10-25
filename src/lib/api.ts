// src/lib/api.ts
import { supabase } from './supabase';

// API Provider'ları veritabanından çek
export async function getApiProviders() {
  const { data } = await supabase
    .from('api_providers')
    .select('*')
    .eq('enabled', true);
  
  return data || [];
}

// Tüm API'lerden servisleri çek
export async function fetchAllApiServices() {
  const providers = await getApiProviders();
  let allServices: any[] = [];

  for (const provider of providers) {
    try {
      const response = await fetch(`${provider.url}/services`, {
        headers: {
          'Authorization': `Bearer ${provider.api_key}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const services = data.services || data.data || data || [];
        allServices = [...allServices, ...services.map((s: any) => ({
          ...s,
          _provider: provider.name,
          _providerId: provider.id,
        }))];
      }
    } catch (e) {
      console.error(`Failed to fetch from ${provider.name}:`, e);
    }
  }

  return allServices;
}

// API'ye sipariş gönder
export async function placeApiOrder(
  providerId: string,
  serviceId: string, 
  link: string, 
  quantity: number
): Promise<{ success: boolean; order_id?: string; error?: string }> {
  try {
    // Provider bilgisini al
    const { data: provider } = await supabase
      .from('api_providers')
      .select('*')
      .eq('id', providerId)
      .single();

    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    const response = await fetch(`${provider.url}/order`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        service_id: serviceId, 
        link, 
        quantity 
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || data.message || 'API order failed' };
    }

    return { 
      success: true, 
      order_id: data.order_id || data.id || data.order 
    };
  } catch (error: any) {
    console.error('API order error:', error);
    return { success: false, error: error.message || 'Network error' };
  }
}
