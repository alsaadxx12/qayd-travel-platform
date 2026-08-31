import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { useAiPageContext } from '../hooks/useAiPageContext';
import { Plus, ArrowUpRight, Printer } from 'lucide-react';
import { VoucherPrintModal, type VoucherPrintItem } from '../components/vouchers/VoucherPrintModal';

export const PaymentVouchersPage: React.FC = () => {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cashboxesAndBanks, setCashboxesAndBanks] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [openModal, setOpenModal] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);

  useAiPageContext({
    route: '/payment-vouchers',
    entity: selectedVoucher ? 'voucher' : undefined,
    recordId: selectedVoucher?.id,
    label: selectedVoucher?.voucherNumber,
  });

  // Form State
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cashboxOrBankAccountId, setCashboxOrBankAccountId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const vData = await apiRequest('/api/payment-vouchers');
      const aData = await apiRequest('/api/accounts');
      const sData = await apiRequest('/api/partners/suppliers');

      setVouchers(vData);
      setAccounts(aData.filter((a: any) => !a.isParent));
      setSuppliers(sData);

      const cbAccounts = aData.filter((a: any) => a.category === 'CASH' || a.category === 'BANK');
      setCashboxesAndBanks(cbAccounts);
      if (cbAccounts.length > 0) setCashboxOrBankAccountId(cbAccounts[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await apiRequest('/api/payment-vouchers', {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(amount),
          accountId,
          cashboxOrBankAccountId,
          supplierId: supplierId || undefined,
          reference,
          description,
        }),
      });

      setOpenModal(false);
      setAmount('');
      setDescription('');
      setReference('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'فشل إنشاء سند الدفع');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-md border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
            <span>سندات الدفع (Payment Vouchers)</span>
          </h2>
          <p className="text-xs text-slate-500">صرف مبالغ مالية إلى الموردين وشركات الطيران وتحديث الأرصدة تلقائياً</p>
        </div>

        <button
          onClick={() => setOpenModal(true)}
          className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded text-xs font-semibold cursor-pointer shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>إصدار سند دفع جديد</span>
        </button>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white rounded-md border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-500">جاري تحميل سندات الدفع...</div>
        ) : (
          <table className="accounting-table">
            <thead>
              <tr>
                <th>رقم السند</th>
                <th>التاريخ</th>
                <th>المبلغ (SAR)</th>
                <th>إلى حساب (مدين)</th>
                <th>صرف من (دائن)</th>
                <th>البيان والتفاصيل</th>
                <th>المرجع</th>
                <th>المستخدم</th>
                <th>الطباعة</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id}>
                  <td className="font-mono text-rose-700 font-bold">{v.voucherNumber}</td>
                  <td className="text-[11px] text-slate-600">{new Date(v.date).toLocaleDateString('ar-SA')}</td>
                  <td className="font-mono text-xs font-bold text-rose-700">
                    {Number(v.amount).toLocaleString()} SAR
                  </td>
                  <td>
                    <span className="font-semibold text-slate-800">{v.account?.nameAr || '-'}</span>
                  </td>
                  <td>
                    {cashboxesAndBanks.find((cb) => cb.id === v.cashboxOrBankAccountId)?.nameAr || 'الصندوق/البنك'}
                  </td>
                  <td className="truncate max-w-xs">{v.description}</td>
                  <td className="font-mono text-xs text-slate-500">{v.reference || '-'}</td>
                  <td className="text-xs text-slate-600">{v.createdBy?.name || '-'}</td>
                  <td>
                    <button
                      onClick={() => setSelectedVoucher(v)}
                      className="p-1 hover:bg-slate-100 text-slate-600 rounded cursor-pointer flex items-center gap-1 text-[11px]"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>معاينة وطباعة</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Voucher Modal */}
      {openModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="bg-rose-700 px-4 py-3 text-white flex justify-between items-center">
              <h3 className="text-xs font-bold flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-rose-200" />
                <span>إصدار سند دفع نقد/تحويل إلى مورد أو شركة طيران</span>
              </h3>
              <button onClick={() => setOpenModal(false)} className="text-rose-100 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="p-4 space-y-3">
              {error && <div className="p-2 bg-red-50 text-red-700 border border-red-200 rounded text-xs">{error}</div>}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الحساب المستفيد / المورد / شركة الطيران (مدين)</label>
                <select
                  required
                  value={accountId}
                  onChange={(e) => {
                    setAccountId(e.target.value);
                    const supp = suppliers.find((s) => s.accountId === e.target.value);
                    if (supp) setSupplierId(supp.id);
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs"
                >
                  <option value="">-- اختر حساب المورد أو شركة الطيران --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.nameAr} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">صرف من حساب الصندوق أو البنك (دائن)</label>
                <select
                  required
                  value={cashboxOrBankAccountId}
                  onChange={(e) => setCashboxOrBankAccountId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-rose-800"
                >
                  {cashboxesAndBanks.map((cb) => (
                    <option key={cb.id} value={cb.id}>
                      {cb.code} - {cb.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ المدفوع (SAR)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold text-rose-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الحوالة / الشيك</label>
                  <input
                    type="text"
                    placeholder="TR-90021"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">البيان والتفاصيل</label>
                <input
                  type="text"
                  required
                  placeholder="سداد مستحقات تذاكر الخطوط السعودية لشهر يناير..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                >
                  {submitting ? 'جاري التأكيد...' : 'تأكيد وحفظ سند الدفع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modern Voucher Print & Export Modal ── */}
      <VoucherPrintModal
        opened={!!selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
        voucher={
          selectedVoucher
            ? {
                voucherNumber: selectedVoucher.voucherNumber,
                type: 'PAYMENT',
                date: selectedVoucher.date,
                amount: selectedVoucher.amount,
                currency: 'IQD',
                accountName: selectedVoucher.account?.nameAr || selectedVoucher.accountName || 'حساب المستفيد',
                accountId: selectedVoucher.accountId || selectedVoucher.account?.id,
                accountEmail: selectedVoucher.account?.email || selectedVoucher.email || selectedVoucher.supplier?.email,
                cashboxName: cashboxesAndBanks.find((cb) => cb.id === selectedVoucher.cashboxOrBankAccountId)?.nameAr,
                reference: selectedVoucher.reference,
                description: selectedVoucher.description,
                user: selectedVoucher.createdBy?.name,
              }
            : null
        }
      />
    </div>
  );
};
