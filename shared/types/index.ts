export interface User {
  id: string;
  role: 'customer' | 'pharmacist' | 'delivery_agent' | 'admin';
  full_name: string;
  phone: string;
}

export interface Medicine {
  id: string;
  brand_name: string;
  generic_name: string;
  category: 'otc' | 'prescription' | 'restricted';
  avg_price: number;
}
