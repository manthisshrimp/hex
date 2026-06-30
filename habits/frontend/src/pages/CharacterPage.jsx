import { useState, useEffect, useCallback } from 'react';
import { fmtNum } from '../fmt';
import SectionHeader from '../components/SectionHeader';
import {
  getShop, buyItem, getEquipment, equipItem, unequipSlot, patchCharacter, getBoss,
} from '../api';
import { TIER_COLOR, SLOT_LABEL, ALL_SLOTS } from '../constants';

// ── Shared item components (from EquipmentPage) ───────────────────────────────

function ItemCard({ item, actionLabel, onAction, actionDisabled, dimmed }) {
  const tierColor = TIER_COLOR[item.tier] || 'var(--color-text)';
  return (
    <div
      className="stone-panel"
      style={{ padding: '12px', marginBottom: '8px', opacity: dimmed ? 0.55 : 1, borderLeft: `4px solid ${tierColor}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.85rem', fontWeight: 600, color: tierColor, marginBottom: '2px' }}>
            {item.name}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            {SLOT_LABEL[item.slot] || item.slot} · {item.tier}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic', lineHeight: 1.4, marginBottom: '6px' }}>
            {item.description}
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem' }}>
            {item.damage > 0 && <span style={{ color: '#e05555' }}>⚔ {item.damage}</span>}
            {item.armor > 0 && <span style={{ color: 'var(--color-text-muted)' }}>🛡 {item.armor}</span>}
          </div>
        </div>
        {actionLabel && (
          <button
            className="bevel-btn"
            style={{ padding: '6px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={onAction}
            disabled={actionDisabled}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function SlotRow({ slotKey, item, onUnequip, locked }) {
  const empty = !item;
  return (
    <div
      className="stone-panel"
      style={{ padding: '8px 12px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', opacity: empty ? 0.45 : 1 }}
    >
      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: "'Cinzel', serif", textTransform: 'uppercase', letterSpacing: '0.05em', width: '58px', flexShrink: 0 }}>
        {SLOT_LABEL[slotKey]}
      </span>
      {empty ? (
        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>— empty —</span>
      ) : (
        <>
          <span style={{ flex: 1, fontFamily: "'Cinzel', serif", fontSize: '0.8rem', fontWeight: 600, color: TIER_COLOR[item.tier] || 'var(--color-text)' }}>
            {item.name}
          </span>
          <span style={{ fontSize: '0.72rem', color: '#e05555', marginRight: '4px' }}>{item.damage > 0 ? `⚔${item.damage}` : ''}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginRight: '8px' }}>{item.armor > 0 ? `🛡${item.armor}` : ''}</span>
          <button className="bevel-btn" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => onUnequip(slotKey)} disabled={locked}>
            Remove
          </button>
        </>
      )}
    </div>
  );
}

// ── Character tab helpers ─────────────────────────────────────────────────────

function StatRow({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.85rem', color: color || 'var(--color-text)' }}>
        {value}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

// 'equipped' tab dropped — the Inventory column already shows equipped + inventory.
const TABS = ['character', 'inventory', 'shop'];
const TAB_LABELS = {
  character: 'Character',
  inventory: 'Inventory',
  shop: 'Shop',
};

export default function CharacterPage({ hp, gold, damage, armor, renown, characterName, refreshCharacter }) {
  const [tab, setTab] = useState('character');

  // Equipment
  const [shop, setShop] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [eqLoading, setEqLoading] = useState(true);
  const [eqError, setEqError] = useState(null);
  const [buying, setBuying] = useState(null);
  const [equipping, setEquipping] = useState(null);
  const [unequipping, setUnequipping] = useState(null);
  const [gearLocked, setGearLocked] = useState(false);

  // Character name
  const [nameInput, setNameInput] = useState(characterName || '');
  const [nameSaving, setNameSaving] = useState(false);

  useEffect(() => { setNameInput(characterName || ''); }, [characterName]);

  // Gear is locked while a boss quest is active.
  useEffect(() => {
    getBoss()
      .then(r => r.ok ? r.json() : null)
      .then(d => setGearLocked(!!d?.active))
      .catch(() => {});
  }, []);

  const loadEquipment = useCallback(async () => {
    setEqLoading(true);
    setEqError(null);
    try {
      const [shopRes, eqRes] = await Promise.all([getShop(), getEquipment()]);
      if (!shopRes.ok || !eqRes.ok) throw new Error('Failed to load');
      const [shopData, eqData] = await Promise.all([shopRes.json(), eqRes.json()]);
      setShop(shopData);
      setEquipment(eqData);
    } catch (e) {
      setEqError(e.message);
    } finally {
      setEqLoading(false);
    }
  }, []);

  useEffect(() => { loadEquipment(); }, [loadEquipment]);

  const handleBuy = useCallback(async (itemId) => {
    if (buying) return;
    setBuying(itemId);
    try {
      const res = await buyItem(itemId);
      if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error || 'Purchase failed'); return; }
      await Promise.all([loadEquipment(), refreshCharacter()]);
    } finally { setBuying(null); }
  }, [buying, loadEquipment, refreshCharacter]);

  const handleEquip = useCallback(async (itemId) => {
    if (equipping) return;
    setEquipping(itemId);
    try {
      const res = await equipItem(itemId);
      if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error || 'Equip failed'); return; }
      await loadEquipment(); await refreshCharacter();
    } finally { setEquipping(null); }
  }, [equipping, loadEquipment, refreshCharacter]);

  const handleUnequip = useCallback(async (slot) => {
    if (unequipping) return;
    setUnequipping(slot);
    try {
      const res = await unequipSlot(slot);
      if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error || 'Failed to remove'); return; }
      await loadEquipment(); await refreshCharacter();
    } finally { setUnequipping(null); }
  }, [unequipping, loadEquipment, refreshCharacter]);

  const handleSaveName = async () => {
    setNameSaving(true);
    try {
      const res = await patchCharacter({ name: nameInput.trim() || null });
      if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b.error || 'Failed to save'); return; }
      await refreshCharacter();
    } finally { setNameSaving(false); }
  };

  const equippedMap = equipment?.equipped || {};
  const inventory = equipment?.inventory || [];
  const shopItems = shop?.items || [];
  const equippedIds = new Set(Object.values(equippedMap).map(i => i.id));
  const unequippedInventory = inventory.filter(i => !equippedIds.has(i.id));
  const ownedIds = new Set(inventory.map(i => i.id));

  const armoury2Active = tab === 'inventory';

  return (
    <div className="page-content">
      {/* Tab row — visible on mobile only */}
      <div className="armoury-tabs-row">
        {TABS.map(t => (
          <button
            key={t}
            className="bevel-btn"
            style={{
              flex: 1,
              padding: '8px 2px',
              fontSize: '0.65rem',
              fontFamily: "'Cinzel', serif",
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              background: tab === t ? 'var(--color-border-glow)' : undefined,
              color: tab === t ? '#1a1206' : undefined,
            }}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="armoury-cols">
        {/* ── Column 1: Character ── */}
        <div className={`armoury-col${tab !== 'character' ? ' armoury-col-hidden' : ''}`}>
          <SectionHeader>CHARACTER</SectionHeader>
          <div className="stone-panel" style={{ padding: '16px', marginBottom: '12px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Name
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                placeholder="Enter your name..."
                maxLength={32}
                style={{
                  flex: 1,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  color: 'var(--color-text)',
                  padding: '6px 10px',
                  fontFamily: "'Cinzel', serif",
                  fontSize: '0.85rem',
                }}
              />
              <button
                className="bevel-btn"
                style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                onClick={handleSaveName}
                disabled={nameSaving || nameInput === (characterName || '')}
              >
                {nameSaving ? '...' : 'Save'}
              </button>
            </div>
          </div>

          <SectionHeader>STATS</SectionHeader>
          <div className="stone-panel" style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
            <StatRow label="Health" value={`${Math.floor(hp)} / 100`} color={hp > 70 ? '#4caf7d' : hp > 30 ? '#e0a040' : '#e05555'} />
            <StatRow label="Gold" value={`⚜ ${fmtNum(Math.floor(gold))}`} color="#b8963e" />
            {damage > 0 && <StatRow label="Damage" value={`⚔ ${damage}`} color="#e05555" />}
            {armor > 0 && <StatRow label="Armor" value={`🛡 ${armor}`} color="var(--color-text-muted)" />}
            {renown > 0 && <StatRow label="Renown" value={`✦ ${Math.floor(renown)}`} color="#b8963e" />}
          </div>

          <SectionHeader>PARTY LINK</SectionHeader>
          <div className="stone-panel" style={{ padding: '12px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '8px', fontStyle: 'italic' }}>
              Share this with friends so they can add you to their party.
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <code style={{ flex: 1, fontSize: '0.7rem', wordBreak: 'break-all', color: 'var(--color-text-muted)', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '4px' }}>
                {window.location.hostname}
              </code>
              <button
                className="bevel-btn"
                style={{ padding: '6px 10px', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                onClick={() => navigator.clipboard.writeText(window.location.hostname)}
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* ── Column 2: Equipped + Inventory ── */}
        <div className={`armoury-col${!armoury2Active ? ' armoury-col-hidden' : ''}`}>
          {eqLoading ? <div className="loading-state">Loading armoury...</div> :
          eqError ? <div className="empty-state">Failed to load: {eqError}</div> : (
            <>
              {gearLocked && (
                <div style={{ fontSize: '0.7rem', color: '#c08040', fontStyle: 'italic', marginBottom: '10px', border: '1px solid #5a3a10', background: '#1a1008', padding: '7px 10px', borderRadius: '4px' }}>
                  ⚔ Gear is locked while a boss quest is active.
                </div>
              )}
              <SectionHeader>EQUIPPED GEAR</SectionHeader>
              {ALL_SLOTS.map(slot => (
                <SlotRow key={slot} slotKey={slot} item={equippedMap[slot] || null} onUnequip={handleUnequip} locked={gearLocked} />
              ))}

              <div style={{ marginTop: '20px' }}><SectionHeader>INVENTORY</SectionHeader></div>
              {unequippedInventory.length === 0 ? (
                <div className="empty-state">No items in inventory — visit the Shop.</div>
              ) : (
                unequippedInventory.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    actionLabel="Equip"
                    actionDisabled={equipping === item.id || gearLocked}
                    onAction={() => handleEquip(item.id)}
                  />
                ))
              )}
            </>
          )}
        </div>

        {/* ── Column 3: Shop ── */}
        <div className={`armoury-col${tab !== 'shop' ? ' armoury-col-hidden' : ''}`}>
          {eqLoading ? <div className="loading-state">Loading shop...</div> :
          eqError ? <div className="empty-state">Failed to load: {eqError}</div> : (
            <>
              <SectionHeader>WEEKLY SHOP — {shop?.week || ''}</SectionHeader>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: '12px' }}>
                Refreshes each week. Treasury: ⚜ {fmtNum(Math.floor(gold))}
              </div>
              {shopItems.length === 0 ? (
                <div className="empty-state">Shop is empty this week.</div>
              ) : (
                shopItems.map(item => {
                  const owned = ownedIds.has(item.id);
                  const hasRenown = !item.requiredRenown || (renown ?? 0) >= item.requiredRenown;
                  const canAfford = gold >= item.price;
                  const label = owned ? 'Owned' : !hasRenown ? `✦ ${item.requiredRenown} renown` : `⚜ ${fmtNum(item.price)}`;
                  return (
                    <ItemCard
                      key={item.id}
                      item={item}
                      dimmed={owned || !hasRenown}
                      actionLabel={label}
                      actionDisabled={owned || !hasRenown || !canAfford || buying === item.id}
                      onAction={() => handleBuy(item.id)}
                    />
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
