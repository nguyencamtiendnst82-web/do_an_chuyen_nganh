/** Hàm thuần chọn khuyến mãi (không phụ thuộc DB, dễ kiểm thử) */
const MONEY = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

/** Chuỗi/number tiền -> xu (BigInt), null nếu sai định dạng */
export const toCents = (value) => {
  const str = typeof value === 'number' ? value.toFixed(2) : String(value ?? '').trim();
  if (!MONEY.test(str)) return null;
  const [whole, fraction = ''] = str.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};

/**
 * Chọn khuyến mãi tốt nhất (không cộng dồn nhiều chương trình).
 * - services: [{ service_id, price_at_booking }]
 * - grossCents: tổng tiền hóa đơn (dịch vụ + phụ phí) dùng so với min_invoice
 * Trả { promotion, discountCents } hoặc null nếu không có chương trình phù hợp.
 */
export const pickBestPromotion = (promotions, services, grossCents) => {
  let best = null;
  for (const promo of promotions || []) {
    const minCents = toCents(promo.min_invoice ?? 0) ?? 0n;
    if (grossCents < minCents) continue;

    const eligible = (services || []).filter((s) => !promo.service_id || s.service_id === promo.service_id);
    const baseCents = eligible.reduce((sum, s) => sum + (toCents(s.price_at_booking) ?? 0n), 0n);
    if (baseCents <= 0n) continue;

    const valueCents = toCents(promo.discount_value);
    if (valueCents === null || valueCents <= 0n) continue;
    // percent: valueCents = phần trăm * 100  -> giảm = base * value / 10000
    let discountCents = promo.discount_type === 'percent' ? (baseCents * valueCents) / 10000n : valueCents;
    if (discountCents > baseCents) discountCents = baseCents;
    if (discountCents <= 0n) continue;

    if (!best || discountCents > best.discountCents) best = { promotion: promo, discountCents };
  }
  return best;
};

export default { pickBestPromotion, toCents };
