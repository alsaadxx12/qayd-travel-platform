import React, { useState } from 'react';
import {
  Modal,
  Button,
  Badge,
  Tooltip,
} from '@mantine/core';
import {
  AlertTriangle,
  Sparkles,
  Check,
  UserPlus,
  Building2,
  User,
  ArrowRight,
  Plus,
  Search,
  ExternalLink,
  ShieldCheck,
  Layers,
  ChevronLeft,
} from 'lucide-react';
import { SimilarAccountMatch } from '../../utils/accountSimilarity';
import { useLanguageStore } from '../../store/useLanguageStore';
import { partnersApi } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

export interface UnmatchedPartyData {
  rawName: string;
  similarAccounts: SimilarAccountMatch[];
}

export interface AccountReconciliationModalProps {
  opened: boolean;
  onClose: () => void;
  unmatchedCustomer?: UnmatchedPartyData | null;
  unmatchedSupplier?: UnmatchedPartyData | null;
  onApplyMatches: (results: {
    customer?: { id?: string; name: string; isNew?: boolean; accountCode?: string };
    supplier?: { id?: string; name: string; isNew?: boolean; accountCode?: string };
  }) => void;
  onOpenCreateWizard?: (type: 'CUSTOMER' | 'SUPPLIER', initialName: string) => void;
}

