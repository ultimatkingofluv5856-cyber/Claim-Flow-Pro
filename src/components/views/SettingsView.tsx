import { useState, useEffect } from 'react';
import { getCompanySettings, updateCompanySettings, getAppLists, addAppListItem, deleteAppListItem, getDropdownOptions } from '@/lib/claims-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Settings, Save, Loader2, Plus, Trash2, Building2, List, Bell } from 'lucide-react';
import { toast } from 'sonner';
import ImageUpload from '@/components/ImageUpload';

const emptyNewItem = {
  type: 'category',
  value: '',
  project_code: '',
  project: '',
  allows_all_categories: true,
  expense_categories: [] as string[],
};

export default function SettingsView() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lists, setLists] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState(emptyNewItem);

  const categories = [...new Set(
    lists
      .filter((item) => String(item.type || '').toLowerCase() === 'category')
      .map((item) => String(item.value || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getCompanySettings();
      if (s) setSettings(s);
      const l = await getAppLists();
      setLists(l);
      const dd = await getDropdownOptions();
      setProjects(dd.projects || []);
    } catch (e) {
      console.error('Error loading settings:', e);
      setError((e as any).message || 'Failed to load settings');
    }
    setLoading(false);
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateCompanySettings({
        company_name: settings.company_name,
        company_subtitle: settings.company_subtitle,
        logo_url: settings.logo_url,
        support_email: settings.support_email,
        currency_symbol: settings.currency_symbol,
        address: settings.address,
        phone: settings.phone,
        website: settings.website,
        email_notifications_enabled: settings.email_notifications_enabled,
        app_notifications_enabled: settings.app_notifications_enabled,
        auto_approve_below: parseFloat(settings.auto_approve_below) || 0,
        require_manager_approval: settings.require_manager_approval ?? true,
        approval_note: settings.approval_note || null,
      });
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const handleAddItem = async () => {
    if (!newItem.value.trim()) {
      toast.error('Value required');
      return;
    }
    if (newItem.type === 'project' && !newItem.project_code.trim()) {
      toast.error('Project code is required');
      return;
    }
    if (newItem.type === 'projectcode' && !newItem.project_code.trim()) {
      toast.error('Cost code is required');
      return;
    }
    if (newItem.type === 'projectcode' && !newItem.project) {
      toast.error('Please select a project');
      return;
    }
    if (newItem.type === 'projectcode' && !newItem.allows_all_categories && newItem.expense_categories.length === 0) {
      toast.error('Select at least one expense category or enable all categories');
      return;
    }

    try {
      await addAppListItem({
        type: newItem.type,
        value: newItem.value.trim(),
        project_code: newItem.project_code.trim() || undefined,
        project: newItem.type === 'projectcode' ? newItem.project : undefined,
        allows_all_categories: newItem.type === 'projectcode' ? newItem.allows_all_categories : undefined,
        expense_categories: newItem.type === 'projectcode' && !newItem.allows_all_categories ? newItem.expense_categories : [],
      });
      toast.success('Item added');
      setNewItem(emptyNewItem);
      loadSettings();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      await deleteAppListItem(id);
      toast.success('Item deleted');
      loadSettings();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleExpenseCategory = (category: string, checked: boolean) => {
    setNewItem((prev) => ({
      ...prev,
      expense_categories: checked
        ? [...new Set([...prev.expense_categories, category])].sort((a, b) => a.localeCompare(b))
        : prev.expense_categories.filter((item) => item !== category),
    }));
  };

  if (loading) return <div className="text-center p-8 text-muted-foreground">Loading settings...</div>;

  return (
    <div className="fade-in space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          Error: {error}
        </div>
      )}

      <div className="glass-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Building2 className="h-5 w-5 text-primary" /> Company Settings</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div><Label>Company Name</Label><Input value={settings.company_name || ''} onChange={e => setSettings({ ...settings, company_name: e.target.value })} /></div>
          <div><Label>Subtitle</Label><Input value={settings.company_subtitle || ''} onChange={e => setSettings({ ...settings, company_subtitle: e.target.value })} /></div>
          <div className="md:col-span-2">
            <Label>Company Logo</Label>
            <div className="mt-1">
              <ImageUpload
                bucket="company-assets"
                currentUrl={settings.logo_url || null}
                onUploaded={(url) => setSettings({ ...settings, logo_url: url || null })}
                folder="logos"
                variant="logo"
              />
            </div>
          </div>
          <div><Label>Support Email</Label><Input type="email" value={settings.support_email || ''} onChange={e => setSettings({ ...settings, support_email: e.target.value })} /></div>
          <div><Label>Currency Symbol</Label><Input value={settings.currency_symbol || ''} onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={settings.phone || ''} onChange={e => setSettings({ ...settings, phone: e.target.value })} /></div>
          <div><Label>Website</Label><Input value={settings.website || ''} onChange={e => setSettings({ ...settings, website: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Address</Label><Textarea value={settings.address || ''} onChange={e => setSettings({ ...settings, address: e.target.value })} rows={2} /></div>
        </div>
        <Button className="mt-4 gradient-primary text-primary-foreground" onClick={handleSaveSettings} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </div>

      <div className="glass-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Bell className="h-5 w-5 text-primary" /> Notification Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <p className="font-medium text-foreground">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Send email alerts for claim submissions, approvals, and rejections</p>
            </div>
            <Switch
              checked={settings.email_notifications_enabled ?? true}
              onCheckedChange={v => setSettings({ ...settings, email_notifications_enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <p className="font-medium text-foreground">App Notifications</p>
              <p className="text-sm text-muted-foreground">Show in-app notification alerts for claim status updates</p>
            </div>
            <Switch
              checked={settings.app_notifications_enabled ?? true}
              onCheckedChange={v => setSettings({ ...settings, app_notifications_enabled: v })}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Changes are saved with the "Save Settings" button above.</p>
      </div>

      <div className="glass-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Settings className="h-5 w-5 text-primary" /> Approval Workflow</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <p className="font-medium text-foreground">Require Manager Approval</p>
              <p className="text-sm text-muted-foreground">When enabled, claims go through manager before admin. When disabled, claims go directly to admin.</p>
            </div>
            <Switch
              checked={settings.require_manager_approval ?? true}
              onCheckedChange={v => setSettings({ ...settings, require_manager_approval: v })}
            />
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-2">
              <p className="font-medium text-foreground">Auto-Approve Threshold (Rs.)</p>
              <p className="text-sm text-muted-foreground">Claims below this amount will be auto-approved. Set to 0 to disable.</p>
            </div>
            <Input
              type="number"
              min="0"
              step="100"
              value={settings.auto_approve_below || 0}
              onChange={e => setSettings({ ...settings, auto_approve_below: parseFloat(e.target.value) || 0 })}
              className="max-w-xs"
              placeholder="0"
            />
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-2">
              <p className="font-medium text-foreground">Approval Note / Instructions</p>
              <p className="text-sm text-muted-foreground">Optional note shown to approvers when reviewing claims</p>
            </div>
            <Textarea
              value={settings.approval_note || ''}
              onChange={e => setSettings({ ...settings, approval_note: e.target.value })}
              rows={2}
              placeholder="e.g. Please verify all bills above Rs. 5000"
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Changes are saved with the "Save Settings" button above.</p>
      </div>

      <div className="glass-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><List className="h-5 w-5 text-primary" /> Dropdown Master Data</h2>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Type</Label>
            <Select
              value={newItem.type}
              onValueChange={v => setNewItem({
                ...emptyNewItem,
                type: v,
              })}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="projectcode">Project Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">{newItem.type === 'projectcode' ? 'Code Name' : 'Value'}</Label>
            <Input
              placeholder={newItem.type === 'projectcode' ? 'e.g. Labour, Material...' : newItem.type === 'project' ? 'Project name' : 'Category name'}
              className="w-48"
              value={newItem.value}
              onChange={e => setNewItem({ ...newItem, value: e.target.value })}
            />
          </div>

          {newItem.type === 'project' && (
            <div>
              <Label className="text-xs">Project Code</Label>
              <Input placeholder="Code" className="w-36" value={newItem.project_code} onChange={e => setNewItem({ ...newItem, project_code: e.target.value })} />
            </div>
          )}

          {newItem.type === 'projectcode' && (
            <div className="grid w-full gap-4 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-[minmax(0,180px)_minmax(0,220px)_1fr]">
              <div>
                <Label className="text-xs">Cost Code</Label>
                <Input placeholder="Cost Code" value={newItem.project_code} onChange={e => setNewItem({ ...newItem, project_code: e.target.value })} />
              </div>

              <div>
                <Label className="text-xs">Belongs to Project</Label>
                <Select value={newItem.project} onValueChange={v => setNewItem({ ...newItem, project: v })}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Label className="text-xs">Allowed Expense Categories</Label>
                    <p className="text-xs text-muted-foreground">Choose all categories or limit the cost code to specific ones.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                    <Switch
                      checked={newItem.allows_all_categories}
                      onCheckedChange={(checked) => setNewItem({
                        ...newItem,
                        allows_all_categories: checked,
                        expense_categories: checked ? [] : newItem.expense_categories,
                      })}
                    />
                    <span className="text-sm font-medium">Allow all</span>
                  </div>
                </div>

                {!newItem.allows_all_categories && (
                  categories.length > 0 ? (
                    <div className="grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-2">
                      {categories.map((category) => {
                        const checked = newItem.expense_categories.includes(category);
                        return (
                          <label key={category} className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/40">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => toggleExpenseCategory(category, Boolean(value))}
                            />
                            <span className="text-sm">{category}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                      Add expense categories first, then map them to this cost code.
                    </p>
                  )
                )}
              </div>
            </div>
          )}

          <Button size="sm" onClick={handleAddItem}><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Value</th>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Project</th>
                <th className="p-3 text-left">Allowed Categories</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="p-3 capitalize">{item.type}</td>
                  <td className="p-3">{item.value}</td>
                  <td className="p-3">{item.project_code || '-'}</td>
                  <td className="p-3">{item.project || '-'}</td>
                  <td className="p-3">
                    {String(item.type || '').toLowerCase() === 'projectcode'
                      ? (item.allows_all_categories
                        ? 'All categories'
                        : (item.expense_categories?.length ? item.expense_categories.join(', ') : 'No categories'))
                      : '-'}
                  </td>
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
