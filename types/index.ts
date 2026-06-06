export type EntryType = 'A' | 'D';

export type ExpenseCategory =
  | 'Rent' | 'Electricity' | 'Salary' | 'Transport'
  | 'Marketing' | 'Supplies' | 'Maintenance' | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Rent','Electricity','Salary','Transport','Marketing','Supplies','Maintenance','Other'
];

export interface Shop {
  id: string; name: string; user_id: string; created_at: string;
}

export interface Entry {
  id: string; shop_id: string;
  invoice_no: string; order_no: string;
  customer_name: string;
  type: EntryType;
  amount: number; advance: number; due: number;
  notes: string; entry_date: string; created_at: string;
}

export interface Expense {
  id: string; shop_id: string;
  category: ExpenseCategory;
  description: string; amount: number;
  entry_date: string; created_at: string;
}

export interface ExtractedEntry {
  invoiceNo: string; orderNo: string; type: EntryType;
  amount: number; advance: number; due: number; notes: string;
  /** 0..1 model confidence for this row (added by smarter scan). */
  confidence?: number;
  customerName?: string;
}
export interface ExtractedExpense { description: string; amount: number; confidence?: number; }
export interface ExtractedData {
  date: string; entries: ExtractedEntry[]; expenses: ExtractedExpense[];
  summary: { grossTotal: number; totalAdvance: number; netBalance: number; prevBalance: number; grandTotal: number; discount: number; };
}