export const AccountReconciliationModal: React.FC<AccountReconciliationModalProps> = ({
  opened,
  onClose,
  unmatchedCustomer,
  unmatchedSupplier,
  onApplyMatches,
  onOpenCreateWizard,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  // Selected existing matched account IDs
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  // States when user creates new accounts directly from this modal
  const [createdCustomer, setCreatedCustomer] = useState<{ id: string; name: string; code?: string } | null>(null);
  const [createdSupplier, setCreatedSupplier] = useState<{ id: string; name: string; code?: string } | null>(null);

  const [isCreatingCustomer, setIsCreatingCustomer] = useState<boolean>(false);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState<boolean>(false);

  const hasCustomer = Boolean(unmatchedCustomer && unmatchedCustomer.rawName.trim());
  const hasSupplier = Boolean(unmatchedSupplier && unmatchedSupplier.rawName.trim());

  // Handle fast creation of customer account in database
  const handleFastCreateCustomer = async () => {
    if (!unmatchedCustomer?.rawName) return;
    setIsCreatingCustomer(true);
    try {
      const name = unmatchedCustomer.rawName.trim();
      const code = `141${Date.now().toString().slice(-4)}`;
      const res = await partnersApi.createCustomer({
        code,
        nameAr: name,
        nameEn: name,
      });

      const customerId = (res as any)?.id || (res as any)?.data?.id || `cust-${Date.now()}`;
      setCreatedCustomer({
        id: customerId,
        name,
        code,
      });
      setSelectedCustomerId(customerId);
      showSuccessNotification(
        isAr ? 'تم فتح حساب العميل بنجاح' : 'Customer Account Created',
        isAr ? `تم إنشاء حساب جديد للعميل (${name}) برقم دليل ${code}` : `Created new customer account: ${name}`
      );
    } catch (err) {
      console.error('Failed to auto-create customer:', err);
      // Fallback create through accounts API
      try {
        const name = unmatchedCustomer.rawName.trim();
        const code = `141${Date.now().toString().slice(-4)}`;
        const accRes = await accountsApi.create({
          code,
          nameAr: name,
          nameEn: name,
          type: 'ASSET',
          category: 'RECEIVABLE',
        });
        const accId = accRes?.id || `cust-${Date.now()}`;
        setCreatedCustomer({ id: accId, name, code });
        setSelectedCustomerId(accId);
        showSuccessNotification(
          isAr ? 'تم فتح حساب العميل' : 'Customer Account Created',
          isAr ? `تم إنشاء الحساب (${name}) بالدليل المحاسبي.` : `Created customer account: ${name}`
        );
      } catch (err2) {
        showErrorNotification(
          isAr ? 'فشل إنشاء الحساب تلقائياً' : 'Creation Failed',
          isAr ? 'يرجى فتح الحساب عبر معالج شجرة الحسابات.' : 'Please create account using the wizard.'
        );
      }
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  // Handle fast creation of supplier account in database
  const handleFastCreateSupplier = async () => {
    if (!unmatchedSupplier?.rawName) return;
    setIsCreatingSupplier(true);
    try {
      const name = unmatchedSupplier.rawName.trim();
      const code = `231${Date.now().toString().slice(-4)}`;
      const res = await partnersApi.createSupplier({
        code,
        nameAr: name,
        nameEn: name,
      });

      const supplierId = (res as any)?.id || (res as any)?.data?.id || `supp-${Date.now()}`;
      setCreatedSupplier({
        id: supplierId,
        name,
        code,
      });
      setSelectedSupplierId(supplierId);
      showSuccessNotification(
        isAr ? 'تم فتح حساب المورد بنجاح' : 'Supplier Account Created',
        isAr ? `تم إنشاء حساب جديد للمورد (${name}) برقم دليل ${code}` : `Created new supplier account: ${name}`
      );
    } catch (err) {
      console.error('Failed to auto-create supplier:', err);
      try {
        const name = unmatchedSupplier.rawName.trim();
        const code = `231${Date.now().toString().slice(-4)}`;
        const accRes = await accountsApi.create({
          code,
          nameAr: name,
          nameEn: name,
          type: 'LIABILITY',
          category: 'PAYABLE',
        });
        const accId = accRes?.id || `supp-${Date.now()}`;
        setCreatedSupplier({ id: accId, name, code });
        setSelectedSupplierId(accId);
        showSuccessNotification(
          isAr ? 'تم فتح حساب المورد' : 'Supplier Account Created',
          isAr ? `تم إنشاء الحساب (${name}) بالدليل المحاسبي.` : `Created supplier account: ${name}`
        );
      } catch (err2) {
        showErrorNotification(
          isAr ? 'فشل إنشاء الحساب تلقائياً' : 'Creation Failed',
          isAr ? 'يرجى فتح الحساب عبر معالج شجرة الحسابات.' : 'Please create account using the wizard.'
        );
      }
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  // Confirm and apply resolutions
  const handleConfirmResolutions = () => {
    const results: any = {};

    if (hasCustomer) {
      if (createdCustomer && selectedCustomerId === createdCustomer.id) {
        results.customer = {
          id: createdCustomer.id,
          name: createdCustomer.name,
          isNew: true,
          accountCode: createdCustomer.code,
        };
      } else if (selectedCustomerId) {
        const matched = unmatchedCustomer?.similarAccounts.find((m) => m.account.id === selectedCustomerId);
        if (matched) {
          results.customer = {
            id: matched.account.id,
            name: matched.account.nameAr || matched.account.name || matched.account.nameEn || '',
            accountCode: matched.account.code,
          };
        }
      } else {
        // Keep raw custom name as non-registered text
        results.customer = {
          name: unmatchedCustomer?.rawName || '',
        };
      }
    }

    if (hasSupplier) {
      if (createdSupplier && selectedSupplierId === createdSupplier.id) {
        results.supplier = {
          id: createdSupplier.id,
          name: createdSupplier.name,
          isNew: true,
          accountCode: createdSupplier.code,
        };
      } else if (selectedSupplierId) {
        const matched = unmatchedSupplier?.similarAccounts.find((m) => m.account.id === selectedSupplierId);
        if (matched) {
          results.supplier = {
            id: matched.account.id,
            name: matched.account.nameAr || matched.account.name || matched.account.nameEn || '',
            accountCode: matched.account.code,
          };
        }
      } else {
        results.supplier = {
          name: unmatchedSupplier?.rawName || '',
        };
      }
    }

    onApplyMatches(results);
    onClose();
  };

  // Continue without creating (keep raw strings)
  const handleSkipAndContinue = () => {
    const results: any = {};
    if (hasCustomer) results.customer = { name: unmatchedCustomer?.rawName || '' };
    if (hasSupplier) results.supplier = { name: unmatchedSupplier?.rawName || '' };
    onApplyMatches(results);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="820px"
      radius="20px"
      centered
      dir={direction}
      padding="xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-black shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-950 leading-tight">
              {hasCustomer && hasSupplier
                ? (isAr ? 'تنبيه: العميل والمورد غير مسجلين تماماً في الدليل' : 'Notice: Customer & Supplier Unmatched')
                : hasCustomer
                ? (isAr ? `تنبيه: العميل «${unmatchedCustomer?.rawName}» غير مسجل تماماً` : `Notice: Customer "${unmatchedCustomer?.rawName}" Unmatched`)
                : (isAr ? `تنبيه: المورد «${unmatchedSupplier?.rawName}» غير مسجل تماماً` : `Notice: Supplier "${unmatchedSupplier?.rawName}" Unmatched`)}
            </h3>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {isAr
                ? 'تم فحص الدليل المحاسبي وعرض الحسابات المشابهة للتسمية لتفادي تكرار الحسابات أو إمكانية فتح حسابات جديدة فوراً.'
                : 'Checked chart of accounts. Review similar existing accounts to prevent duplicates or create new accounts.'}
            </p>
          </div>
        </div>
      }
      styles={{
        header: {
          borderBottom: '1px solid #E2E8F0',
          paddingBottom: '16px',
          marginBottom: '16px',
        },
      }}
    >
      <div className="space-y-6 text-xs font-sans">
        
        {/* ── 1. CUSTOMER SECTION ── */}
        {hasCustomer && (
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-orange-100 text-[#F45A0A] flex items-center justify-center font-bold">
                  <User size={15} />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block">
                    {isAr ? 'العميل المنسوخ من البيانات:' : 'Pasted Customer Name:'}
                  </span>
                  <span className="text-sm font-black text-slate-950 font-mono">
                    «{unmatchedCustomer?.rawName}»
                  </span>
                </div>
              </div>

              {createdCustomer ? (
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                  <Check size={14} />
                  <span>{isAr ? `تم فتح الحساب: (${createdCustomer.code})` : `Account Created: ${createdCustomer.code}`}</span>
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    color="orange"
                    variant="light"
                    loading={isCreatingCustomer}
                    onClick={handleFastCreateCustomer}
                    leftSection={<Plus size={14} />}
                    className="font-bold text-xs bg-orange-50 hover:bg-orange-100 text-[#F45A0A] border border-orange-200 rounded-xl cursor-pointer"
                  >
                    {isAr ? `+ فتح حساب عميل جديد باسم «${unmatchedCustomer?.rawName}»` : `+ Create Customer: ${unmatchedCustomer?.rawName}`}
                  </Button>
                </div>
              )}
            </div>

            {/* Similar Accounts Sub-list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Sparkles size={13} className="text-[#F45A0A]" />
                  <span>{isAr ? 'الحسابات المشابهة المكتشفة في شجرة الحسابات:' : 'Similar Accounts Found in Chart:'}</span>
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  {unmatchedCustomer?.similarAccounts.length || 0} {isAr ? 'حساب مطابق جزئياً' : 'matches found'}
                </span>
              </div>

              {unmatchedCustomer?.similarAccounts && unmatchedCustomer.similarAccounts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto date-picker-scroll p-1">
                  {unmatchedCustomer.similarAccounts.map(({ account, score, matchReason }) => {
                    const isSelected = selectedCustomerId === account.id;
                    const cleanName = account.nameAr || account.name || account.nameEn || '';

                    return (
                      <div
                        key={account.id}
                        onClick={() => setSelectedCustomerId(account.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 text-right ${
                          isSelected
                            ? 'bg-orange-50/80 border-[#F45A0A] ring-2 ring-[#F45A0A]/20 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-950 text-xs">
                              {cleanName}
                            </div>
                            <span className="text-[10.5px] text-slate-500 font-mono font-bold">
                              {account.code}
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono shrink-0 ${
                              score >= 85
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {score}% {isAr ? 'تطابق' : 'Match'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                          <span className="text-[10px] text-slate-500 italic">
                            {matchReason}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCustomerId(account.id);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-[#F45A0A] text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isSelected ? <Check size={12} /> : null}
                            <span>{isSelected ? (isAr ? 'تم الاختيار' : 'Selected') : (isAr ? 'اختيار هذا الحساب' : 'Select')}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-white border border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-[11px] font-medium">
                  {isAr ? 'لا توجد حسابات مشابهة لهذا الاسم في الدليل المحاسبي.' : 'No similar accounts found in chart.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 2. SUPPLIER SECTION ── */}
        {hasSupplier && (
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-orange-100 text-[#F45A0A] flex items-center justify-center font-bold">
                  <Building2 size={15} />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block">
                    {isAr ? 'المورد المنسوخ من البيانات:' : 'Pasted Supplier Name:'}
                  </span>
                  <span className="text-sm font-black text-slate-950 font-mono">
                    «{unmatchedSupplier?.rawName}»
                  </span>
                </div>
              </div>

              {createdSupplier ? (
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                  <Check size={14} />
                  <span>{isAr ? `تم فتح الحساب: (${createdSupplier.code})` : `Account Created: ${createdSupplier.code}`}</span>
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    color="orange"
                    variant="light"
                    loading={isCreatingSupplier}
                    onClick={handleFastCreateSupplier}
                    leftSection={<Plus size={14} />}
                    className="font-bold text-xs bg-orange-50 hover:bg-orange-100 text-[#F45A0A] border border-orange-200 rounded-xl cursor-pointer"
                  >
                    {isAr ? `+ فتح حساب مورد جديد باسم «${unmatchedSupplier?.rawName}»` : `+ Create Supplier: ${unmatchedSupplier?.rawName}`}
                  </Button>
                </div>
              )}
            </div>

            {/* Similar Accounts Sub-list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Sparkles size={13} className="text-[#F45A0A]" />
                  <span>{isAr ? 'حسابات الموردين والشركات المشابهة في الدليل:' : 'Similar Supplier Accounts Found:'}</span>
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  {unmatchedSupplier?.similarAccounts.length || 0} {isAr ? 'حساب مطابق جزئياً' : 'matches found'}
                </span>
              </div>

              {unmatchedSupplier?.similarAccounts && unmatchedSupplier.similarAccounts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto date-picker-scroll p-1">
                  {unmatchedSupplier.similarAccounts.map(({ account, score, matchReason }) => {
                    const isSelected = selectedSupplierId === account.id;
                    const cleanName = account.nameAr || account.name || account.nameEn || '';

                    return (
                      <div
                        key={account.id}
                        onClick={() => setSelectedSupplierId(account.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 text-right ${
                          isSelected
                            ? 'bg-orange-50/80 border-[#F45A0A] ring-2 ring-[#F45A0A]/20 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-950 text-xs">
                              {cleanName}
                            </div>
                            <span className="text-[10.5px] text-slate-500 font-mono font-bold">
                              {account.code}
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono shrink-0 ${
                              score >= 85
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {score}% {isAr ? 'تطابق' : 'Match'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                          <span className="text-[10px] text-slate-500 italic">
                            {matchReason}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSupplierId(account.id);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-[#F45A0A] text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isSelected ? <Check size={12} /> : null}
                            <span>{isSelected ? (isAr ? 'تم الاختيار' : 'Selected') : (isAr ? 'اختيار هذا الحساب' : 'Select')}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-white border border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-[11px] font-medium">
                  {isAr ? 'لا توجد حسابات موردين مشابهة لهذا الاسم في الدليل المحاسبي.' : 'No similar supplier accounts found in chart.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 3. MODAL ACTIONS FOOTER ── */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 flex-wrap gap-2.5">
          <Button
            size="sm"
            variant="subtle"
            color="gray"
            onClick={handleSkipAndContinue}
            className="text-slate-600 hover:text-slate-900 font-bold text-xs"
          >
            {isAr ? 'متابعة بدون فتح حسابات (استخدام كاسم نقدي/عام)' : 'Continue without creating (Use as plain names)'}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={onClose}
              className="border-slate-200 text-slate-700 font-bold text-xs rounded-xl"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>

            <Button
              size="sm"
              color="orange"
              variant="filled"
              onClick={handleConfirmResolutions}
              className="bg-[#F45A0A] hover:bg-orange-600 font-bold text-xs text-white rounded-xl shadow-2xs px-5"
            >
              <Check size={15} className="ml-1.5" />
              <span>{isAr ? 'تأكيد واعتماد الاختيارات' : 'Confirm & Apply'}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
