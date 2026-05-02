import { supabase } from '@/config/supabase';

export interface BusinessRequest {
    id?: string;
    user_id: string;
    business_name: string;
    contact_email: string;
    phone: string;
    address: string;
    category: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at?: string;
}

export const BusinessService = {
    async submitRequest(request: Omit<BusinessRequest, 'id' | 'status' | 'created_at'>) {
        const { data, error } = await supabase
            .from('business_requests')
            .insert({
                ...request,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getMyRequests(userId: string) {
        const { data, error } = await supabase
            .from('business_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as BusinessRequest[];
    }
};
