import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { submitClaim, getDropdownOptions, getCurrentBalance, ProjectCodeOption } from '@/lib/claims-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CalendarDays,
  CircleAlert,
  ListChecks,
  Loader2,
  PlusCircle,
  Receipt,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import FileUpload, { FileUploadHandle } from '@/components/views/FileUpload';
import RupeeIcon from '@/components/icons/RupeeIcon';

interface ExpenseRow {
  id: string;
  category: string;
  projectCode: string;
  claimDate: string;
  description: string;
  amountWithBill: number;
  amountWithoutBill: number;
}

function emptyExpenseRow(): ExpenseRow {
  return {
    id: crypto.randomUUID(),
    category: '',
    projectCode: '',
    claimDate: '',
    description: '',
    amountWithBill: 0,
    amountWithoutBill: 0,
  };
}

function parseAmountInput(value: string) {
  const normalized = value.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDraftSavedAt(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SubmitClaimView() {
  const { user } = useAuth();
  const fileUploadRef = useRef<FileUploadHandle>(null);
  const previousSiteRef = useRef<string | null>(null);
  const [site, setSite] = useState('');
  const [expenses, setExpenses] = useState<ExpenseRow[]>([emptyExpenseRow()]);
  const [loading, setLoading] = useState(false);
  const [dropdown, setDropdown] = useState<any>({ projects: [], categories: [], projectCodes: [], byProject: {} });
  const [tempClaimId, setTempClaimId] = useState(() => `C-${Date.now()}`);
  const [balance, setBalance] = useState<number | null>(null);
  const [fileUploadKey, setFileUploadKey] = useState(0);
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [fileUploadBusy, setFileUploadBusy] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const draftStorageKey = user ? `claimDraft:${user.email.toLowerCase()}` : '';

  useEffect(() => {
    getDropdownOptions().then(setDropdown);
    if (user) getCurrentBalance(user.email).then(setBalance);
  }, [user]);

  useEffect(() => {
    if (!draftStorageKey || typeof window === 'undefined') {
      setDraftRestored(false);
      setDraftSavedAt(null);
      return;
    }

    const savedDraft = window.sessionStorage.getItem(draftStorageKey);
    if (!savedDraft) {
      setDraftRestored(false);
      setDraftSavedAt(null);
      return;
    }

    try {
      const parsedDraft = JSON.parse(savedDraft) as {
        site?: string;
        tempClaimId?: string;
        updatedAt?: string;
        expenses?: Array<Partial<ExpenseRow>>;
      };

      const draftExpenses = Array.isArray(parsedDraft.expenses) && parsedDraft.expenses.length > 0
        ? parsedDraft.expenses.map((expense) => ({
            ...emptyExpenseRow(),
            ...expense,
            id: expense.id || crypto.randomUUID(),
            amountWithBill: parseAmountInput(String(expense.amountWithBill ?? 0)),
            amountWithoutBill: parseAmountInput(String(expense.amountWithoutBill ?? 0)),
          }))
        : [emptyExpenseRow()];

      setSite(parsedDraft.site || '');
      setTempClaimId(parsedDraft.tempClaimId || `C-${Date.now()}`);
      setExpenses(draftExpenses);
      setDraftRestored(true);
      setDraftSavedAt(parsedDraft.updatedAt || null);
      toast.success('Draft restored from this browser session.');
    } catch {
      window.sessionStorage.removeItem(draftStorageKey);
      setDraftRestored(false);
      setDraftSavedAt(null);
    }
  }, [draftStorageKey]);

  const getFilteredProjectCodes = (category: string) => {
    if (!site || !category) return [];

    const matchingCategory = category.trim().toLowerCase();
    const scopedCodes = [...(dropdown.byProject?.[site] || []), ...(dropdown.byProject?.[''] || [])] as ProjectCodeOption[];
    const unique = new Map<string, ProjectCodeOption>();

    scopedCodes.forEach((code) => {
      const isAllowed = code.allowsAllCategories
        || code.expenseCategories.some((item) => item.trim().toLowerCase() === matchingCategory);

      if (isAllowed) {
        unique.set(`${code.project}|${code.code}`, code);
      }
    });

    return [...unique.values()];
  };

  const addRow = () => {
    setExpenses((prev) => [...prev, emptyExpenseRow()]);
  };

  const removeRow = (id: string) => {
    if (expenses.length <= 1) return;
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
  };

  const updateRow = (id: string, field: keyof ExpenseRow, value: string | number) => {
    setExpenses((prev) => prev.map((expense) => {
      if (expense.id !== id) return expense;

      const nextExpense = { ...expense, [field]: value };
      if (field === 'category') {
        const availableCodes = getFilteredProjectCodes(String(value));
        const isCurrentCodeValid = availableCodes.some((code) => code.code === expense.projectCode);
        if (!isCurrentCodeValid) nextExpense.projectCode = '';
      }

      return nextExpense;
    }));
  };

  const totalWithBill = expenses.reduce((sum, expense) => sum + (expense.amountWithBill || 0), 0);
  const totalWithoutBill = expenses.reduce((sum, expense) => sum + (expense.amountWithoutBill || 0), 0);
  const grandTotal = totalWithBill + totalWithoutBill;
  const nextBalance = balance != null ? balance - grandTotal : null;
  const requiresBillUpload = expenses.some((expense) => expense.amountWithBill > 0);
  const hasUploadFiles = selectedFileCount > 0;
  const allRowsComplete = expenses.every((expense) =>
    expense.category && expense.projectCode && ((expense.amountWithBill || 0) + (expense.amountWithoutBill || 0) > 0),
  );

  useEffect(() => {
    if (previousSiteRef.current == null) {
      previousSiteRef.current = site;
      return;
    }

    if (previousSiteRef.current !== site) {
      setExpenses((prev) => prev.map((expense) => ({ ...expense, projectCode: '' })));
      previousSiteRef.current = site;
    }
  }, [site]);

  const hasDraftContent = Boolean(site) || expenses.some((expense) =>
    expense.category
    || expense.projectCode
    || expense.claimDate
    || expense.description
    || expense.amountWithBill > 0
    || expense.amountWithoutBill > 0
  );

  const saveDraft = (showToast = false) => {
    if (!draftStorageKey || typeof window === 'undefined') return;

    if (!hasDraftContent) {
      window.sessionStorage.removeItem(draftStorageKey);
      setDraftRestored(false);
      setDraftSavedAt(null);
      return;
    }

    const updatedAt = new Date().toISOString();
    window.sessionStorage.setItem(draftStorageKey, JSON.stringify({
      site,
      tempClaimId,
      updatedAt,
      expenses,
    }));
    setDraftRestored(true);
    setDraftSavedAt(updatedAt);

    if (showToast) {
      toast.success('Draft saved for this browser session.');
    }
  };

  const clearDraft = (showToast = true) => {
    if (draftStorageKey && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(draftStorageKey);
    }
    setDraftRestored(false);
    setDraftSavedAt(null);

    if (showToast) {
      toast.success('Draft cleared.');
    }
  };

  useEffect(() => {
    if (!draftStorageKey || typeof window === 'undefined') return;

    if (!hasDraftContent) {
      clearDraft(false);
      return;
    }

    const timeoutId = window.setTimeout(() => saveDraft(false), 500);
    return () => window.clearTimeout(timeoutId);
  }, [draftStorageKey, hasDraftContent, site, expenses, tempClaimId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!site) {
      toast.error('Please select a project site.');
      return;
    }

    if (!allRowsComplete) {
      toast.error('Every row needs a category, a matching cost code, and an amount.');
      return;
    }

    if (fileUploadBusy) {
      toast.error('Please wait while your attachments finish preparing.');
      return;
    }

    setLoading(true);
    try {
      let uploadedPaths: string[] = [];
      if (fileUploadRef.current) {
        uploadedPaths = await fileUploadRef.current.uploadAll();
      }

      if (requiresBillUpload && uploadedPaths.length === 0) {
        throw new Error('Please upload bill attachments before submitting this claim.');
      }

      const result = await submitClaim({
        site,
        expenses: expenses.map((expense) => ({
          category: expense.category,
          projectCode: expense.projectCode,
          claimDate: expense.claimDate,
          description: expense.description,
          amountWithBill: expense.amountWithBill || 0,
          amountWithoutBill: expense.amountWithoutBill || 0,
        })),
        fileIds: uploadedPaths,
      }, user!.email, user!.name);

      if (result.ok) {
        toast.success(result.message);
        clearDraft(false);
        setSite('');
        setExpenses([emptyExpenseRow()]);
        setTempClaimId(`C-${Date.now()}`);
        setFileUploadKey((prev) => prev + 1);
        setSelectedFileCount(0);
        if (user) getCurrentBalance(user.email).then(setBalance);
      }
    } catch (err: any) {
      toast.error(err.message || 'Submission failed.');
    }
    setLoading(false);
  };

  return (
    <div className="page-shell animate-in fade-in slide-in-from-bottom-4 space-y-5 duration-500 pb-20 md:pb-0">
      <section className="page-hero">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Receipt className="h-3.5 w-3.5" />
              Claim workspace
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Submit claim</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Add your expense lines, attach receipts, and send one clean submission.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <div className="rounded-2xl border border-border/70 bg-card/85 px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Project site</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{site || 'Select to begin'}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/85 px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Expense rows</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{expenses.length}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/85 px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Grand total</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(grandTotal)}</p>
              </div>
            </div>
          </div>

          {balance !== null ? (
            <div className="rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm lg:min-w-[300px]">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <RupeeIcon className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Available balance</p>
                  <p className="text-3xl font-bold tracking-tight text-foreground">{formatCurrency(balance)}</p>
                  <p className="text-sm text-muted-foreground">This updates after approved transactions and claim activity.</p>
                </div>
              </div>

              {grandTotal > 0 ? (
                <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Projected balance after submission</p>
                  <p className={`mt-1 text-xl font-semibold ${nextBalance != null && nextBalance < 0 ? 'text-destructive' : 'text-success'}`}>
                    {nextBalance != null ? formatCurrency(nextBalance) : '-'}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      <form onSubmit={handleSubmit}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          <div className="space-y-5">
            <section className="panel-card space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">Claim details</h3>
                  <p className="text-sm text-muted-foreground">Choose the site and keep the draft tidy.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    Draft ID {tempClaimId}
                  </div>
                  <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => saveDraft(true)}>
                    <Save className="mr-2 h-4 w-4" />
                    Save draft
                  </Button>
                  {draftRestored ? (
                    <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => clearDraft(true)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Clear draft
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-2.5">
                <p className="text-sm font-medium text-foreground">
                  {draftRestored ? 'Draft saved in this browser session.' : 'Draft autosaves in this browser session.'}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {draftSavedAt ? `Last saved: ${formatDraftSavedAt(draftSavedAt)}.` : 'Your expense lines and project selection are kept until this tab session ends.'} Re-attach receipts if you refresh before submitting.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={user?.name || ''} readOnly className="h-11 rounded-xl bg-muted/40" />
                </div>
                <div className="space-y-2">
                  <Label>Project Site</Label>
                  <Select value={site} onValueChange={setSite}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select project site" />
                    </SelectTrigger>
                    <SelectContent>
                      {dropdown.projects.map((project: any) => (
                        <SelectItem key={project.name} value={project.name}>
                          {project.name} {project.code ? `(${project.code})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="panel-card space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">Expense lines</h3>
                  <p className="text-sm text-muted-foreground">Add one row per expense item. Codes adapt to the site and category you choose.</p>
                </div>
                <Button type="button" variant="outline" className="rounded-xl" onClick={addRow}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add expense row
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="soft-panel px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">With bill total</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(totalWithBill)}</p>
                </div>
                <div className="soft-panel px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Without bill total</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(totalWithoutBill)}</p>
                </div>
                <div className="soft-panel px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Line items</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{expenses.length}</p>
                </div>
              </div>

              <div className="space-y-4 md:hidden">
                {expenses.map((expense, idx) => {
                  const filteredCodes = getFilteredProjectCodes(expense.category);
                  const subtotal = (expense.amountWithBill || 0) + (expense.amountWithoutBill || 0);

                  return (
                    <div key={expense.id} className="rounded-[24px] border border-border/80 bg-card/80 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Expense #{idx + 1}</p>
                          <p className="text-xs text-muted-foreground">Fill the required fields for this item.</p>
                        </div>
                        {expenses.length > 1 ? (
                          <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeRow(expense.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Category</Label>
                          <Select value={expense.category} onValueChange={(value) => updateRow(expense.id, 'category', value)}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {dropdown.categories.map((category: string) => (
                                <SelectItem key={category} value={category}>{category}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Expense Date</Label>
                          <Input type="date" className="rounded-xl" value={expense.claimDate} onChange={(e) => updateRow(expense.id, 'claimDate', e.target.value)} />
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <Label className="text-xs">Project Code</Label>
                        <Select
                          value={expense.projectCode}
                          onValueChange={(value) => updateRow(expense.id, 'projectCode', value)}
                          disabled={!site || !expense.category}
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder={!site ? 'Select site first' : !expense.category ? 'Select category first' : 'Select code'} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredCodes.length === 0 ? (
                              <SelectItem value="none" disabled>No matching cost codes</SelectItem>
                            ) : filteredCodes.map((code) => (
                              <SelectItem key={`${code.project}-${code.code}`} value={code.code}>{code.code} - {code.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs leading-5 text-muted-foreground">Only codes valid for the selected site and category appear here.</p>
                      </div>

                      <div className="mt-3 space-y-2">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={expense.description}
                          onChange={(e) => updateRow(expense.id, 'description', e.target.value)}
                          placeholder="Enter description"
                          className="rounded-xl"
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">With Bill (Rs.)</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*[.]?[0-9]*"
                            value={expense.amountWithBill || ''}
                            onChange={(e) => updateRow(expense.id, 'amountWithBill', parseAmountInput(e.target.value))}
                            placeholder="0.00"
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Without Bill (Rs.)</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*[.]?[0-9]*"
                            value={expense.amountWithoutBill || ''}
                            onChange={(e) => updateRow(expense.id, 'amountWithoutBill', parseAmountInput(e.target.value))}
                            placeholder="0.00"
                            className="rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between rounded-2xl bg-muted/25 px-4 py-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Subtotal</p>
                          <p className="text-xs text-muted-foreground">This row only</p>
                        </div>
                        <p className="text-xl font-semibold text-primary">{formatCurrency(subtotal)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-hidden rounded-[24px] border border-border/80 md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-[1080px] w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">#</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Category</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Project Code</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Date</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Description</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">With Bill</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Without Bill</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70 bg-card/90">
                      {expenses.map((expense, idx) => {
                        const filteredCodes = getFilteredProjectCodes(expense.category);
                        const subtotal = (expense.amountWithBill || 0) + (expense.amountWithoutBill || 0);

                        return (
                          <tr key={expense.id} className="align-top transition-colors hover:bg-muted/20">
                            <td className="px-3 py-3 font-medium text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-3">
                              <Select value={expense.category} onValueChange={(value) => updateRow(expense.id, 'category', value)}>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Category" /></SelectTrigger>
                                <SelectContent>
                                  {dropdown.categories.map((category: string) => (
                                    <SelectItem key={category} value={category}>{category}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-3 py-3">
                              <Select
                                value={expense.projectCode}
                                onValueChange={(value) => updateRow(expense.id, 'projectCode', value)}
                                disabled={!site || !expense.category}
                              >
                                <SelectTrigger className="h-11 rounded-xl">
                                  <SelectValue placeholder={!site ? 'Site first' : !expense.category ? 'Category first' : 'Code'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {filteredCodes.length === 0 ? (
                                    <SelectItem value="none" disabled>No matching cost codes</SelectItem>
                                  ) : filteredCodes.map((code) => (
                                    <SelectItem key={`${code.project}-${code.code}`} value={code.code}>{code.code} - {code.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-3 py-3">
                              <Input type="date" className="h-11 rounded-xl" value={expense.claimDate} onChange={(e) => updateRow(expense.id, 'claimDate', e.target.value)} />
                            </td>
                            <td className="px-3 py-3">
                              <Input
                                className="h-11 rounded-xl"
                                value={expense.description}
                                onChange={(e) => updateRow(expense.id, 'description', e.target.value)}
                                placeholder="Description"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <Input
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*[.]?[0-9]*"
                                className="h-11 rounded-xl text-right"
                                value={expense.amountWithBill || ''}
                                onChange={(e) => updateRow(expense.id, 'amountWithBill', parseAmountInput(e.target.value))}
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <Input
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*[.]?[0-9]*"
                                className="h-11 rounded-xl text-right"
                                value={expense.amountWithoutBill || ''}
                                onChange={(e) => updateRow(expense.id, 'amountWithoutBill', parseAmountInput(e.target.value))}
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-3 py-3 text-right font-semibold text-foreground">{formatCurrency(subtotal)}</td>
                            <td className="px-3 py-3 text-center">
                              {expenses.length > 1 ? (
                                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={() => removeRow(expense.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Totals</td>
                        <td className="px-3 py-3 text-right font-semibold text-foreground">{formatCurrency(totalWithBill)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-foreground">{formatCurrency(totalWithoutBill)}</td>
                        <td className="px-3 py-3 text-right text-base font-bold text-primary">{formatCurrency(grandTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </section>

            <section className="panel-card space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Claim attachments</h3>
                  <p className="text-sm text-muted-foreground">Upload bills and supporting files in a cleaner, wider layout.</p>
                </div>
              </div>

              <FileUpload
                ref={fileUploadRef}
                key={fileUploadKey}
                claimId={tempClaimId}
                onFileCountChange={setSelectedFileCount}
                onBusyChange={setFileUploadBusy}
                maxFiles={10}
                maxSizeMB={5}
              />

              <p className="text-xs leading-5 text-muted-foreground">
                Camera uploads open the mobile camera when supported. Large images are compressed before upload to keep the files lighter without a noticeable quality drop.
              </p>
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24">
            <section className="panel-card space-y-4">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">Claim summary</h3>
                <p className="text-sm text-muted-foreground">Review totals and submission readiness before you send this claim.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                  <span className="text-sm text-muted-foreground">With Bill</span>
                  <span className="font-semibold text-foreground">{formatCurrency(totalWithBill)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Without Bill</span>
                  <span className="font-semibold text-foreground">{formatCurrency(totalWithoutBill)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4">
                  <span className="text-sm font-medium text-primary">Grand Total</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-muted/15 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Submission readiness</p>
                      <p className="text-xs leading-5 text-muted-foreground">A quick check before sending the claim forward.</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">Project site selected</span>
                        <span className={site ? 'font-semibold text-success' : 'font-semibold text-muted-foreground'}>{site ? 'Ready' : 'Pending'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">All rows completed</span>
                        <span className={allRowsComplete ? 'font-semibold text-success' : 'font-semibold text-muted-foreground'}>
                          {allRowsComplete ? 'Ready' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">Receipt upload requirement</span>
                        <span className={fileUploadBusy ? 'font-semibold text-warning' : requiresBillUpload && !hasUploadFiles ? 'font-semibold text-warning' : 'font-semibold text-success'}>
                          {fileUploadBusy ? 'Preparing files' : requiresBillUpload && !hasUploadFiles ? 'Upload needed' : 'Ready'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {nextBalance != null ? (
                <div className={`rounded-[24px] border px-4 py-4 ${nextBalance < 0 ? 'border-destructive/30 bg-destructive/5' : 'border-success/25 bg-success/5'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${nextBalance < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                      <CircleAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">After this claim</p>
                      <p className={`mt-1 text-xl font-bold ${nextBalance < 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(nextBalance)}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">This is a projected balance based on the current claim total.</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <Button type="submit" className="h-12 w-full rounded-2xl gradient-primary text-base text-primary-foreground shadow-lg shadow-primary/20" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {loading ? 'Submitting claim...' : 'Submit Claim'}
            </Button>
          </aside>
        </div>
      </form>
    </div>
  );
}
