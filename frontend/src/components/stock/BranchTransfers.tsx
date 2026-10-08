import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';
import type { BranchTransfer, ShopBranch } from '../../types';
import { requestAdminPermission } from '../admin/AdminPermission';

type StockChoice = {
  key: string;
  type: string;
  id: number;
  label: string;
  qty: number;
  group: string;
  /** True when this row is a counted stock item. Catalog frames can still be ticked. */
  adjustable: boolean;
  pricingId?: number;
};

const fieldClass = 'w-full px-3 py-2 rounded-lg border border-red-900/50 bg-black/60 text-white placeholder-red-400/50 text-sm';

function itemLabel(parts: Array<string | undefined | null>) {
  return parts.map((p) => String(p || '').trim()).filter(Boolean).join(' · ');
}

export default function BranchTransfers({ onStockChanged }: { onStockChanged?: () => void }) {
  const [branches, setBranches] = useState<ShopBranch[]>([]);
  const [transfers, setTransfers] = useState<BranchTransfer[]>([]);
  const [choices, setChoices] = useState<StockChoice[]>([]);
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [phone, setPhone] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingBranch, setSavingBranch] = useState(false);
  const [historyBranch, setHistoryBranch] = useState('all');
  const [historyDirection, setHistoryDirection] = useState<'all' | 'send' | 'receive'>('all');
  const [historyQuery, setHistoryQuery] = useState('');
  const [thisBranch, setThisBranch] = useState('This shop');

  const load = async () => {
    const [branchRows, transferRows, frames, photos, photocopy, banners, stickers, customItems, customSections] = await Promise.all([
      api.branches.list(),
      api.branches.transfers(),
      api.stock.frames().catch(() => []),
      api.stock.photos().catch(() => []),
      api.stock.photocopy().catch(() => []),
      api.stock.banners().catch(() => []),
      api.stock.stickers().catch(() => []),
      api.stock.customItems().catch(() => []),
      api.stock.customSections().catch(() => []),
    ]);
    setBranches(branchRows);
    setTransfers(transferRows);

    const sectionName = new Map<string, string>();
    for (const section of customSections as { section_id?: string; label?: string }[]) {
      if (section.section_id) sectionName.set(section.section_id, section.label || section.section_id);
    }

    const framePrices = await api.services.framePricing().catch(() => []);

    const next: StockChoice[] = [];
    const push = (
      group: string,
      type: string,
      row: { id?: number; stock_qty?: number },
      label: string,
      adjustable = true,
      key = `${type}:${row.id}`
    ) => {
      if (!label) return;
      if (adjustable && !row?.id) return;
      next.push({ key, type: adjustable ? type : '', id: adjustable ? Number(row.id) : 0, label, qty: Number(row.stock_qty) || 0, group, adjustable });
    };

    const frameRows = frames as { id: number; size_name?: string; frame_type?: string; subitem_name?: string; stock_qty?: number }[];
    const frameKey = (frameType?: string, sizeName?: string, subitem?: string) =>
      [frameType, sizeName, subitem].map((part) => String(part || '').trim().toLowerCase()).join('|');
    const stockFrames = new Map(frameRows.map((row) => [frameKey(row.frame_type, row.size_name, row.subitem_name), row]));
    const usedFrameIds = new Set<number>();
    for (const price of framePrices) {
      const match = stockFrames.get(frameKey(price.frame_type, price.size_name, price.subitem_name));
      const label = itemLabel([price.subitem_name, price.frame_type, price.size_name, price.price_audience === 'st' ? 'ST' : price.price_audience === 'local' ? 'Local' : '']);
      if (match) {
        usedFrameIds.add(match.id);
        push('Frames', 'frame', match, label, true);
      } else {
        next.push({
          key: `frame-price:${price.id}:${price.price_audience || ''}`,
          type: 'frame',
          id: 0,
          label,
          qty: 0,
          group: 'Frames',
          adjustable: false,
          pricingId: price.id,
        });
      }
    }
    for (const row of frameRows) {
      if (usedFrameIds.has(row.id)) continue;
      push('Frames', 'frame', row, itemLabel([row.frame_type, row.size_name, row.subitem_name]));
    }
    for (const row of photos as { id: number; size_name?: string; stock_qty?: number }[]) {
      push('Photos', 'photo', row, row.size_name || '');
    }
    for (const row of photocopy as { id: number; size_name?: string; stock_qty?: number }[]) {
      push('Photocopy', 'photocopy', row, row.size_name || '');
    }
    for (const row of banners as { id: number; size_name?: string; stock_type?: string; print_type?: string; stock_qty?: number }[]) {
      push('Banner', 'banner', row, itemLabel([row.size_name, row.stock_type, row.print_type]));
    }
    for (const row of stickers as { id: number; size_name?: string; stock_type?: string; stock_qty?: number }[]) {
      push('Sticker', 'sticker', row, itemLabel([row.size_name, row.stock_type]));
    }
    for (const row of customItems as { id: number; section_id?: string; size_name?: string; item_type?: string; stock_qty?: number }[]) {
      const group = sectionName.get(row.section_id || '') || 'Other stock';
      push(group, 'custom', row, itemLabel([row.size_name, row.item_type]));
    }
    setChoices(next);
    try {
      const settings = await api.settings.get();
      setThisBranch(settings.branch_name?.trim() || 'This shop');
    } catch {
      setThisBranch('This shop');
    }
  };

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, StockChoice[]>();
    for (const choice of choices) {
      const list = map.get(choice.group) || [];
      list.push(choice);
      map.set(choice.group, list);
    }
    return [...map.entries()];
  }, [choices]);

  const saveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSavingBranch(true);
    try {
      if (editingId) await api.branches.update(editingId, { name, place, phone });
      else await api.branches.create({ name, place, phone });
      setName('');
      setPlace('');
      setPhone('');
      setEditingId(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingBranch(false);
    }
  };

  const removeBranch = async (branch: ShopBranch) => {
    if (!window.confirm(`Remove branch "${branch.name}"? Past send and receive records stay.`)) return;
    setError('');
    try {
      await api.branches.remove(branch.id);
      if (editingId === branch.id) {
        setEditingId(null);
        setName('');
        setPlace('');
        setPhone('');
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="mb-6 bg-black/90 rounded-xl shadow-xl border border-red-950/60 p-6">
      <h3 className="font-semibold text-white">Shop branches</h3>
      <p className="text-xs text-red-300/70 mt-1 mb-4 max-w-3xl">
        Add the other branches first. Then record stock sent from this shop, or stock received here. Change this shop’s stock only when that item is already listed and the option is ticked.
      </p>

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
      {notice && <p className="mb-3 text-sm text-emerald-300">{notice}</p>}

      <form onSubmit={saveBranch} className="grid gap-3 md:grid-cols-4 mb-4">
        <input className={fieldClass} placeholder="Branch name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className={fieldClass} placeholder="Place" value={place} onChange={(e) => setPlace(e.target.value)} />
        <input className={fieldClass} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="flex gap-2">
          <button type="submit" disabled={savingBranch} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {editingId ? 'Update branch' : 'Add branch'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setName(''); setPlace(''); setPhone(''); }}
              className="px-3 py-2 bg-red-950/60 text-red-200 rounded-lg text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {branches.length === 0 ? (
        <p className="text-sm text-red-300/70">No branches yet.</p>
      ) : (
        <ul className="mb-5 divide-y divide-red-950/50 border border-red-950/50 rounded-lg">
          {branches.map((branch) => (
            <li key={branch.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <span className="text-white font-medium">{branch.name}</span>
                {(branch.place || branch.phone) && (
                  <span className="text-red-300/70"> · {[branch.place, branch.phone].filter(Boolean).join(' · ')}</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="text-red-200 hover:text-white"
                  onClick={() => {
                    void (async () => {
                      if (!(await requestAdminPermission({ force: true }))) return;
                      setEditingId(branch.id);
                      setName(branch.name);
                      setPlace(branch.place || '');
                      setPhone(branch.phone || '');
                    })();
                  }}
                >
                  Edit
                </button>
                <button type="button" className="text-red-300 hover:text-white" onClick={() => removeBranch(branch)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <TransferForm
          title="Send to another branch"
          direction="send"
          adjustLabel="Decrease this shop’s stock"
          submitLabel="Send stock"
          branches={branches}
          groups={groups}
          onDone={async (message, changed) => {
            setNotice(message);
            await load();
            if (changed) onStockChanged?.();
          }}
          onError={setError}
        />
        <TransferForm
          title="Receive from another branch"
          direction="receive"
          adjustLabel="Increase this shop’s stock"
          submitLabel="Receive stock"
          branches={branches}
          groups={groups}
          onDone={async (message, changed) => {
            setNotice(message);
            await load();
            if (changed) onStockChanged?.();
          }}
          onError={setError}
        />
      </div>

      <TransferHistory
        transfers={transfers}
        branches={branches}
        branchFilter={historyBranch}
        directionFilter={historyDirection}
        query={historyQuery}
        onBranchFilter={setHistoryBranch}
        onDirectionFilter={setHistoryDirection}
        onQuery={setHistoryQuery}
        thisBranch={thisBranch}
        onChanged={async (message, changed) => {
          setNotice(message);
          setError('');
          await load();
          if (changed) onStockChanged?.();
        }}
      />
    </div>
  );
}

function formatWhen(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return raw.slice(0, 16);
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function TransferHistory({
  transfers,
  branches,
  branchFilter,
  directionFilter,
  query,
  onBranchFilter,
  onDirectionFilter,
  onQuery,
  thisBranch,
  onChanged,
}: {
  transfers: BranchTransfer[];
  branches: ShopBranch[];
  branchFilter: string;
  directionFilter: 'all' | 'send' | 'receive';
  query: string;
  onBranchFilter: (value: string) => void;
  onDirectionFilter: (value: 'all' | 'send' | 'receive') => void;
  onQuery: (value: string) => void;
  thisBranch: string;
  onChanged: (message: string, stockChanged: boolean) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftBranchId, setDraftBranchId] = useState('');
  const [draftItem, setDraftItem] = useState('');
  const [draftQty, setDraftQty] = useState('1');
  const [draftNote, setDraftNote] = useState('');
  const [draftAdjust, setDraftAdjust] = useState(false);
  const [rowError, setRowError] = useState('');
  const branchNames = useMemo(() => {
    const names = new Set<string>(branches.map((branch) => branch.name));
    for (const row of transfers) if (row.branch_name) names.add(row.branch_name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [branches, transfers]);

  const rows = transfers.filter((row) => {
    if (branchFilter !== 'all' && row.branch_name !== branchFilter) return false;
    if (directionFilter !== 'all' && row.direction !== directionFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${row.item_label} ${row.note} ${row.branch_name}`.toLowerCase().includes(q);
  });

  return (
    <div className="mt-6 border-t border-red-950/50 pt-5">
      <h4 className="font-medium text-white">Transfer history</h4>
      <p className="text-xs text-red-300/70 mt-1 mb-3">Every send from this shop to another branch, and every receive from another branch to this shop.</p>
      <div className="grid gap-3 md:grid-cols-3 mb-3">
        <select className={fieldClass} value={branchFilter} onChange={(e) => onBranchFilter(e.target.value)}>
          <option value="all">All branches</option>
          {branchNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select className={fieldClass} value={directionFilter} onChange={(e) => onDirectionFilter(e.target.value as 'all' | 'send' | 'receive')}>
          <option value="all">Sent and received</option>
          <option value="send">Sent from this shop</option>
          <option value="receive">Received at this shop</option>
        </select>
        <input className={fieldClass} placeholder="Search item or note" value={query} onChange={(e) => onQuery(e.target.value)} />
      </div>
      {rowError && <p className="mb-3 text-sm text-red-300">{rowError}</p>}
      {transfers.length === 0 ? (
        <p className="text-sm text-red-300/70">No transfers yet. Send or receive stock and it will show here.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-red-300/70">No transfers match this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-red-200/80">
              <tr>
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">From</th>
                <th className="py-2 pr-3 font-medium">To</th>
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium">Qty</th>
                <th className="py-2 pr-3 font-medium">Note</th>
                <th className="py-2 pr-3 font-medium">This shop’s stock</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => editingId === row.id ? (
                <tr key={row.id} className="border-t border-red-950/40 text-red-100/90">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatWhen(row.created_at)}</td>
                  <td className="py-2 pr-3" colSpan={2}>
                    <select className={fieldClass} value={draftBranchId} onChange={(e) => setDraftBranchId(e.target.value)}>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input className={fieldClass} value={draftItem} onChange={(e) => setDraftItem(e.target.value)} />
                  </td>
                  <td className="py-2 pr-3">
                    <input className={fieldClass} type="number" min={1} step={1} value={draftQty} onChange={(e) => setDraftQty(e.target.value)} />
                  </td>
                  <td className="py-2 pr-3">
                    <input className={fieldClass} value={draftNote} onChange={(e) => setDraftNote(e.target.value)} placeholder="Note" />
                  </td>
                  <td className="py-2 pr-3">
                    <label className="flex items-center gap-2 text-xs text-red-100">
                      <input type="checkbox" checked={draftAdjust} onChange={(e) => setDraftAdjust(e.target.checked)} disabled={!row.item_id} />
                      {row.direction === 'send' ? 'Decrease stock' : 'Increase stock'}
                    </label>
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-emerald-300 hover:text-white mr-3"
                      onClick={async () => {
                        if (!(await requestAdminPermission())) return;
                        setRowError('');
                        try {
                          const result = await api.branches.updateTransfer(row.id, {
                            branch_id: Number(draftBranchId),
                            item_label: draftItem.trim(),
                            quantity: Math.floor(Number(draftQty)),
                            note: draftNote,
                            adjust_stock: draftAdjust,
                            item_type: row.item_type,
                            item_id: row.item_id,
                          });
                          setEditingId(null);
                          await onChanged(result.message, Boolean(row.stock_adjusted || draftAdjust));
                        } catch (err) {
                          setRowError((err as Error).message);
                        }
                      }}
                    >
                      Save
                    </button>
                    <button type="button" className="text-red-300 hover:text-white" onClick={() => { setEditingId(null); setRowError(''); }}>
                      Back
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="border-t border-red-950/40 text-red-100/90">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatWhen(row.created_at)}</td>
                  <td className="py-2 pr-3">{row.direction === 'send' ? thisBranch : row.branch_name}</td>
                  <td className="py-2 pr-3">{row.direction === 'send' ? row.branch_name : thisBranch}</td>
                  <td className="py-2 pr-3">{row.item_label}</td>
                  <td className="py-2 pr-3">{row.quantity}</td>
                  <td className="py-2 pr-3">{row.note || '—'}</td>
                  <td className="py-2 pr-3">{row.stock_adjusted ? (row.direction === 'send' ? 'Decreased' : 'Increased') : 'Unchanged'}</td>
                  <td className="py-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-red-200 hover:text-white mr-3"
                      onClick={() => {
                        void (async () => {
                          if (!(await requestAdminPermission({ force: true }))) return;
                          setRowError('');
                          setEditingId(row.id);
                          setDraftBranchId(String(row.branch_id || branches.find((branch) => branch.name === row.branch_name)?.id || ''));
                          setDraftItem(row.item_label);
                          setDraftQty(String(row.quantity));
                          setDraftNote(row.note || '');
                          setDraftAdjust(Boolean(row.adjust_stock));
                        })();
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-300 hover:text-white"
                      onClick={async () => {
                        if (!(await requestAdminPermission({ force: true }))) return;
                        setRowError('');
                        try {
                          const result = await api.branches.undoTransfer(row.id);
                          await onChanged(result.message, Boolean(row.stock_adjusted));
                        } catch (err) {
                          setRowError((err as Error).message);
                        }
                      }}
                    >
                      Undo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StockItemField({
  groups,
  onChange,
}: {
  groups: [string, StockChoice[]][];
  onChange: (selected: StockChoice | null, name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef<number | null>(null);

  const flat = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows: StockChoice[] = [];
    for (const [, items] of groups) {
      for (const item of items) {
        if (!q || `${item.group} ${item.label}`.toLowerCase().includes(q)) rows.push(item);
      }
    }
    return rows;
  }, [groups, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, StockChoice[]>();
    for (const item of flat) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [flat]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const pick = (item: StockChoice) => {
    setQuery(`${item.group} · ${item.label}`);
    setOpen(false);
    onChange(item, item.label);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) => Math.min(index + 1, Math.max(flat.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const chosen = flat[highlight] || (flat.length === 1 ? flat[0] : null);
    if (chosen) pick(chosen);
    else {
      setOpen(false);
      onChange(null, query.trim());
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        className={fieldClass}
        placeholder="Search item, then press Enter"
        value={query}
        required
        onFocus={() => {
          if (blurTimer.current) window.clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          onChange(null, next);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-red-900/50 bg-black shadow-xl">
          {flat.length === 0 ? (
            <p className="px-3 py-2 text-sm text-red-300/70">
              {groups.some(([, items]) => items.length > 0)
                ? 'No matching item. Press Enter to use the name you typed.'
                : 'No stock items yet. Add them in a section below, or type a name and press Enter.'}
            </p>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group}>
                <div className="px-3 py-1.5 bg-red-950/50 text-red-200 text-xs font-semibold uppercase">{group}</div>
                {items.map((item) => {
                  const index = flat.findIndex((row) => row.key === item.key);
                  const active = index === highlight;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm text-white ${active ? 'bg-red-800' : 'hover:bg-red-950/50'}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => pick(item)}
                    >
                      {item.label}
                      {item.adjustable && <span className="text-red-300/70"> · qty {item.qty}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TransferForm({
  title,
  direction,
  adjustLabel,
  submitLabel,
  branches,
  groups,
  onDone,
  onError,
}: {
  title: string;
  direction: 'send' | 'receive';
  adjustLabel: string;
  submitLabel: string;
  branches: ShopBranch[];
  groups: [string, StockChoice[]][];
  onDone: (message: string, stockChanged: boolean) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [branchId, setBranchId] = useState('');
  const [selected, setSelected] = useState<StockChoice | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemFieldKey, setItemFieldKey] = useState(0);
  const [quantity, setQuantity] = useState('1');
  const [adjust, setAdjust] = useState(true);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError('');
    const label = selected?.label || itemName.trim();
    setSaving(true);
    try {
      const result = await api.branches.transfer({
        direction,
        branch_id: Number(branchId),
        item_type: selected?.id ? selected.type : '',
        item_id: selected?.id || null,
        frame_pricing_id: selected?.pricingId ?? null,
        item_label: label,
        quantity: Math.floor(Number(quantity)),
        adjust_stock: Boolean(selected) && adjust,
        note,
      });
      setSelected(null);
      setItemName('');
      setItemFieldKey((key) => key + 1);
      setQuantity('1');
      setNote('');
      setAdjust(true);
      await onDone(result.message, result.stock_adjusted);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="border border-red-950/50 rounded-lg p-4 space-y-3">
      <h4 className="font-medium text-white">{title}</h4>
      <select className={fieldClass} value={branchId} onChange={(e) => setBranchId(e.target.value)} required disabled={branches.length === 0}>
        <option value="">{branches.length === 0 ? 'Add a branch first' : 'Choose branch'}</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>{branch.name}</option>
        ))}
      </select>
      <StockItemField
        key={itemFieldKey}
        groups={groups}
        onChange={(item, name) => {
          setSelected(item);
          setItemName(name);
          if (item) setAdjust(true);
        }}
      />
      <input className={fieldClass} type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
      <input className={fieldClass} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className={`flex items-center gap-2 text-sm ${selected ? 'text-red-100' : 'text-red-300/50'}`}>
        <input
          type="checkbox"
          checked={Boolean(selected) && adjust}
          disabled={!selected}
          onChange={(e) => setAdjust(e.target.checked)}
        />
        {adjustLabel}
      </label>
      <button type="submit" disabled={saving || branches.length === 0} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
        {saving ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
