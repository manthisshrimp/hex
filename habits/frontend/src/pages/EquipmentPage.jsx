import { useState, useEffect, useCallback } from 'react';
import { fmtNum } from '../fmt';
import SectionHeader from '../components/SectionHeader';
import { getShop, buyItem, getEquipment, equipItem, unequipSlot } from '../api';
import { TIER_COLOR, SLOT_LABEL, ALL_SLOTS } from '../constants';

const TAB_LABELS = { equipped: 'Equipped', inventory: 'Inventory', shop: 'Shop' };

function ItemCard({ item, actionLabel, onAction, actionDisabled, dimmed }) {
  const tierColor = TIER_COLOR[item.tier] || 'var(--color-text)';
  return (
    <div
      className="stone-panel"
      style={{
        padding: '12px',
        marginBottom: '8px',
        opacity: dimmed ? 0.55 : 1,
        borderLeft: `4px solid ${tierColor}`,
      }}
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
            {item.damage > 0 && (
              <span style={{ color: '#e05555' }}>⚔ {item.damage}</span>
            )}
            {item.armor > 0 && (
              <span style={{ color: 'var(--color-text-muted)' }}>🛡 {item.armor}</span>
            )}
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

function SlotRow({ slotKey, item, onUnequip }) {
  const empty = !item;
  return (
    <div
      className="stone-panel"
      style={{
        padding: '8px 12px',
        marginBottom: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        opacity: empty ? 0.45 : 1,
      }}
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
          <span style={{ fontSize: '0.72rem', color: '#e05555', marginRight: '4px' }}>
            {item.damage > 0 ? `⚔${item.damage}` : ''}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginRight: '8px' }}>
            {item.armor > 0 ? `🛡${item.armor}` : ''}
          </span>
          <button
            className="bevel-btn"
            style={{ padding: '4px 8px', fontSize: '0.7rem' }}
            onClick={() => onUnequip(slotKey)}
          >
            Remove
          </button>
        </>
      )}
    </div>
  );
}

export default function EquipmentPage({ gold, renown, refreshCharacter }) {
  const [tab, setTab] = useState('equipped');
  const [shop, setShop] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buying, setBuying] = useState(null);
  const [equipping, setEquipping] = useState(null);
  const [unequipping, setUnequipping] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [shopRes, eqRes] = await Promise.all([getShop(), getEquipment()]);
      if (!shopRes.ok || !eqRes.ok) throw new Error('Failed to load');
      const [shopData, eqData] = await Promise.all([shopRes.json(), eqRes.json()]);
      setShop(shopData);
      setEquipment(eqData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleBuy = useCallback(async (itemId) => {
    if (buying) return;
    setBuying(itemId);
    try {
      const res = await buyItem(itemId);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || 'Purchase failed');
        return;
      }
      await Promise.all([loadAll(), refreshCharacter()]);
    } finally {
      setBuying(null);
    }
  }, [buying, loadAll, refreshCharacter]);

  const handleEquip = useCallback(async (itemId) => {
    if (equipping) return;
    setEquipping(itemId);
    try {
      const res = await equipItem(itemId);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || 'Equip failed');
        return;
      }
      await loadAll();
      await refreshCharacter();
    } finally {
      setEquipping(null);
    }
  }, [equipping, loadAll, refreshCharacter]);

  const handleUnequip = useCallback(async (slot) => {
    if (unequipping) return;
    setUnequipping(slot);
    try {
      const res = await unequipSlot(slot);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || 'Failed to remove');
        return;
      }
      await loadAll();
      await refreshCharacter();
    } finally {
      setUnequipping(null);
    }
  }, [unequipping, loadAll, refreshCharacter]);

  if (loading) return <div className="page-content"><div className="loading-state">Loading armoury...</div></div>;
  if (error) return <div className="page-content"><div className="empty-state">Failed to load: {error}</div></div>;

  const equippedMap = equipment?.equipped || {};
  const inventory = equipment?.inventory || [];
  const shopItems = shop?.items || [];

  // Inventory items not currently equipped anywhere.
  const equippedIds = new Set(Object.values(equippedMap).map(i => i.id));
  const unequippedInventory = inventory.filter(i => !equippedIds.has(i.id));

  // Shop items already in inventory.
  const ownedIds = new Set(inventory.map(i => i.id));

  return (
    <div className="page-content">
      <div className="armoury-tabs-row">
        {['equipped', 'inventory', 'shop'].map(t => (
          <button
            key={t}
            className="bevel-btn"
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '0.75rem',
              fontFamily: "'Cinzel', serif",
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
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
        <div className={`armoury-col${tab !== 'equipped' ? ' armoury-col-hidden' : ''}`}>
          <SectionHeader>EQUIPPED GEAR</SectionHeader>
          {ALL_SLOTS.map(slot => (
            <SlotRow
              key={slot}
              slotKey={slot}
              item={equippedMap[slot] || null}
              onUnequip={handleUnequip}
            />
          ))}
        </div>

        <div className={`armoury-col${tab !== 'inventory' ? ' armoury-col-hidden' : ''}`}>
          <SectionHeader>INVENTORY</SectionHeader>
          {unequippedInventory.length === 0 ? (
            <div className="empty-state">No items in inventory — visit the shop.</div>
          ) : (
            unequippedInventory.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                actionLabel="Equip"
                actionDisabled={equipping === item.id}
                onAction={() => handleEquip(item.id)}
              />
            ))
          )}
        </div>

        <div className={`armoury-col${tab !== 'shop' ? ' armoury-col-hidden' : ''}`}>
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
              const label = owned ? 'Owned'
                : !hasRenown ? `✦ ${item.requiredRenown} renown`
                : `⚜ ${fmtNum(item.price)}`;
              return (
                <div key={item.id}>
                  <ItemCard
                    item={item}
                    dimmed={owned || !hasRenown}
                    actionLabel={label}
                    actionDisabled={owned || !hasRenown || !canAfford || buying === item.id}
                    onAction={() => handleBuy(item.id)}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
